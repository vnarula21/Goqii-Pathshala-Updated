"""
edge-tts microservice — free Microsoft neural voices (no API key, no card).

Implements the existing self-hosted TTS contract so it is a drop-in for the
Supabase edge functions `generate-voice`, `generate-audio` and `convert-ppt-to-video`:

    POST /generate-voice
    headers: x-api-key: <TTS_SHARED_SECRET>
    body:    { text, language?("en"|"hi"), style?, voice_description?, voice? }
    returns: audio/wav
    GET  /health

Indian English (Neerja / Prabhat) and Hindi (Swara / Madhur) voices.
Tiny footprint — no model to load — so it runs on any free CPU host.
"""
import asyncio
import base64
import glob
import json
import os
import re
import subprocess
import tempfile
import threading
import urllib.error
import urllib.request

import edge_tts
from fastapi import FastAPI, Header, HTTPException, Response
from pydantic import BaseModel, Field

SHARED_SECRET = os.environ.get("TTS_SHARED_SECRET", "")

app = FastAPI(title="edge-tts service", version="1.0")

# language -> gendered Microsoft neural voice
VOICES = {
    "en": {"female": "en-IN-NeerjaNeural", "male": "en-IN-PrabhatNeural"},
    "hi": {"female": "hi-IN-SwaraNeural", "male": "hi-IN-MadhurNeural"},
}
# style -> speaking rate
STYLE_RATE = {"narration": "-5%", "conversational": "+0%", "energetic": "+8%"}


class VoiceRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    language: str = "en"
    style: str = "narration"
    voice_description: str | None = None
    voice: str | None = None  # explicit voice id overrides inference


def pick_voice(req: VoiceRequest) -> str:
    if req.voice:
        return req.voice
    lang = req.language if req.language in VOICES else "en"
    desc = (req.voice_description or "").lower()
    # "female" contains "male" — check it first
    gender = "female"
    if "female" in desc or "woman" in desc or "lady" in desc:
        gender = "female"
    elif "male" in desc or "man" in desc:
        gender = "male"
    return VOICES[lang][gender]


async def synth_mp3(text: str, voice: str, rate: str) -> bytes:
    communicate = edge_tts.Communicate(text, voice=voice, rate=rate)
    buf = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.extend(chunk["data"])
    if not buf:
        raise RuntimeError("edge-tts returned no audio")
    return bytes(buf)


def mp3_to_wav(mp3: bytes) -> bytes:
    """Transcode to WAV so callers expecting audio/wav stay unchanged.

    Write to a temp file (not a pipe) so ffmpeg can seek back and set the correct
    RIFF/data sizes in the header — streaming to a pipe leaves a 0xFFFFFFFF placeholder
    that strict WAV decoders reject.
    """
    with tempfile.NamedTemporaryFile(suffix=".mp3") as fin, \
            tempfile.NamedTemporaryFile(suffix=".wav") as fout:
        fin.write(mp3)
        fin.flush()
        p = subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", fin.name, fout.name],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if p.returncode != 0:
            raise RuntimeError(p.stderr.decode()[:300])
        fout.seek(0)
        return fout.read()


@app.get("/health")
def health():
    return {"status": "ok", "engine": "edge-tts"}


@app.post("/generate-voice")
def generate_voice(req: VoiceRequest, x_api_key: str = Header(default="")):
    if not SHARED_SECRET or x_api_key != SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing x-api-key")

    voice = pick_voice(req)
    rate = STYLE_RATE.get(req.style, "-5%")
    try:
        mp3 = asyncio.run(synth_mp3(req.text, voice, rate))
        wav = mp3_to_wav(mp3)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS failed: {e}")

    return Response(
        content=wav,
        media_type="audio/wav",
        headers={"x-tts-voice": voice, "x-tts-engine": "edge-tts"},
    )


# ─── Slide rendering (free LibreOffice + pdftoppm; replaces CloudConvert) ──

class RenderRequest(BaseModel):
    pptxUrl: str
    dpi: int = 150


