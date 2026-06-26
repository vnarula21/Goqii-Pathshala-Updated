-- Fix infinite recursion in user_organizations RLS.
-- The "Managers can view user_organizations" policy selected from
-- user_organizations inside a policy ON user_organizations -> 42P17 recursion,
-- which cascaded to every table whose RLS references org membership
-- (modules, video_generation_jobs, ...). Move the lookup into a SECURITY DEFINER
-- function so it bypasses RLS.
create or replace function public.user_in_org(_uid uuid, _org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $func$
  select exists(
    select 1 from public.user_organizations
    where user_id = _uid and organization_id = _org
  );
$func$;

drop policy if exists "Managers can view user_organizations in their organization" on public.user_organizations;
create policy "Managers can view user_organizations in their organization"
  on public.user_organizations for select to authenticated
  using (
    has_role(auth.uid(), 'manager'::app_role)
    and public.user_in_org(auth.uid(), organization_id)
  );
