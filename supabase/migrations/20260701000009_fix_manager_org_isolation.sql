-- SECURITY FIX: managers could see EVERY learner's profile, course progress,
-- and assessment submissions across ALL organizations, not just their own.
--
-- profiles: "Managers can view learner profiles" had no org check at all,
-- and since RLS policies combine with OR, it silently overrode the
-- correctly org-scoped "Managers can view profiles of learners in their
-- organization" policy that already existed alongside it - so that scoped
-- policy was effectively never doing anything.
DROP POLICY IF EXISTS "Managers can view learner profiles" ON public.profiles;

-- course_progress and assessment_submissions had "managers can view ALL"
-- policies with zero organization scoping whatsoever.
DROP POLICY IF EXISTS "Managers can view all course progress" ON public.course_progress;
CREATE POLICY "Managers can view course progress of learners in their organization"
ON public.course_progress
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1
    FROM public.user_organizations learner_org
    JOIN public.user_organizations manager_org
      ON manager_org.organization_id = learner_org.organization_id
    WHERE learner_org.user_id = course_progress.user_id
    AND manager_org.user_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Managers can view all submissions" ON public.assessment_submissions;
CREATE POLICY "Managers can view submissions of learners in their organization"
ON public.assessment_submissions
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1
    FROM public.user_organizations learner_org
    JOIN public.user_organizations manager_org
      ON manager_org.organization_id = learner_org.organization_id
    WHERE learner_org.user_id = assessment_submissions.user_id
    AND manager_org.user_id = auth.uid()
  ))
);

-- Same gap on the UPDATE (grading) side of assessment_submissions - a
-- manager could grade another organization's learner's submission.
DROP POLICY IF EXISTS "Managers can grade submissions" ON public.assessment_submissions;
CREATE POLICY "Managers can grade submissions of learners in their organization"
ON public.assessment_submissions
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1
    FROM public.user_organizations learner_org
    JOIN public.user_organizations manager_org
      ON manager_org.organization_id = learner_org.organization_id
    WHERE learner_org.user_id = assessment_submissions.user_id
    AND manager_org.user_id = auth.uid()
  ))
);

-- module_assignment_submissions: same "view all" / "grade all" gap.
DROP POLICY IF EXISTS "Managers can view all module assignment submissions" ON public.module_assignment_submissions;
CREATE POLICY "Managers can view module assignment submissions in their organization"
ON public.module_assignment_submissions
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1
    FROM public.user_organizations learner_org
    JOIN public.user_organizations manager_org
      ON manager_org.organization_id = learner_org.organization_id
    WHERE learner_org.user_id = module_assignment_submissions.user_id
    AND manager_org.user_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Managers can grade module assignment submissions" ON public.module_assignment_submissions;
CREATE POLICY "Managers can grade module assignment submissions in their organization"
ON public.module_assignment_submissions
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1
    FROM public.user_organizations learner_org
    JOIN public.user_organizations manager_org
      ON manager_org.organization_id = learner_org.organization_id
    WHERE learner_org.user_id = module_assignment_submissions.user_id
    AND manager_org.user_id = auth.uid()
  ))
);

-- learner_levels: a manager could view/assign/update ANY learner's level
-- system-wide, regardless of organization.
DROP POLICY IF EXISTS "Managers can view learner levels" ON public.learner_levels;
CREATE POLICY "Managers can view learner levels in their organization"
ON public.learner_levels
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  (public.has_role(auth.uid(), 'manager') AND EXISTS (
    SELECT 1
    FROM public.user_organizations learner_org
    JOIN public.user_organizations manager_org
      ON manager_org.organization_id = learner_org.organization_id
    WHERE learner_org.user_id = learner_levels.user_id
    AND manager_org.user_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Managers can assign learner levels" ON public.learner_levels;
CREATE POLICY "Managers can assign learner levels in their organization"
ON public.learner_levels
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  (public.has_role(auth.uid(), 'manager') AND EXISTS (
    SELECT 1
    FROM public.user_organizations learner_org
    JOIN public.user_organizations manager_org
      ON manager_org.organization_id = learner_org.organization_id
    WHERE learner_org.user_id = learner_levels.user_id
    AND manager_org.user_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Managers can update learner levels" ON public.learner_levels;
CREATE POLICY "Managers can update learner levels in their organization"
ON public.learner_levels
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  (public.has_role(auth.uid(), 'manager') AND EXISTS (
    SELECT 1
    FROM public.user_organizations learner_org
    JOIN public.user_organizations manager_org
      ON manager_org.organization_id = learner_org.organization_id
    WHERE learner_org.user_id = learner_levels.user_id
    AND manager_org.user_id = auth.uid()
  ))
);
-- course_assignments: "Managers can manage course assignments" covered
-- SELECT/INSERT/UPDATE/DELETE with zero org scoping - a manager could view,
-- create, or delete course assignments for learners in ANY organization.
DROP POLICY IF EXISTS "Managers can manage course assignments" ON public.course_assignments;
CREATE POLICY "Managers can manage course assignments for their organization"
ON public.course_assignments
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1
    FROM public.user_organizations learner_org
    JOIN public.user_organizations manager_org
      ON manager_org.organization_id = learner_org.organization_id
    WHERE learner_org.user_id = course_assignments.user_id
    AND manager_org.user_id = auth.uid()
  ))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  (has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1
    FROM public.user_organizations learner_org
    JOIN public.user_organizations manager_org
      ON manager_org.organization_id = learner_org.organization_id
    WHERE learner_org.user_id = course_assignments.user_id
    AND manager_org.user_id = auth.uid()
  ))
);
