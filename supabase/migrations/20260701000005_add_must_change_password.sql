-- Tracks whether a user must change their password before using the app.
-- Set to true for newly admin/manager-created accounts (they start with a
-- temporary password); existing accounts are left as false so current users
-- aren't suddenly forced to change their password.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