def _pptx_to_pdf(pptx_path: str, outdir: str) -> str:
    """Headless LibreOffice: .pptx/.ppt -> .pdf. A per-call UserInstallation
    profile keeps concurrent conversions from clashing and avoids needing $HOME."""
    profile = os.path.join(outdir, "lo-profile")
    p = subprocess.run(
        [
            "soffice", "--headless", "--norestore", "--invisible", "--nodefault",
            f"-env:UserInstallation=file://{profile}",
            "--convert-to", "pdf", "--outdir", outdir, pptx_path,
        ],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180,
    )
    pdfs = glob.glob(os.path.join(outdir, "*.pdf"))
    if not pdfs:
        raise RuntimeError(
            (p.stderr.decode() or p.stdout.decode() or "libreoffice produced no pdf")[:300]
        )
    return pdfs[0]


@app.post("/render-slides")
def render_slides(req: RenderRequest, x_api_key: str = Header(default="")):
    if not SHARED_SECRET or x_api_key != SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing x-api-key")
    try:
        with tempfile.TemporaryDirectory() as d:
            pptx = os.path.join(d, "deck.pptx")
            _download(req.pptxUrl, pptx)
            pdf = _pptx_to_pdf(pptx, d)
            prefix = os.path.join(d, "slide")
            p = subprocess.run(
                ["pdftoppm", "-png", "-r", str(req.dpi), pdf, prefix],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180,
            )
            if p.returncode != 0:
                raise RuntimeError((p.stderr.decode() or "pdftoppm failed")[:300])
            pngs = sorted(
                glob.glob(prefix + "*.png"),
                key=lambda x: int("".join(filter(str.isdigit, os.path.basename(x))) or 0),
            )
            if not pngs:
                raise RuntimeError("no slides rendered")
            images = [base64.b64encode(open(f, "rb").read()).decode() for f in pngs]

            # Per-slide visible text — used as fallback narration for decks that
            # have no speaker notes, so every deck still becomes a narrated video.
            texts: list[str] = []
            txt_path = os.path.join(d, "deck.txt")
            tp = subprocess.run(
                ["pdftotext", "-layout", pdf, txt_path],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120,
            )
            if tp.returncode == 0 and os.path.exists(txt_path):
                raw = open(txt_path, encoding="utf-8", errors="ignore").read()
                texts = [" ".join(pg.split()) for pg in raw.split("\f")]
            # Align text count to image count (pad/trim).
            texts = (texts + [""] * len(images))[: len(images)]
        return {"count": len(images), "images": images, "texts": texts}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="slide render timed out")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"render failed: {e}")


# ─── Video stitching (free ffmpeg replacement for Shotstack) ──────────────

class Scene(BaseModel):
    imageUrl: str
    audioUrl: str | None = None
    duration: float | None = None


class StitchRequest(BaseModel):
    scenes: list[Scene]
    aspectRatio: str = "16:9"
    # Slides are static images, so a low frame rate looks identical but encodes
    # far faster (encode time scales with total frames = duration x fps). 10fps
    # keeps long narrated decks well under the edge-function time budget.
    fps: int = 10


def _download(url: str, path: str) -> None:
    with urllib.request.urlopen(url, timeout=90) as r, open(path, "wb") as f:
        f.write(r.read())


def _run_ffmpeg(cmd: list[str], timeout: int = 600) -> None:
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode()[:400])


