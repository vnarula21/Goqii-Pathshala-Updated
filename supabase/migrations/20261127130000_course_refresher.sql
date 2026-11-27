-- Refresher training (already applied to the live project via the Supabase MCP).
alter table public.course_assignments
  add column if not exists refresher_months smallint
    check (refresher_months is null or refresher_months between 1 and 60),
  add column if not exists refresher_notified_at timestamptz;

create table if not exists public.course_completion_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid not null,
  completed_at timestamptz,
  overall_score numeric,
  archived_at timestamptz not null default now()
);
alter table public.course_completion_history enable row level security;
drop policy if exists "Users can view their own completion history" on public.course_completion_history;
create policy "Users can view their own completion history"
  on public.course_completion_history for select using (user_id = (select auth.uid()));
drop policy if exists "Admins can view all completion history" on public.course_completion_history;
create policy "Admins can view all completion history"
  on public.course_completion_history for select
  using (public.has_role((select auth.uid()), 'admin'::app_role));
create index if not exists course_completion_history_user_course_idx
  on public.course_completion_history (user_id, course_id);

create or replace function public.start_course_refresher(p_course_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  a record;
  p record;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into a from public.course_assignments where user_id = uid and course_id = p_course_id;
  if not found or a.refresher_months is null then raise exception 'No refresher is set for this course'; end if;
  select * into p from public.course_progress where user_id = uid and course_id = p_course_id;
  if not found or not p.is_completed or p.completed_at is null then raise exception 'Course is not completed yet'; end if;
  if p.completed_at + make_interval(months => a.refresher_months) > now() then raise exception 'Refresher is not due yet'; end if;
  insert into public.course_completion_history (user_id, course_id, completed_at, overall_score)
  values (uid, p_course_id, p.completed_at, p.overall_score);
  update public.course_progress
     set is_completed = false, completed_at = null, module_scores = '{}'::jsonb,
         overall_score = null, started_at = now()
   where id = p.id;
end;
$$;
revoke all on function public.start_course_refresher(uuid) from public, anon;
grant execute on function public.start_course_refresher(uuid) to authenticated;

-- Daily 04:00 UTC (09:30 IST) reminder job (applied separately):
-- select cron.schedule('send-refresher-reminders-daily', '0 4 * * *', $$select net.http_post(
--   url := 'https://gtenzgvqnfytmxuclthe.supabase.co/functions/v1/send-refresher-reminders',
--   headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb)$$);
