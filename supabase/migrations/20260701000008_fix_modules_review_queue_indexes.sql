-- The SME review queue introduced queries filtering/sorting by reviewed_by,
-- submitted_for_review_at, and reviewed_at, but modules had no index on
-- reviewed_by at all. Combined with the already-complex RLS policy chain on
-- modules, this caused the same class of "statement timeout" (57014) we saw
-- before on other tables, once there was enough real data for the planner to
-- pick a bad nested-loop plan.

CREATE INDEX IF NOT EXISTS idx_modules_reviewed_by ON public.modules(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_modules_submitted_for_review_at ON public.modules(submitted_for_review_at);
CREATE INDEX IF NOT EXISTS idx_modules_reviewed_at ON public.modules(reviewed_at);

-- Refresh planner statistics now that there's real data, so it picks good
-- plans using these new indexes right away instead of stale zero-row stats.
ANALYZE public.modules;
ANALYZE public.video_generation_jobs;
ANALYZE public.module_slide_audio;