def build_video(scenes: list[Scene], w: int, h: int, fps: int) -> bytes:
    """One clip per slide (image held for its narration), then concatenated to MP4."""
    vf = (
        f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
        f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,format=yuv420p"
    )
    # Encode every clip with identical codec params (libx264 ultrafast video +
    # 48k stereo AAC audio) so the final concat can stream-copy instead of
    # re-encoding. The old code re-encoded the whole timeline a second time,
    # which doubled CPU and pushed bigger decks past the edge-function timeout.
    with tempfile.TemporaryDirectory() as d:
        clips: list[str] = []
        for i, s in enumerate(scenes):
            img = os.path.join(d, f"img{i}.png")
            _download(s.imageUrl, img)
            clip = os.path.join(d, f"clip{i}.mp4")
            if s.audioUrl:
                aud = os.path.join(d, f"aud{i}.wav")
                _download(s.audioUrl, aud)
                _run_ffmpeg([
                    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-loop", "1", "-i", img, "-i", aud,
                    "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage",
                    "-r", str(fps), "-vf", vf,
                    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
                    "-shortest", clip,
                ])
            else:
                dur = max(2.0, float(s.duration or 4))
                _run_ffmpeg([
                    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-loop", "1", "-t", str(dur), "-i", img,
                    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                    "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage",
                    "-r", str(fps), "-vf", vf,
                    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
                    "-shortest", clip,
                ])
            clips.append(clip)

        list_file = os.path.join(d, "list.txt")
        with open(list_file, "w") as f:
            for c in clips:
                f.write(f"file '{c}'\n")
        out = os.path.join(d, "out.mp4")
        # Stream-copy concat (no re-encode) + faststart remux — fast even for many slides.
        _run_ffmpeg([
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", list_file,
            "-c", "copy", "-movflags", "+faststart", out,
        ])
        with open(out, "rb") as f:
            return f.read()


@app.post("/stitch-video")
def stitch_video(req: StitchRequest, x_api_key: str = Header(default="")):
    if not SHARED_SECRET or x_api_key != SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing x-api-key")
    if not req.scenes:
        raise HTTPException(status_code=400, detail="no scenes provided")

    w, h = (1280, 720) if req.aspectRatio == "16:9" else (720, 1280)
    try:
        mp4 = build_video(req.scenes, w, h, req.fps)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"stitch failed: {e}")

    return Response(
        content=mp4,
        media_type="video/mp4",
        headers={"x-engine": "ffmpeg"},
    )


# ─── Full async pipeline (free + reliable) ────────────────────────────────
# The Supabase edge function only kicks this off and returns immediately, so it
# can't be killed mid-render by the function wall-clock limit. This endpoint does
# the whole job — render → narrate (Gemini for note-less decks) → stitch — in a
# background task and writes progress + the finished MP4 back to Supabase itself.

class BuildModuleRequest(BaseModel):
    moduleId: str
    jobId: str
    pptxUrl: str
    supabaseUrl: str
    supabaseServiceKey: str
    speakerNotes: list[dict] = []
    narrationLanguage: str = "en"
    narrationVoiceDescription: str | None = None
    geminiApiKey: str | None = None
    deckTitle: str = "Lesson"
    dpi: int = 150
    bucket: str = "module-files"


def _http(method: str, url: str, headers: dict, data: bytes | None = None, timeout: int = 120):
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def _looks_markup(s: str) -> bool:
    return bool(re.search(r"</?(?:a|p|w|r|c):[a-z]", s or "", re.I))


def _sanitize(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s or "")).strip()


