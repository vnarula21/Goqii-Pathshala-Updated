-- user_has_organization was used starting in migration 20260120095650 but was
-- never defined by any migration (created directly via dashboard/SQL editor
-- on the source project, same as system_ai_settings). Recreated here with the
-- same membership-check logic as public.user_in_org.

CREATE OR REPLACE FUNCTION public.user_has_organization(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id
  );
$$;
