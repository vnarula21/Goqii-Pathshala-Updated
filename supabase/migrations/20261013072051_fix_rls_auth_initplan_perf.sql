-- Wrap auth.uid()/auth.role()/auth.jwt() in RLS policy expressions in a scalar
-- subquery so Postgres evaluates them once per query instead of once per row.
-- Performance only; access rules unchanged. Already applied to the live project.
DO $$
DECLARE
  pol record; new_qual text; new_check text; alter_sql text;
BEGIN
  FOR pol IN SELECT schemaname, tablename, policyname, qual, with_check FROM pg_policies WHERE schemaname = 'public'
  LOOP
    new_qual := pol.qual; new_check := pol.with_check;
    IF new_qual IS NOT NULL AND new_qual ~ '\mauth\.(uid|role|jwt)\(\)' AND new_qual !~ '\( ?SELECT auth\.' THEN
      new_qual := regexp_replace(new_qual, '\mauth\.uid\(\)', '(SELECT auth.uid())', 'g');
      new_qual := regexp_replace(new_qual, '\mauth\.role\(\)', '(SELECT auth.role())', 'g');
      new_qual := regexp_replace(new_qual, '\mauth\.jwt\(\)', '(SELECT auth.jwt())', 'g');
    END IF;
    IF new_check IS NOT NULL AND new_check ~ '\mauth\.(uid|role|jwt)\(\)' AND new_check !~ '\( ?SELECT auth\.' THEN
      new_check := regexp_replace(new_check, '\mauth\.uid\(\)', '(SELECT auth.uid())', 'g');
      new_check := regexp_replace(new_check, '\mauth\.role\(\)', '(SELECT auth.role())', 'g');
      new_check := regexp_replace(new_check, '\mauth\.jwt\(\)', '(SELECT auth.jwt())', 'g');
    END IF;
    IF (new_qual IS DISTINCT FROM pol.qual) OR (new_check IS DISTINCT FROM pol.with_check) THEN
      alter_sql := format('ALTER POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
      IF new_qual IS NOT NULL THEN alter_sql := alter_sql || format(' USING (%s)', new_qual); END IF;
      IF new_check IS NOT NULL THEN alter_sql := alter_sql || format(' WITH CHECK (%s)', new_check); END IF;
      EXECUTE alter_sql;
    END IF;
  END LOOP;
END $$;
