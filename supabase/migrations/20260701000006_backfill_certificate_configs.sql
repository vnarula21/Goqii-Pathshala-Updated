-- New courses now get a certificate config automatically on creation, but
-- courses created before this feature existed have no row in `certificates`
-- at all, so they'd never issue certificates. Backfill one for each,
-- enabled by default, using the course's own passing_score as the threshold.

INSERT INTO public.certificates (course_id, is_enabled, min_passing_score)
SELECT c.id, true, c.passing_score
FROM public.courses c
WHERE NOT EXISTS (
  SELECT 1 FROM public.certificates cert WHERE cert.course_id = c.id
);