def _sb_upload(sb: str, key: str, bucket: str, path: str, data: bytes, ctype: str) -> str:
    status, body = _http(
        "POST", f"{sb}/storage/v1/object/{bucket}/{path}",
        {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": ctype, "x-upsert": "true"},
        data, timeout=120,
    )
    if status not in (200, 201):
        raise RuntimeError(f"upload {path} failed [{status}]: {body[:150]}")
    return f"{sb}/storage/v1/object/public/{bucket}/{path}"


def _sb_job_update(sb: str, key: str, job_id: str, fields: dict) -> None:
    _http(
        "PATCH", f"{sb}/rest/v1/video_generation_jobs?id=eq.{job_id}",
        {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=minimal"},
        json.dumps(fields).encode(), timeout=30,
    )


def _sb_upsert(sb: str, key: str, table: str, on_conflict: str, row: dict) -> None:
    _http(
        "POST", f"{sb}/rest/v1/{table}?on_conflict={on_conflict}",
        {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
         "Prefer": "resolution=merge-duplicates,return=minimal"},
        json.dumps(row).encode(), timeout=30,
    )


def _gemini_narrate(api_key: str, deck_title: str, slide_texts: list[str]) -> list[str]:
    lst = "\n\n".join(
        f"[{i + 1}] {t.strip() if t and t.strip() else '(no text on this slide)'}"
        for i, t in enumerate(slide_texts)
    )
    system = (
        "You are an expert instructor writing voice-over narration for an educational "
        "slide video. For each slide, write natural SPOKEN narration that explains and "
        "teaches the idea to a learner — do NOT just read the on-screen text. 2 to 4 "
        "sentences per slide. Plain prose only (a TTS engine will speak it): no markdown, "
        "no bullet characters, no emojis, no raw code symbols; describe code in words. "
        "Let each slide flow naturally from the previous one."
    )
    user = (
        f"Deck title: {deck_title}\n\nText extracted from each slide:\n\n{lst}\n\n"
        f"Write exactly {len(slide_texts)} narrations, one per slide, in order."
    )
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"parts": [{"text": user}]}],
        "generationConfig": {
            "temperature": 0.6,
            "responseMimeType": "application/json",
            "responseSchema": {"type": "ARRAY", "items": {"type": "STRING"}},
        },
    }
    status, b = _http(
        "POST",
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
        {"Content-Type": "application/json"}, json.dumps(body).encode(), timeout=120,
    )
    if status != 200:
        raise RuntimeError(f"gemini [{status}]: {b[:200]}")
    txt = json.loads(b).get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    arr = json.loads(txt)
    return [_sanitize(str(x or "")) for x in arr] if isinstance(arr, list) else []


