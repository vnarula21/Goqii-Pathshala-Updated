-- get_user_role omitted sme_expert from its priority CASE, so users with
-- [learner, sme_expert] resolved to learner (sme_expert -> NULL sorts last).
-- Include every role so elevated roles always win over the default learner.
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'sme_expert' THEN 2
    WHEN 'manager' THEN 3
    WHEN 'sme' THEN 4
    WHEN 'learner' THEN 5
    ELSE 100 END
  LIMIT 1
$function$;
