-- Add RLS policies for managers to view/update learner profiles in their organization

-- Allow managers to view profiles of learners in their organization
CREATE POLICY "Managers can view profiles of learners in their organization"
ON public.profiles FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager') AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = profiles.id AND ur.role = 'learner'
  ) AND
  EXISTS (
    SELECT 1 
    FROM public.user_organizations manager_org
    JOIN public.user_organizations learner_org ON manager_org.organization_id = learner_org.organization_id
    WHERE manager_org.user_id = auth.uid() 
    AND learner_org.user_id = profiles.id
  )
);

-- Allow managers to update profiles of learners in their organization
CREATE POLICY "Managers can update profiles of learners in their organization"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager') AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = profiles.id AND ur.role = 'learner'
  ) AND
  EXISTS (
    SELECT 1 
    FROM public.user_organizations manager_org
    JOIN public.user_organizations learner_org ON manager_org.organization_id = learner_org.organization_id
    WHERE manager_org.user_id = auth.uid() 
    AND learner_org.user_id = profiles.id
  )
);

-- Allow managers to view learner_levels for learners in their organization
CREATE POLICY "Managers can view learner_levels in their organization"
ON public.learner_levels FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager') AND
  EXISTS (
    SELECT 1 
    FROM public.user_organizations manager_org
    JOIN public.user_organizations learner_org ON manager_org.organization_id = learner_org.organization_id
    WHERE manager_org.user_id = auth.uid() 
    AND learner_org.user_id = learner_levels.user_id
  )
);

-- Allow managers to insert/update learner_levels for learners in their organization
CREATE POLICY "Managers can manage learner_levels in their organization"
ON public.learner_levels FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'manager') AND
  EXISTS (
    SELECT 1 
    FROM public.user_organizations manager_org
    JOIN public.user_organizations learner_org ON manager_org.organization_id = learner_org.organization_id
    WHERE manager_org.user_id = auth.uid() 
    AND learner_org.user_id = learner_levels.user_id
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'manager') AND
  EXISTS (
    SELECT 1 
    FROM public.user_organizations manager_org
    JOIN public.user_organizations learner_org ON manager_org.organization_id = learner_org.organization_id
    WHERE manager_org.user_id = auth.uid() 
    AND learner_org.user_id = learner_levels.user_id
  )
);

-- NOTE: "Managers can view user_organizations in their organization" is created
-- by migration 20260109091459_fix_user_organizations_recursion.sql, which runs
-- before this one and uses a SECURITY DEFINER function to avoid infinite
-- recursion. Not recreated here to avoid overwriting it with the naive
-- (recursive) version that originally caused that bug.