def _build_module(req: BuildModuleRequest) -> None:
    sb, key = req.supabaseUrl.rstrip("/"), req.supabaseServiceKey

    def jobset(**fields):
        try:
            _sb_job_update(sb, key, req.jobId, fields)
        except Exception as e:
            print("job update failed:", e)

    try:
        jobset(status="processing", progress=5, current_step="Rendering slides...")
        with tempfile.TemporaryDirectory() as d:
            pptx = os.path.join(d, "deck.pptx")
            _download(req.pptxUrl, pptx)
            pdf = _pptx_to_pdf(pptx, d)
            prefix = os.path.join(d, "slide")
            p = subprocess.run(["pdftoppm", "-png", "-r", str(req.dpi), pdf, prefix],
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180)
            if p.returncode != 0:
                raise RuntimeError((p.stderr.decode() or "pdftoppm failed")[:300])
            pngs = sorted(glob.glob(prefix + "*.png"),
                          key=lambda x: int("".join(filter(str.isdigit, os.path.basename(x))) or 0))
            if not pngs:
                raise RuntimeError("no slides rendered")

            texts: list[str] = []
            tpath = os.path.join(d, "deck.txt")
            tp = subprocess.run(["pdftotext", "-layout", pdf, tpath],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120)
            if tp.returncode == 0 and os.path.exists(tpath):
                raw = open(tpath, encoding="utf-8", errors="ignore").read()
                texts = [" ".join(pg.split()) for pg in raw.split("\f")]
            n = len(pngs)
            texts = (texts + [""] * n)[:n]

            jobset(scene_total=n, progress=15, current_step="Uploading slides...")
            image_urls: list[str] = []
            for i, f in enumerate(pngs):
                with open(f, "rb") as fh:
                    image_urls.append(_sb_upload(sb, key, req.bucket,
                                                 f"video-gen/{req.moduleId}/slide-{i + 1}.png",
                                                 fh.read(), "image/png"))
            _sb_upsert(sb, key, "module_outputs", "module_id,format_type",
                       {"module_id": req.moduleId, "format_type": "slide_images",
                        "content": {"images": image_urls, "texts": texts}, "status": "completed"})

            # Narration text per slide: clean speaker note wins; else Gemini from
            # slide text; else raw slide text.
            notes_by: dict[int, str] = {}
            for i, nt in enumerate(req.speakerNotes or []):
                sidx = nt.get("slideNumber") or i + 1
                if nt.get("text"):
                    notes_by[sidx] = nt["text"]
            narrations = [""] * n
            need: list[int] = []
            for i in range(n):
                note = notes_by.get(i + 1, "")
                if note and not _looks_markup(note):
                    narrations[i] = _sanitize(note)
                else:
                    need.append(i)
            if need:
                gen: list[str] = []
                if req.geminiApiKey:
                    jobset(progress=25, current_step="Writing narration script...")
                    try:
                        gen = _gemini_narrate(req.geminiApiKey, req.deckTitle, [_sanitize(texts[i]) for i in need])
                    except Exception as e:
                        print("gemini failed:", e)
                        gen = []
                for k, idx in enumerate(need):
                    narrations[idx] = (gen[k] if k < len(gen) and gen[k] else _sanitize(texts[idx])).strip()

            jobset(progress=30, current_step="Generating narration...")
            voice = pick_voice(VoiceRequest(text="x", language=req.narrationLanguage,
                                            voice_description=req.narrationVoiceDescription))
            rate = STYLE_RATE.get("narration", "-5%")
            scenes: list[Scene] = []
            for i in range(n):
                nar = narrations[i]
                jobset(progress=30 + int((i / max(n, 1)) * 50), scene_completed=i,
                       current_step=f"Narrating slide {i + 1} of {n}...")
                if not nar:
                    scenes.append(Scene(imageUrl=image_urls[i], audioUrl=None, duration=5))
                    continue
                try:
                    mp3 = asyncio.run(synth_mp3(nar[:4000], voice, rate))
                    wav = mp3_to_wav(mp3)
                except Exception as e:
                    print(f"tts failed slide {i + 1}:", e)
                    scenes.append(Scene(imageUrl=image_urls[i], audioUrl=None, duration=5))
                    continue
                au = _sb_upload(sb, key, req.bucket,
                                f"video-gen/{req.moduleId}/slide-{i + 1}-audio.wav", wav, "audio/wav")
                _sb_upsert(sb, key, "module_slide_audio", "module_id,slide_number",
                           {"module_id": req.moduleId, "slide_number": i + 1, "narration_text": nar,
                            "audio_url": au, "audio_duration": max(4, len(nar) // 15),
                            "audio_status": "completed", "voice_id": "edge-tts"})
                scenes.append(Scene(imageUrl=image_urls[i], audioUrl=au, duration=max(4, len(nar) // 15)))

            jobset(progress=85, scene_completed=n, current_step="Stitching final video...")
            mp4 = build_video(scenes, 1280, 720, 10)
            vurl = _sb_upload(sb, key, req.bucket, f"video-gen/{req.moduleId}/output.mp4", mp4, "video/mp4")

            jobset(status="completed", progress=100, current_step="Done", output_video_url=vurl)
            _sb_upsert(sb, key, "module_outputs", "module_id,format_type",
                       {"module_id": req.moduleId, "format_type": "video",
                        "content": {"url": vurl}, "status": "completed", "video_url": vurl})
    except Exception as e:
        print("build_module failed:", e)
        jobset(status="failed", error_message=str(e)[:480])


@app.post("/build-module")
def build_module(req: BuildModuleRequest, x_api_key: str = Header(default="")):
    if not SHARED_SECRET or x_api_key != SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing x-api-key")
    if not req.moduleId or not req.jobId or not req.pptxUrl or not req.supabaseServiceKey:
        raise HTTPException(status_code=400, detail="moduleId, jobId, pptxUrl, supabaseServiceKey required")
    # Detached daemon thread, NOT a FastAPI BackgroundTask: it must survive the
    # HTTP request lifecycle. HF closes the connection right after this 202, which
    # would kill a request-bound BackgroundTask mid-stitch. A thread keeps running
    # in the container until the job finishes.
    threading.Thread(target=_build_module, args=(req,), daemon=True).start()
    return {"status": "accepted", "jobId": req.jobId}
