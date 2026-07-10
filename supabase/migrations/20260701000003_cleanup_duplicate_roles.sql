-- The create-user function had a bug (fixed in code) where every non-learner
-- user ended up with TWO rows in user_roles: an auto-assigned 'learner' role
-- from the signup trigger, plus their real role (manager/sme/etc). This
-- caused managers/SMEs to incorrectly show up in learner lists. Clean up any
-- existing duplicates: if a user has more than one role, remove 'learner'
-- and keep their real (non-learner) role.

DELETE FROM public.user_roles
WHERE role = 'learner'
AND user_id IN (
  SELECT user_id
  FROM public.user_roles
  GROUP BY user_id
  HAVING COUNT(*) > 1
);
