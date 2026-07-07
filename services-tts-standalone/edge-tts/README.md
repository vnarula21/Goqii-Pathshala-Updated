---
title: Pathshala TTS
emoji: 🔊
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Pathshala TTS (edge-tts)

Free Microsoft neural TTS — **no API key, no credit card, no GPU**. Indian English +
Hindi voices. Implements the contract the app's edge functions already call:

```
POST /generate-voice
headers: x-api-key: <TTS_SHARED_SECRET>
body:    { "text": "...", "language": "en"|"hi", "style": "narration", "voice_description"?: "..." }
returns: audio/wav
GET  /health
```

`generate-voice`, `generate-audio`, and `convert-ppt-to-video` all POST to
`${TTS_SERVICE_URL}/generate-voice` — point that env var here and the whole app
(interactive-PPT narration **and** AI video generation) uses this service.

## Deploy free on Hugging Face Spaces (no card)

1. Create a new Space → **SDK: Docker** → make it **Public**.
2. Add `Dockerfile`, `app.py`, `requirements.txt`, and this `README.md` (the YAML header
   above tells HF to expose port 7860).
3. Space → **Settings → Secrets** → add `TTS_SHARED_SECRET` = a long random string.
4. Wait for the build; your URL is `https://<user>-<space>.hf.space`.

> Free Spaces sleep after long idle and wake on the next request (a few seconds cold start).

## Wire into the app (Supabase / Lovable Cloud secrets)

```
TTS_SERVICE_URL   = https://<user>-<space>.hf.space
TTS_SHARED_SECRET = <the same long random secret>
```

Deploy the edge functions that use it:

```bash
supabase functions deploy generate-voice
supabase functions deploy generate-audio
supabase functions deploy convert-ppt-to-video
```

## Test

```bash
curl -X POST https://<user>-<space>.hf.space/generate-voice \
  -H "x-api-key: <secret>" -H "Content-Type: application/json" \
  -d '{"text":"Welcome to Pathshala.","language":"en","style":"narration"}' \
  --output sample.wav
```

Then in the app, open the **TTS Service Test** page and click **Generate audio**.
