-- These tables are queried inside RLS policies dozens of times per request
-- (has_role, user_in_org, user_has_organization, and various EXISTS checks),
-- but had no supporting indexes, forcing repeated sequential scans. This was
-- the root cause of intermittent "statement timeout" errors even with almost
-- no data in the tables. Adding indexes here keeps these lookups fast
-- regardless of how much data accumulates.

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);
CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id ON public.user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_organization_id ON public.user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_module_id ON public.video_generation_jobs(module_id);
CREATE INDEX IF NOT EXISTS idx_course_assignments_user_id ON public.course_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_user_id ON public.courses(user_id);
