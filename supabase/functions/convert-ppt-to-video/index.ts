// Convert an uploaded .pptx module into a narrated MP4 — fully self-hosted, no paid APIs.
// Flow: render pptx -> per-slide PNGs + text (LibreOffice/pdftoppm/pdftotext on the
// edge-tts service) -> narration (speaker note, else LLM-generated from slide text,
// else raw slide text) via self-hosted edge-tts -> ffmpeg stitch (self-hosted).
// Runs as a background task (EdgeRuntime.waitUntil) so it survives the 150s request limit.
// Reuses video_generation_jobs (polled by check-video-render) and module_outputs (multi-format storage).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user) return json({ error: "Unauthorized" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // RBAC
    const allowedRoles = ["sme", "sme_expert", "manager", "admin"] as const;
    let hasAccess = false;
    for (const role of allowedRoles) {
      const { data } = await adminClient.rpc("has_role", { _user_id: authData.user.id, _role: role });
      if (data) { hasAccess = true; break; }
    }
    if (!hasAccess) return json({ error: "Forbidden" }, 403);

    const { moduleId } = await req.json();
    if (!moduleId) return json({ error: "moduleId is required" }, 400);

    // Load module
    const { data: mod, error: modErr } = await adminClient
      .from("modules")
      .select("id, title, module_type, file_url, slides")
      .eq("id", moduleId)
      .single();
    if (modErr || !mod) return json({ error: "Module not found" }, 404);
    if (mod.module_type !== "ppt") return json({ error: "Module is not a PPT" }, 400);

    const slidesMeta = (mod.slides || {}) as any;
    // Uploaded PPTX modules store the file URL in slides.fileUrl, not the top-level file_url column.
    const pptUrl: string = mod.file_url || slidesMeta.fileUrl;
    if (!pptUrl) return json({ error: "Module has no PPT file" }, 400);

    // Speaker notes are optional now: if present they drive narration, otherwise
    // we fall back to each slide's on-screen text (extracted during rendering).
    const speakerNotes: { slideNumber: number; text: string }[] =
      Array.isArray(slidesMeta.speakerNotes) ? slidesMeta.speakerNotes : [];

    // Slide rendering, narration and stitching all run on the self-hosted
    // service now (LibreOffice + edge-tts + ffmpeg) — no paid CloudConvert.
    const TTS_SERVICE_URL = Deno.env.get("TTS_SERVICE_URL");
    const TTS_SHARED_SECRET = Deno.env.get("TTS_SHARED_SECRET");
    if (!TTS_SERVICE_URL || !TTS_SHARED_SECRET) {
      return json({ error: "Missing config (TTS_SERVICE_URL, TTS_SHARED_SECRET)" }, 400);
    }

    // Create job row
    const { data: job, error: jobErr } = await adminClient
      .from("video_generation_jobs")
      .insert({
        module_id: moduleId,
        status: "processing",
        scene_total: speakerNotes.length || slidesMeta.slideCount || 0,
        scene_completed: 0,
        current_step: "Rendering slide images...",
      })
      .select("id")
      .single();
    if (jobErr || !job) return json({ error: "Failed to create job" }, 500);
    const jobId = job.id;

    // The full render (CloudConvert + per-slide narration + ffmpeg stitch) easily
    // exceeds the 150s request idle-timeout. Run it as a background task and
    // respond immediately with the job id; the client polls check-video-render
    // for progress and the finished MP4. On any failure the job row is marked
    // "failed" with the reason, which the client surfaces.
    const runPipeline = async () => {
      try {
        // 1) Slide images + per-slide text — reuse if already rendered
        let slideImageUrls: string[] = [];
        let slideTexts: string[] = [];
        const { data: existingImgOutput } = await adminClient
          .from("module_outputs")
          .select("content")
          .eq("module_id", moduleId)
          .eq("format_type", "slide_images")
          .maybeSingle();
        if (existingImgOutput?.content?.images?.length) {
          slideImageUrls = existingImgOutput.content.images;
          slideTexts = existingImgOutput.content.texts || [];
        } else {
          const rendered = await renderPptxSlides(TTS_SERVICE_URL, TTS_SHARED_SECRET, pptUrl, adminClient, moduleId);
          slideImageUrls = rendered.imageUrls;
          slideTexts = rendered.texts;
          await adminClient.from("module_outputs").upsert({
            module_id: moduleId,
            format_type: "slide_images",
            content: { images: slideImageUrls, texts: slideTexts },
            status: "completed",
          }, { onConflict: "module_id,format_type" } as any);
        }
        if (slideImageUrls.length === 0) throw new Error("No slide images produced");

        // Keep the job's scene total honest now that we know the real slide count.
        await adminClient.from("video_generation_jobs").update({
          scene_total: slideImageUrls.length,
        }).eq("id", jobId);

        // 2) Per-slide narration: speaker note if present, else the slide's own
        // text; slides with neither are shown silently.
        await adminClient.from("video_generation_jobs").update({
          current_step: "Generating narration...", progress: 30,
        }).eq("id", jobId);

        const noteBySlide = new Map<number, string>();
        speakerNotes.forEach((n, idx) => {
          const sIdx = n?.slideNumber || idx + 1;
          if (n?.text) noteBySlide.set(sIdx, n.text);
        });

        // Decide the narration text for every slide up front:
        //  - a clean speaker note wins (the author wrote it on purpose);
        //  - otherwise generate a spoken teaching script from the slide's text
        //    via the LLM (so we explain the slide, not read it verbatim);
        //  - if the LLM is unavailable, fall back to the raw slide text.
        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        const narrations: string[] = new Array(slideImageUrls.length).fill("");
        const needGen: number[] = [];
        for (let i = 0; i < slideImageUrls.length; i++) {
          const note = noteBySlide.get(i + 1) || "";
          if (note && !looksLikeMarkup(note)) {
            narrations[i] = sanitizeNarration(note);
          } else {
            needGen.push(i);
          }
        }
        if (needGen.length > 0) {
          let generated: string[] = [];
          if (GEMINI_API_KEY) {
            await adminClient.from("video_generation_jobs").update({
              current_step: "Writing narration script...", progress: 25,
            }).eq("id", jobId);
            try {
              generated = await generateNarrations(
                GEMINI_API_KEY,
                mod.title || "Lesson",
                needGen.map((i) => sanitizeNarration(slideTexts[i] || "")),
              );
            } catch (err) {
              console.error("Narration generation failed; using slide text:", err);
            }
          }
          needGen.forEach((slideI, k) => {
            narrations[slideI] = (generated[k] || sanitizeNarration(slideTexts[slideI] || "")).trim();
          });
        }

        const sceneAssets: { imageUrl: string; audioUrl: string; duration: number }[] = [];
        for (let i = 0; i < slideImageUrls.length; i++) {
          const slideIdx = i + 1;
          const imageUrl = slideImageUrls[i];
          const narration = narrations[i] || "";

          await adminClient.from("video_generation_jobs").update({
            current_step: `Narrating slide ${slideIdx} of ${slideImageUrls.length}...`,
            scene_completed: i,
            progress: 30 + Math.round((i / slideImageUrls.length) * 50),
          }).eq("id", jobId);

          if (!narration) {
            // Nothing to say on this slide — hold it on screen silently.
            sceneAssets.push({ imageUrl, audioUrl: "", duration: 5 });
            continue;
          }

          const { data: existingAudio } = await adminClient
            .from("module_slide_audio")
            .select("audio_url, audio_duration, narration_text")
            .eq("module_id", moduleId)
            .eq("slide_number", slideIdx)
            .maybeSingle();

          // Reuse cached audio only if it was generated from the same (clean)
          // text — so modules narrated from old leaked-XML notes self-heal.
          const cachedOk = !!existingAudio?.audio_url && existingAudio.narration_text === narration;
          let audioUrl = cachedOk ? existingAudio!.audio_url : "";
          const duration = (cachedOk && existingAudio!.audio_duration) || Math.max(4, Math.ceil(narration.length / 15));

          if (!audioUrl) {
            audioUrl = await generateNarrationAudio(
              TTS_SERVICE_URL, TTS_SHARED_SECRET, narration, adminClient, moduleId, slideIdx, slidesMeta,
            );
            await adminClient.from("module_slide_audio").upsert({
              module_id: moduleId, slide_number: slideIdx,
              narration_text: narration, audio_url: audioUrl,
              audio_duration: duration, audio_status: "completed", voice_id: "edge-tts",
            }, { onConflict: "module_id,slide_number" } as any);
          }

          sceneAssets.push({ imageUrl, audioUrl, duration });
        }

        // 3) Stitch final video with the self-hosted ffmpeg service (free, replaces Shotstack)
        await adminClient.from("video_generation_jobs").update({
          current_step: "Stitching final video...", scene_completed: slideImageUrls.length, progress: 85,
        }).eq("id", jobId);

        const stitchController = new AbortController();
        const stitchTimeout = setTimeout(() => stitchController.abort(), 280_000);
        let stitchRes: Response;
        try {
          stitchRes = await fetch(`${TTS_SERVICE_URL.replace(/\/$/, "")}/stitch-video`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "video/mp4", "x-api-key": TTS_SHARED_SECRET },
            body: JSON.stringify({ scenes: sceneAssets, aspectRatio: "16:9" }),
            signal: stitchController.signal,
          });
        } catch (err) {
          const aborted = err instanceof Error && err.name === "AbortError";
          throw new Error(aborted ? "Stitch timed out after 280s" : `Stitch request failed: ${err instanceof Error ? err.message : err}`);
        } finally {
          clearTimeout(stitchTimeout);
        }
        if (!stitchRes.ok) {
          const errText = await stitchRes.text();
          throw new Error(`Stitch failed: ${errText.slice(0, 300)}`);
        }
        const mp4Buf = await stitchRes.arrayBuffer();

        // Upload the finished MP4 and mark the job complete
        const videoPath = `video-gen/${moduleId}/output.mp4`;
        const vupload = await adminClient.storage.from("module-files").upload(
          videoPath, new Uint8Array(mp4Buf), { contentType: "video/mp4", upsert: true },
        );
        if (vupload.error) throw new Error(`Video upload failed: ${vupload.error.message}`);
        const { data: vurl } = adminClient.storage.from("module-files").getPublicUrl(videoPath);

        await adminClient.from("video_generation_jobs").update({
          status: "completed",
          progress: 100,
          current_step: "Done",
          output_video_url: vurl.publicUrl,
        }).eq("id", jobId);

        await adminClient.from("module_outputs").upsert({
          module_id: moduleId, format_type: "video", content: { url: vurl.publicUrl }, status: "completed",
        }, { onConflict: "module_id,format_type" } as any);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("convert-ppt-to-video pipeline error:", msg);
        await adminClient.from("video_generation_jobs").update({
          status: "failed", error_message: msg.slice(0, 500),
        }).eq("id", jobId);
      }
    };

    // Run beyond the response on the Supabase edge runtime; fall back to a plain
    // (unawaited) call in local/dev where EdgeRuntime isn't defined.
    // @ts-ignore EdgeRuntime is injected by the Supabase edge runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(runPipeline());
    } else {
      runPipeline();
    }

    return json({ jobId, status: "processing" }, 202);
  } catch (e) {
    console.error("convert-ppt-to-video error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- Self-hosted slide rendering: pptx -> per-slide PNGs + text (LibreOffice + pdftoppm/pdftotext) ---
// Returns base64 PNGs and per-slide text from the edge-tts service; we re-upload
// the PNGs to module-files for stable public URLs that the stitch step (and the
// slide-image cache) reuse. The text is the narration fallback for note-less decks.
async function renderPptxSlides(
  serviceUrl: string,
  sharedSecret: string,
  pptxUrl: string,
  adminClient: any,
  moduleId: string,
): Promise<{ imageUrls: string[]; texts: string[] }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  let res: Response;
  try {
    res = await fetch(`${serviceUrl.replace(/\/$/, "")}/render-slides`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": sharedSecret },
      body: JSON.stringify({ pptxUrl, dpi: 150 }),
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new Error(aborted ? "Slide render timed out after 180s" : `Slide render request failed: ${err instanceof Error ? err.message : err}`);
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Slide render failed [${res.status}]: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const images: string[] = data?.images || [];
  const texts: string[] = data?.texts || [];
  if (images.length === 0) throw new Error("Render service returned no slides");

  const imageUrls: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const bytes = base64ToBytes(images[i]);
    const path = `video-gen/${moduleId}/slide-${i + 1}.png`;
    const up = await adminClient.storage.from("module-files").upload(
      path, bytes, { contentType: "image/png", upsert: true },
    );
    if (up.error) throw new Error(`Slide upload failed: ${up.error.message}`);
    const { data: pub } = adminClient.storage.from("module-files").getPublicUrl(path);
    imageUrls.push(pub.publicUrl);
  }
  return { imageUrls, texts };
}

// Turn each slide's on-screen text into natural spoken narration via the Lovable
// AI gateway (same model the rest of the app uses). One batched call gives the
// model whole-deck context so narration flows slide to slide. Returns one string
// per input slide, aligned by index; throws on gateway failure so the caller can
// fall back to raw slide text.
async function generateNarrations(
  apiKey: string,
  deckTitle: string,
  slideTexts: string[],
): Promise<string[]> {
  const list = slideTexts
    .map((t, i) => `[${i + 1}] ${t && t.trim() ? t.trim() : "(no text on this slide)"}`)
    .join("\n\n");
  const system =
    "You are an expert instructor writing voice-over narration for an educational " +
    "slide video. For each slide, write natural SPOKEN narration that explains and " +
    "teaches the idea to a learner — do NOT just read the on-screen text. 2 to 4 " +
    "sentences per slide. Plain prose only (a TTS engine will speak it): no markdown, " +
    "no bullet characters, no emojis, no raw code symbols; describe code in words. " +
    "Let each slide flow naturally from the previous one.";
  const user =
    `Deck title: ${deckTitle}\n\nText extracted from each slide:\n\n${list}\n\n` +
    `Return ONLY a JSON array of exactly ${slideTexts.length} strings — one narration ` +
    `per slide, in order. No commentary, no code fences.`;

  const model = "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.6,
          responseMimeType: "application/json",
          responseSchema: { type: "ARRAY", items: { type: "STRING" } },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  let arr: unknown;
  try {
    arr = JSON.parse(content);
  } catch {
    const m = content.match(/\[[\s\S]*\]/);
    arr = m ? JSON.parse(m[0]) : [];
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => sanitizeNarration(String(x ?? "")));
}

// True if the string contains OOXML/drawingml tags (a:, p:, w: …) — i.e. leaked
// markup rather than real prose. Such "notes" must not be read aloud.
function looksLikeMarkup(s: string): boolean {
  return /<\/?(?:a|p|w|r|c):[a-z]/i.test(s || "");
}

// Strip any residual XML tags and collapse whitespace before sending to TTS.
function sanitizeNarration(s: string): string {
  return (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- Open-source TTS via self-hosted edge-tts service ---
async function generateNarrationAudio(
  serviceUrl: string,
  sharedSecret: string,
  text: string,
  adminClient: any,
  moduleId: string,
  slideNum: number,
  slidesMeta: any,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  let res: Response;
  try {
    res = await fetch(`${serviceUrl.replace(/\/$/, "")}/generate-voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "audio/wav", "x-api-key": sharedSecret },
      body: JSON.stringify({
        text: text.slice(0, 4000),
        language: slidesMeta?.narrationLanguage || "en",
        style: "narration",
        voice_description: slidesMeta?.narrationVoiceDescription,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`TTS service failed [${res.status}]: ${t.slice(0, 200)}`);
  }
  const buf = await res.arrayBuffer();
  const path = `video-gen/${moduleId}/slide-${slideNum}-audio.wav`;
  const up = await adminClient.storage.from("module-files").upload(
    path, new Uint8Array(buf), { contentType: "audio/wav", upsert: true },
  );
  if (up.error) throw new Error(`Audio upload failed: ${up.error.message}`);
  const { data } = adminClient.storage.from("module-files").getPublicUrl(path);
  return data.publicUrl;
}

