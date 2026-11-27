// Daily job: finds course assignments whose refresher has become due and tells
// the learner (in-app notification + email). Each due cycle is notified once:
// refresher_notified_at is stamped, and a new cycle (a later completion) is
// only notified when completed_at is newer than that stamp.
//
// Called by pg_cron (see migration). Safe to call repeatedly - it is idempotent.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailConfigured, orgNameById, refresherEmail, sendEmails } from "../_shared/email.ts";

const MAX_PER_RUN = 200;

const addMonths = (d: Date, months: number) => {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, lastDay));
  return r;
};

serve(async (_req) => {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

  try {
    const { data: assigns, error } = await admin
      .from("course_assignments")
      .select("id, user_id, course_id, refresher_months, refresher_notified_at")
      .not("refresher_months", "is", null);
    if (error) throw error;
    if (!assigns?.length) return json({ due: 0 });

    const { data: progress, error: pErr } = await admin
      .from("course_progress")
      .select("user_id, course_id, completed_at")
      .eq("is_completed", true)
      .not("completed_at", "is", null);
    if (pErr) throw pErr;
    const completedAt = new Map((progress || []).map((p) => [`${p.user_id}:${p.course_id}`, new Date(p.completed_at)]));

    const now = new Date();
    const due = assigns
      .filter((a) => {
        const done = completedAt.get(`${a.user_id}:${a.course_id}`);
        if (!done) return false;
        if (addMonths(done, a.refresher_months).getTime() > now.getTime()) return false;
        return !a.refresher_notified_at || new Date(a.refresher_notified_at) < done;
      })
      .slice(0, MAX_PER_RUN);
    if (!due.length) return json({ due: 0 });

    const courseIds = [...new Set(due.map((d) => d.course_id))];
    const userIds = [...new Set(due.map((d) => d.user_id))];
    const [{ data: courses }, { data: profiles }, { data: memberships }] = await Promise.all([
      admin.from("courses").select("id, title").in("id", courseIds),
      admin.from("profiles").select("id, email, full_name, is_active").in("id", userIds),
      admin.from("user_organizations").select("user_id, organization_id").in("user_id", userIds),
    ]);
    const title = new Map((courses || []).map((c) => [c.id, c.title as string]));
    const profile = new Map((profiles || []).map((p) => [p.id, p]));
    const orgOf = new Map((memberships || []).map((m) => [m.user_id, m.organization_id]));
    const orgNames = new Map<string, string | undefined>();
    for (const id of new Set(orgOf.values())) orgNames.set(id, await orgNameById(admin, id));

    let notified = 0;
    const emails: { msg: ReturnType<typeof refresherEmail> }[] = [];
    for (const a of due) {
      const pr = profile.get(a.user_id);
      if (!pr || pr.is_active === false) continue;
      const courseTitle = title.get(a.course_id) || "your course";

      const { error: nErr } = await admin.from("notifications").insert({
        user_id: a.user_id,
        type: "refresher_due",
        title: "Refresher due",
        message: `It's time for your refresher on "${courseTitle}". Open your dashboard and click Refresher.`,
        metadata: { course_id: a.course_id },
      });
      if (nErr) { console.error("notification insert failed", nErr); continue; }

      await admin.from("course_assignments").update({ refresher_notified_at: now.toISOString() }).eq("id", a.id);
      notified++;

      if (pr.email) {
        emails.push({
          msg: refresherEmail({
            to: pr.email,
            fullName: pr.full_name || "",
            courseTitle,
            orgName: orgNames.get(orgOf.get(a.user_id) as string),
          }),
        });
      }
    }

    let emailed = 0;
    if (emailConfigured() && emails.length) {
      for (let i = 0; i < emails.length; i += 25) {
        const res = await sendEmails(emails.slice(i, i + 25).map((e) => e.msg));
        res.forEach((r) => { if (r.sent) emailed++; else console.error("refresher email failed:", r.error); });
      }
    }
    return json({ due: due.length, notified, emailed });
  } catch (err) {
    console.error("send-refresher-reminders failed", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
