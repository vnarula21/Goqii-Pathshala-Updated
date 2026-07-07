-- system_ai_settings was originally created outside migration history
-- (directly via dashboard/SQL editor on the source project) and was never
-- captured as a migration. Later migrations only ALTER this table, so on a
-- fresh project they fail with "relation does not exist". This recreates it
-- with the final schema (reconstructed from src/integrations/supabase/types.ts,
-- which was generated from the live database).

CREATE TABLE IF NOT EXISTS public.system_ai_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ai_mode text NOT NULL DEFAULT 'lovable',
  provider text DEFAULT 'google',
  model text DEFAULT NULL,
  quiz_ai_mode text NOT NULL DEFAULT 'lovable',
  quiz_ai_provider text DEFAULT 'mistral',
  quiz_ai_model text DEFAULT NULL,
  narration_ai_mode text NOT NULL DEFAULT 'lovable',
  narration_ai_provider text DEFAULT 'elevenlabs',
  narration_ai_model text DEFAULT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
