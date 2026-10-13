-- Policies are evaluated for the anon role too; without EXECUTE, logged-out requests
-- would fail with 42501 instead of returning zero rows (matches existing has_role behaviour).
grant execute on function public.is_module_owner(uuid,uuid), public.learner_assigned_module(uuid,uuid), public.learner_assigned_course(uuid,uuid),
  public.module_in_published_course(uuid), public.course_is_published(uuid), public.course_is_owned_by(uuid,uuid),
  public.user_in_private_org(uuid), public.user_in_any_org(uuid), public.manager_can_see_course(uuid,uuid),
  public.manager_can_see_module_via_course(uuid,uuid) to anon;
