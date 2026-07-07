-- Systematic audit of all foreign key columns across the schema found these
-- missing indexes (learner_levels excluded since that table was dropped in
-- migration 20260116062731). These support common lookups (a user's
-- notifications, their submissions, their certificates, etc.) and prevent
-- sequential scans as data grows.

CREATE INDEX IF NOT EXISTS idx_assessment_submissions_course_id ON public.assessment_submissions(course_id);
CREATE INDEX IF NOT EXISTS idx_assessment_submissions_graded_by ON public.assessment_submissions(graded_by);
CREATE INDEX IF NOT EXISTS idx_assessment_submissions_user_id ON public.assessment_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_created_by ON public.assessments(created_by);
CREATE INDEX IF NOT EXISTS idx_certificates_course_id ON public.certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_course_assessments_assessment_id ON public.course_assessments(assessment_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_module_id ON public.course_modules(module_id);
CREATE INDEX IF NOT EXISTS idx_course_progress_course_id ON public.course_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_levels_created_by ON public.levels(created_by);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_course_settings_course_id ON public.organization_course_settings(course_id);
CREATE INDEX IF NOT EXISTS idx_organization_course_settings_module_id ON public.organization_course_settings(module_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON public.user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_certificates_certificate_id ON public.user_certificates(certificate_id);
CREATE INDEX IF NOT EXISTS idx_user_certificates_course_id ON public.user_certificates(course_id);
