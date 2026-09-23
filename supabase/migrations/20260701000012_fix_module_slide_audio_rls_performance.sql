-- module_slide_audio had 5 separate SELECT-applicable policies (SME-own,
-- admin, sme_expert, learner-via-course-assignment, manager-via-published-
-- course). Postgres combines multiple permissive policies with OR but does
-- NOT guarantee it evaluates the cheap ones first and skips the expensive
-- ones - it can end up running the learner/manager policies' nested joins
-- (course_modules JOIN course_assignments/courses) even for an admin whose
-- request could have been satisfied by the single cheap has_role() check.
-- This caused statement timeouts even for admin/SME accounts as the data
-- grew. Combining into ONE policy with a single boolean expression, cheap
-- checks first, forces genuine short-circuit evaluation.

DROP POLICY IF EXISTS "SMEs can manage audio for own modules" ON public.module_slide_audio;
DROP POLICY IF EXISTS "Admins can manage all slide audio" ON public.module_slide_audio;
DROP POLICY IF EXISTS "SME Experts can view all slide audio" ON public.module_slide_audio;
DROP POLICY IF EXISTS "Learners can read slide audio for assigned courses" ON public.module_slide_audio;
DROP POLICY IF EXISTS "Managers can view slide audio" ON public.module_slide_audio;

CREATE POLICY "View slide audio (combined, short-circuited)"
ON public.module_slide_audio
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sme_expert'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.modules m
    WHERE m.id = module_slide_audio.module_id AND m.user_id = auth.uid()
  )
  OR (
    has_role(auth.uid(), 'learner'::app_role) AND EXISTS (
      SELECT 1 FROM public.course_modules cm
      JOIN public.course_assignments ca ON ca.course_id = cm.course_id
      WHERE cm.module_id = module_slide_audio.module_id AND ca.user_id = auth.uid()
    )
  )
  OR (
    has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM public.course_modules cm
      JOIN public.courses c ON c.id = cm.course_id
      WHERE cm.module_id = module_slide_audio.module_id AND c.is_published = true
    )
  )
);

CREATE POLICY "Manage own slide audio (SME/admin)"
ON public.module_slide_audio
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.modules m
    WHERE m.id = module_slide_audio.module_id AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.modules m
    WHERE m.id = module_slide_audio.module_id AND m.user_id = auth.uid()
  )
);

ANALYZE public.module_slide_audio;

-- modules table had SEVEN separate SELECT policies (own, admin, sme, sme_expert,
-- and three different manager/learner variants each with deep nested joins
-- through course_modules/courses/user_organizations/organizations). Same
-- problem as above, at a larger scale - this is the table the console errors
-- showed failing the most. Combining into one short-circuited policy so an
-- admin or SME's simple has_role() check is satisfied immediately instead of
-- Postgres potentially still running the expensive manager/learner subqueries.

DROP POLICY IF EXISTS "SMEs can view all modules" ON public.modules;
DROP POLICY IF EXISTS "Admins can view all modules" ON public.modules;
DROP POLICY IF EXISTS "Users can view own modules" ON public.modules;
DROP POLICY IF EXISTS "SME Expert can view all modules" ON public.modules;
DROP POLICY IF EXISTS "Managers can view modules based on org access" ON public.modules;
DROP POLICY IF EXISTS "Managers can view modules in accessible courses" ON public.modules;
DROP POLICY IF EXISTS "Learners can view modules in assigned courses" ON public.modules;

CREATE POLICY "View modules (combined, short-circuited)"
ON public.modules
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sme'::app_role)
  OR has_role(auth.uid(), 'sme_expert'::app_role)
  OR (
    has_role(auth.uid(), 'manager'::app_role)
    AND approval_status = 'approved'
    AND is_published = true
    AND (
      EXISTS (
        SELECT 1 FROM public.user_organizations uo
        JOIN public.organizations o ON uo.organization_id = o.id
        WHERE uo.user_id = auth.uid() AND o.access_type = 'private'
      )
      OR (
        visibility = 'public'
        AND EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid())
      )
    )
  )
  OR (
    has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM public.course_modules cm
      JOIN public.courses c ON c.id = cm.course_id
      WHERE cm.module_id = modules.id
      AND c.is_published = true
      AND (
        (c.visibility = 'private' AND EXISTS (
          SELECT 1 FROM public.user_organizations uo
          JOIN public.organizations o ON uo.organization_id = o.id
          WHERE uo.user_id = auth.uid() AND o.access_type = 'private'
        ))
        OR
        (c.visibility = 'public' AND EXISTS (
          SELECT 1 FROM public.user_organizations uo WHERE uo.user_id = auth.uid()
        ))
      )
    )
  )
  OR (
    has_role(auth.uid(), 'learner'::app_role) AND EXISTS (
      SELECT 1 FROM public.course_modules cm
      JOIN public.course_assignments ca ON ca.course_id = cm.course_id
      WHERE cm.module_id = modules.id AND ca.user_id = auth.uid()
    )
  )
);

ANALYZE public.modules;

