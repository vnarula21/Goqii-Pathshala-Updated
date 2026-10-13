// Shared email helper for edge functions (welcome emails, password reset).
//
// Sends through any standard SMTP server (Google Workspace, Amazon SES,
// Resend's SMTP endpoint, the company mail server, ...). Configure with
// these Supabase edge-function secrets:
//
//   SMTP_HOST       e.g. smtp.gmail.com / email-smtp.ap-south-1.amazonaws.com
//   SMTP_PORT       465 (implicit TLS) or 587 (STARTTLS). Default 465.
//   SMTP_USER       SMTP username
//   SMTP_PASSWORD   SMTP password / app password / API key
//   SMTP_FROM       sender address, e.g. no-reply@goqii.com
//   SMTP_FROM_NAME  optional display name (default "GOQii Pathshala")
//   APP_URL         public URL of the app, e.g. https://pathshala.goqii.com
//
// If the secrets are missing, sendEmail() returns { sent: false, error } and
// never throws, so callers (user creation) keep working without email.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export interface EmailResult {
  sent: boolean;
  error?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const env = (k: string) => Deno.env.get(k)?.trim() || "";

export function emailConfigured(): boolean {
  return !!(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASSWORD") && env("SMTP_FROM"));
}

export function appUrl(): string {
  return env("APP_URL").replace(/\/+$/, "");
}

function createClient(): SMTPClient {
  const port = Number(env("SMTP_PORT") || "465");
  return new SMTPClient({
    connection: {
      hostname: env("SMTP_HOST"),
      port,
      tls: port === 465, // 587 upgrades with STARTTLS automatically
      auth: { username: env("SMTP_USER"), password: env("SMTP_PASSWORD") },
    },
  });
}

function fromHeader(): string {
  const name = env("SMTP_FROM_NAME") || "GOQii Pathshala";
  return `${name} <${env("SMTP_FROM")}>`;
}

/** Sends several emails over one SMTP connection. Never throws. */
export async function sendEmails(messages: EmailMessage[]): Promise<EmailResult[]> {
  if (!emailConfigured()) {
    const error = "Email is not configured (missing SMTP secrets)";
    return messages.map(() => ({ sent: false, error }));
  }
  const results: EmailResult[] = [];
  let client: SMTPClient | null = null;
  try {
    client = createClient();
    for (const m of messages) {
      try {
        await client.send({
          from: fromHeader(),
          to: m.to,
          subject: m.subject,
          content: m.text,
          html: m.html,
        });
        results.push({ sent: true });
      } catch (err) {
        results.push({ sent: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    while (results.length < messages.length) results.push({ sent: false, error });
  } finally {
    try { await client?.close(); } catch { /* ignore */ }
  }
  return results;
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const [result] = await sendEmails([message]);
  return result;
}

// ---------- templates ----------

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ROLE_LABELS: Record<string, string> = {
  learner: "Learner",
  manager: "Manager",
  sme: "Subject Matter Expert",
  sme_expert: "SME Expert (Reviewer)",
  admin: "Administrator",
};

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">
<h2 style="margin:0 0 16px;font-size:20px">${esc(title)}</h2>
${bodyHtml}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
<p style="font-size:12px;color:#6b7280;margin:0">GOQii Pathshala &middot; This is an automated message, please do not reply.</p>
</div></body></html>`;
}

export function welcomeEmail(opts: {
  to: string;
  fullName: string;
  password: string;
  role: string;
}): EmailMessage {
  const url = appUrl();
  const loginUrl = url ? `${url}/auth` : "";
  const role = ROLE_LABELS[opts.role] || opts.role;
  const subject = "Your GOQii Pathshala account is ready";

  const text = [
    `Hi ${opts.fullName},`,
    "",
    `An account has been created for you on GOQii Pathshala (role: ${role}).`,
    "",
    `Email:    ${opts.to}`,
    `Temporary password: ${opts.password}`,
    loginUrl ? `Sign in:  ${loginUrl}` : "",
    "",
    "You will be asked to choose a new password the first time you sign in.",
    "If you did not expect this email, please contact your manager.",
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");

  const html = layout(
    "Welcome to GOQii Pathshala",
    `<p>Hi ${esc(opts.fullName)},</p>
<p>An account has been created for you (role: <b>${esc(role)}</b>). Use these details to sign in:</p>
<table style="background:#f9fafb;border-radius:6px;padding:12px 16px;font-size:14px" cellpadding="4">
<tr><td style="color:#6b7280">Email</td><td><b>${esc(opts.to)}</b></td></tr>
<tr><td style="color:#6b7280">Temporary password</td><td><b style="font-family:monospace;font-size:15px">${esc(opts.password)}</b></td></tr>
</table>
${loginUrl ? `<p style="margin:24px 0"><a href="${esc(loginUrl)}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block">Sign in</a></p>` : ""}
<p style="font-size:14px">You will be asked to choose a new password the first time you sign in.</p>
<p style="font-size:13px;color:#6b7280">If you did not expect this email, please contact your manager.</p>`,
  );

  return { to: opts.to, subject, text, html };
}

export function passwordResetEmail(opts: {
  to: string;
  fullName: string;
  link: string;
}): EmailMessage {
  const subject = "Reset your GOQii Pathshala password";
  const name = opts.fullName || "there";

  const text = [
    `Hi ${name},`,
    "",
    "We received a request to reset your GOQii Pathshala password.",
    "Open this link to choose a new one (it expires in 1 hour and can be used once):",
    "",
    opts.link,
    "",
    "If you did not request this, you can ignore this email — your password will not change.",
  ].join("\n");

  const html = layout(
    "Reset your password",
    `<p>Hi ${esc(name)},</p>
<p>We received a request to reset your GOQii Pathshala password. Click the button below to choose a new one. The link expires in 1 hour and can be used once.</p>
<p style="margin:24px 0"><a href="${esc(opts.link)}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block">Reset password</a></p>
<p style="font-size:13px;color:#6b7280">Or paste this link into your browser:<br><span style="word-break:break-all">${esc(opts.link)}</span></p>
<p style="font-size:13px;color:#6b7280">If you did not request this, you can ignore this email — your password will not change.</p>`,
  );

  return { to: opts.to, subject, text, html };
}
