// Public endpoint: "Forgot password" for every role.
//
// Generates a one-time recovery token for the given email and emails the user
// a link to /reset-password in OUR app (the reset page exchanges the token when
// the user submits a new password, so email link-scanners that pre-open links
// cannot burn it).
//
// Always answers { success: true } whether or not the email exists, so it
// cannot be used to discover which emails have accounts.
//
// Requires secrets: APP_URL + the SMTP_* secrets (see _shared/email.ts).
// The link host comes from APP_URL only - never from the request - so a caller
// cannot make us email a victim a link to a hostile site.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { appUrl, passwordResetEmail, sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Best-effort per-instance throttle: one reset email per address per minute.
const lastSent = new Map<string, number>();
const THROTTLE_MS = 60_000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let email = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Please enter a valid email address" }, 400);
  }

  // From here on, always return the same generic success response.
  const generic = json({ success: true });

  try {
    const base = appUrl();
    if (!base) {
      console.error("request-password-reset: APP_URL secret is not set; no email sent");
      return generic;
    }

    const now = Date.now();
    const prev = lastSent.get(email);
    if (prev && now - prev < THROTTLE_MS) return generic;
    lastSent.set(email, now);
    if (lastSent.size > 5000) lastSent.clear();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
    if (error || !data?.user || !data.properties?.hashed_token) {
      // Unknown email (or other failure): say nothing different.
      return generic;
    }

    // Deactivated accounts must not be able to reset their way back in.
    const { data: profile } = await admin
      .from("profiles")
      .select("is_active, full_name")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile && profile.is_active === false) return generic;

    const link =
      `${base}/reset-password?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`;
    const fullName =
      profile?.full_name || (data.user.user_metadata?.full_name as string | undefined) || "";

    const result = await sendEmail(passwordResetEmail({ to: email, fullName, link }));
    if (!result.sent) {
      console.error(`request-password-reset: email to ${email} failed: ${result.error}`);
    }
  } catch (err) {
    console.error("request-password-reset: unexpected error", err);
  }

  return generic;
});
