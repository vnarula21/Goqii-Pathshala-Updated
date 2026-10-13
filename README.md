# GOQii Pathshala

An internal Learning Management System (LMS): SME-authored training modules,
AI-assisted module/quiz/assignment generation, course assembly, learner
progress tracking, certificates, and a role-based review/approval workflow.

## Roles

- **Learner** — takes assigned courses/modules, quizzes, assignments; earns certificates.
- **Manager** — manages learners in their organization, assigns courses, reviews progress.
- **SME** ("Subject Matter Expert") — authors modules via the AI module-creation wizard ("Forge").
- **SME Expert** — reviews and approves/rejects modules submitted by SMEs.
- **Admin** — full access: users, organizations, levels, course groups, all modules/courses.

Role is enforced both client-side (`RoleGuard` on routes) and server-side
(Postgres Row-Level Security policies — see `supabase/migrations/`).

## Architecture

```
┌─────────────────────┐      ┌──────────────────────────┐      ┌─────────────────────┐
│  Frontend            │      │  Supabase (gtenzgvqnfytmxuclthe)│  │  TTS microservice    │
│  React + TS + Vite   │─────▶│  Postgres + Auth + Storage│      │  (edge-tts, Docker)   │
│  shadcn-ui, Tailwind │      │  + Edge Functions (Deno)  │─────▶│  Hugging Face Spaces │
│  deployed on Vercel  │      └──────────────────────────┘      └─────────────────────┘
└─────────────────────┘                    │
                                            ▼
                                   Gemini / ElevenLabs / Runway /
                                   Shotstack (AI content, voice,
                                   and video generation APIs)
```

- **Frontend**: Vite + React + TypeScript, shadcn-ui components, Tailwind CSS,
  React Router, TanStack Query. Deployed on **Vercel** (see `vercel.json`).
- **Backend**: Supabase project `gtenzgvqnfytmxuclthe` — Postgres database
  (schema + RLS policies under `supabase/migrations/`), Supabase Auth, Storage,
  and Deno-based **Edge Functions** (`supabase/functions/`) for anything that
  needs a server-side secret (AI calls, user management, video/audio generation).
- **TTS microservice**: `services-tts-standalone/edge-tts/` is a standalone
  Dockerized FastAPI/edge-tts service (Microsoft neural TTS, no API key
  needed), deployed separately on Hugging Face Spaces. The edge functions
  `generate-voice`, `generate-audio`, and `convert-ppt-to-video` call it over
  HTTP. See that folder's own README for deploy steps.

## AI module-creation pipeline ("Forge")

`src/components/forge/*` + `src/hooks/useModuleForge.tsx` drive a 5-step
wizard that calls these edge functions in sequence:

1. `generate-prompt` — builds the content prompt from the SME's inputs
2. `generate-final-module` — generates the actual module content (slides/doc/article)
3. `generate-quiz` — generates quiz questions for the module
4. `generate-assignments` — generates assignment prompts
5. `generate-single-image` / `generate-slide-images` — AI images per slide

Video-based modules additionally use `convert-ppt-to-video` /
`generate-video-pipeline` + `check-video-render` to turn a narrated slideshow
into an MP4 (via Shotstack/Runway).

## Local development

```sh
npm install
cp .env.example .env.local   # fill in your Supabase project URL + publishable key
npm run dev
```

## Environment variables

**Frontend** (`.env.local`, see `.env.example`):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key (public-safe) |

**Edge Functions** (set as Supabase project secrets — Project Settings →
Edge Functions → Secrets, or `supabase secrets set`):

| Variable | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Auto-provided by Supabase at runtime |
| `GEMINI_API_KEY` | AI text/image generation (module content, quizzes, assignments) |
| `ELEVENLABS_API_KEY` | Alternate voice narration provider |
| `RUNWAY_API_KEY` | AI video generation |
| `SHOTSTACK_API_KEY` | Video rendering/assembly pipeline |
| `TTS_SERVICE_URL` | URL of the deployed edge-tts microservice (Hugging Face Space) |
| `TTS_SHARED_SECRET` | Shared secret between edge functions and the TTS microservice |

## Deployment

- **Frontend**: pushes to the default branch auto-deploy on Vercel (`vercel.json` configures the SPA rewrite + build command).
- **Database/Edge Functions**: managed via the Supabase CLI —
  migrations live in `supabase/migrations/` and apply in filename order;
  functions in `supabase/functions/` deploy individually, e.g.
  `supabase functions deploy generate-final-module`.
- **TTS microservice**: deployed separately — see `services-tts-standalone/edge-tts/README.md`.

## Handing this project off

This repo was cleaned up for handover on 2026-10-13: dead/unused components,
two orphaned edge functions (`format-content`, `generate-content` — both
superseded by `generate-prompt`/`generate-final-module`), stray build
artifacts, and duplicate lockfiles were removed. The database's Row-Level
Security policies were also rewritten for performance (migrations `fix_rls_auth_initplan_perf` and `fix_rls_recursive_policy_expansion`).
Policies on modules/course_modules/module_assignments/module_slide_audio used to
query each other directly, which made Postgres re-expand the policy chain on every
query (slide-audio reads took ~30s and hit the 8s API timeout, so modules wouldn't
open). Cross-table checks now live in SECURITY DEFINER helper functions; when you
add a policy that looks at another RLS-protected table, use a helper, not a subquery.

If you're taking this over:
1. Get access to the Supabase project (`gtenzgvqnfytmxuclthe`, org `aphwwvfzqwbqryknfqqq`) and the Vercel project.
2. Get the edge function secrets listed above (ask the previous owner — they are not in this repo, by design).
3. Run `npm run build` once to confirm your environment matches before changing anything.
