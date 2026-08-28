-- modules.thumbnail_url already existed in the live database (same
-- orphaned-column pattern as system_ai_settings, completion_days, etc. -
-- added directly via SQL editor at some point, never captured as a
-- migration, and never actually used anywhere in the app until now).
-- Formalizing it here since we're building the actual thumbnail feature on
-- top of it.
ALTER TABLE public.modules
ADD COLUMN IF NOT EXISTS thumbnail_url text;
