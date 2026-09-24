-- video_generation_jobs had the same fragmented-policy issue: "Module owners
-- can view their video jobs" (an EXISTS subquery back into modules, itself
-- subject to modules' own RLS) as a SEPARATE permissive policy from "Admins
-- can manage all video jobs" (a single cheap has_role check). Same fix:
-- combine so the cheap admin check is guaranteed to short-circuit first.

DROP POLICY IF EXISTS "Module owners can view their video jobs" ON public.video_generation_jobs;
DROP POLICY IF EXISTS "Admins can manage all video jobs" ON public.video_generation_jobs;

CREATE POLICY "View video jobs (combined, short-circuited)"
ON public.video_generation_jobs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.modules m
    WHERE m.id = video_generation_jobs.module_id AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Admins manage video jobs (insert/update/delete)"
ON public.video_generation_jobs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ANALYZE public.video_generation_jobs;
