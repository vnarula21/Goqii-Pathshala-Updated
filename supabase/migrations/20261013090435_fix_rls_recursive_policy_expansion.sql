-- Root cause of the statement timeouts: RLS policies on modules, course_modules,
-- module_assignments, module_slide_audio etc. queried each other directly, so every
-- query re-expanded the whole policy chain (thousands of sub-plans; reading
-- module_slide_audio took ~30s against an 8s authenticated timeout).
-- Fix: cross-table lookups live in SECURITY DEFINER helper functions that read the
-- base tables without re-applying RLS. Access rules are unchanged (verified: identical
-- visible rows for every user before/after). Already applied to the live project.

create or replace function public.is_module_owner(_mid uuid, _uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.modules where id = _mid and user_id = _uid) $$;

create or replace function public.learner_assigned_module(_mid uuid, _uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.course_modules cm join public.course_assignments ca on ca.course_id = cm.course_id
                 where cm.module_id = _mid and ca.user_id = _uid) $$;

create or replace function public.learner_assigned_course(_cid uuid, _uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.course_assignments ca where ca.course_id = _cid and ca.user_id = _uid) $$;

create or replace function public.module_in_published_course(_mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.course_modules cm join public.courses c on c.id = cm.course_id
                 where cm.module_id = _mid and c.is_published = true) $$;

create or replace function public.course_is_published(_cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courses c where c.id = _cid and c.is_published = true) $$;

create or replace function public.course_is_owned_by(_cid uuid, _uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courses c where c.id = _cid and c.user_id = _uid) $$;

create or replace function public.user_in_private_org(_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_organizations uo join public.organizations o on o.id = uo.organization_id
                 where uo.user_id = _uid and o.access_type = 'private') $$;

create or replace function public.user_in_any_org(_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_organizations uo where uo.user_id = _uid) $$;

create or replace function public.manager_can_see_course(_cid uuid, _uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courses c where c.id = _cid and c.is_published = true and
    ((c.visibility = 'private' and public.user_in_private_org(_uid)) or (c.visibility = 'public' and public.user_in_any_org(_uid)))) $$;

create or replace function public.manager_can_see_module_via_course(_mid uuid, _uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.course_modules cm join public.courses c on c.id = cm.course_id
    where cm.module_id = _mid and c.is_published = true and
    ((c.visibility = 'private' and public.user_in_private_org(_uid)) or (c.visibility = 'public' and public.user_in_any_org(_uid)))) $$;

revoke all on function public.is_module_owner(uuid,uuid), public.learner_assigned_module(uuid,uuid), public.learner_assigned_course(uuid,uuid),
  public.module_in_published_course(uuid), public.course_is_published(uuid), public.course_is_owned_by(uuid,uuid),
  public.user_in_private_org(uuid), public.user_in_any_org(uuid), public.manager_can_see_course(uuid,uuid),
  public.manager_can_see_module_via_course(uuid,uuid) from public, anon;
grant execute on function public.is_module_owner(uuid,uuid), public.learner_assigned_module(uuid,uuid), public.learner_assigned_course(uuid,uuid),
  public.module_in_published_course(uuid), public.course_is_published(uuid), public.course_is_owned_by(uuid,uuid),
  public.user_in_private_org(uuid), public.user_in_any_org(uuid), public.manager_can_see_course(uuid,uuid),
  public.manager_can_see_module_via_course(uuid,uuid) to authenticated, service_role;

alter policy "View modules (combined, short-circuited)" on public.modules using (
  ((select auth.uid()) = user_id)
  or public.has_role((select auth.uid()), 'admin'::app_role)
  or public.has_role((select auth.uid()), 'sme'::app_role)
  or public.has_role((select auth.uid()), 'sme_expert'::app_role)
  or (public.has_role((select auth.uid()), 'manager'::app_role) and approval_status = 'approved' and is_published = true
      and (public.user_in_private_org((select auth.uid())) or (visibility = 'public' and public.user_in_any_org((select auth.uid())))))
  or (public.has_role((select auth.uid()), 'manager'::app_role) and public.manager_can_see_module_via_course(id, (select auth.uid())))
  or (public.has_role((select auth.uid()), 'learner'::app_role) and public.learner_assigned_module(id, (select auth.uid())))
);

alter policy "Learners can view modules from assigned courses" on public.course_modules using (
  public.has_role((select auth.uid()), 'learner'::app_role) and public.learner_assigned_course(course_id, (select auth.uid())));
alter policy "Managers can view course modules based on org access" on public.course_modules using (
  public.has_role((select auth.uid()), 'manager'::app_role) and public.manager_can_see_course(course_id, (select auth.uid())));
alter policy "SME Expert can view course modules" on public.course_modules using (
  public.has_role((select auth.uid()), 'sme_expert'::app_role) and public.course_is_published(course_id));
alter policy "Users can view modules in their courses" on public.course_modules using (
  public.course_is_owned_by(course_id, (select auth.uid())));

alter policy "Learners can view assignments in assigned courses" on public.module_assignments using (
  public.has_role((select auth.uid()), 'learner'::app_role) and public.learner_assigned_module(module_id, (select auth.uid())));
alter policy "Managers can view assignments in accessible courses" on public.module_assignments using (
  public.has_role((select auth.uid()), 'manager'::app_role) and public.module_in_published_course(module_id));
alter policy "SMEs can view assignments for own modules" on public.module_assignments using (
  public.is_module_owner(module_id, (select auth.uid())));

alter policy "Users can view tags for their own modules" on public.module_tags using (
  public.is_module_owner(module_id, (select auth.uid())));

alter policy "Manage own slide audio (SME/admin)" on public.module_slide_audio
  using (public.has_role((select auth.uid()), 'admin'::app_role) or public.is_module_owner(module_id, (select auth.uid())))
  with check (public.has_role((select auth.uid()), 'admin'::app_role) or public.is_module_owner(module_id, (select auth.uid())));
alter policy "View slide audio (combined, short-circuited)" on public.module_slide_audio using (
  public.has_role((select auth.uid()), 'admin'::app_role)
  or public.has_role((select auth.uid()), 'sme_expert'::app_role)
  or public.is_module_owner(module_id, (select auth.uid()))
  or (public.has_role((select auth.uid()), 'learner'::app_role) and public.learner_assigned_module(module_id, (select auth.uid())))
  or (public.has_role((select auth.uid()), 'manager'::app_role) and public.module_in_published_course(module_id)));

alter policy "View video jobs (combined, short-circuited)" on public.video_generation_jobs using (
  public.has_role((select auth.uid()), 'admin'::app_role) or public.is_module_owner(module_id, (select auth.uid())));
