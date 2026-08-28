// Generates a module thumbnail from the first slide/page of its source
// file (PPT, PDF, or uploaded document) using the self-hosted edge-tts
// service's /render-slides endpoint (LibreOffice + pdftoppm), which already
// exists for the narrated-video pipeline. Only the first page is rendered
// (maxPages: 1) since that's all a thumbnail needs - much faster than
// rendering a whole deck.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

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

    const { moduleId } = await req.json();
    if (!moduleId) return json({ error: "moduleId is required" }, 400);

    const { data: mod, error: modErr } = await adminClient
      .from("modules")
      .select("id, module_type, file_url, slides, thumbnail_url")
      .eq("id", moduleId)
      .single();
    if (modErr || !mod) return json({ error: "Module not found" }, 404);

    // Only these module types have a renderable source file to thumbnail.
    if (!["ppt", "pdf", "document"].includes(mod.module_type)) {
      return json({ skipped: true, reason: "Module type has no renderable source file" }, 200);
    }

    const slidesMeta = (mod.slides || {}) as any;
    const sourceUrl: string | null = mod.file_url || slidesMeta.fileUrl || null;
    if (!sourceUrl) {
      return json({ skipped: true, reason: "Module has no source file" }, 200);
    }

    const TTS_SERVICE_URL = Deno.env.get("TTS_SERVICE_URL");
    const TTS_SHARED_SECRET = Deno.env.get("TTS_SHARED_SECRET");
    if (!TTS_SERVICE_URL || !TTS_SHARED_SECRET) {
      return json({ error: "Missing config (TTS_SERVICE_URL, TTS_SHARED_SECRET)" }, 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let renderResult: { images: string[] };
    try {
      const res = await fetch(`${TTS_SERVICE_URL.replace(/\/$/, "")}/render-slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": TTS_SHARED_SECRET },
        signal: controller.signal,
        body: JSON.stringify({ pptxUrl: sourceUrl, dpi: 120, maxPages: 1 }),
      });
      if (!res.ok) {
        const t = await res.text();
        return json({ error: `Render service rejected request [${res.status}]: ${t.slice(0, 200)}` }, 502);
      }
      renderResult = await res.json();
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      const msg = aborted ? "Render service did not respond (timeout)" : `Render service error: ${err instanceof Error ? err.message : err}`;
      return json({ error: msg }, 502);
    } finally {
      clearTimeout(timeout);
    }

    if (!renderResult.images || renderResult.images.length === 0) {
      return json({ error: "No image was rendered" }, 500);
    }

    const imageBytes = base64ToUint8Array(renderResult.images[0]);
    const storagePath = `thumbnails/${moduleId}-${Date.now()}.png`;

    const { error: uploadError } = await adminClient.storage
      .from("module-files")
      .upload(storagePath, imageBytes, { contentType: "image/png", upsert: true });
    if (uploadError) {
      return json({ error: `Failed to upload thumbnail: ${uploadError.message}` }, 500);
    }

    const { data: urlData } = adminClient.storage.from("module-files").getPublicUrl(storagePath);
    const thumbnailUrl = urlData.publicUrl;

    const { error: updateError } = await adminClient
      .from("modules")
      .update({ thumbnail_url: thumbnailUrl })
      .eq("id", moduleId);
    if (updateError) {
      return json({ error: `Failed to save thumbnail URL: ${updateError.message}` }, 500);
    }

    return json({ thumbnailUrl }, 200);
  } catch (e) {
    console.error("generate-module-thumbnail error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
