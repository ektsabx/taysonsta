// Puts Yolias's sign-in emails on the hosted Supabase project: the same
// templates and subjects as supabase/config.toml (supabase/templates/*.html),
// sent through Resend's SMTP so they reach every customer, not only the
// project's members.
//
//   1. Fill Yolias/.env.auth-emails.local (git-ignored):
//        SUPABASE_ACCESS_TOKEN=sbp_…   (supabase.com/dashboard/account/tokens)
//        RESEND_API_KEY=re_…           (a key whose domain yolias.com is verified)
//        RESEND_FROM=Yolias <no-reply@yolias.com>
//   2. npm run auth-emails:push             → shows what would change
//   3. npm run auth-emails:push -- --apply  → changes it
//
// Secrets are never printed.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const REF = process.env.SUPABASE_PROJECT_REF ?? "iudasrzqjnsutvanjrvn";
const apply = process.argv.includes("--apply");

const env: Record<string, string> = {};
for (const line of readFileSync(join(ROOT, ".env.auth-emails.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
}
const token = env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is missing in .env.auth-emails.local");

// Subjects and template files from config.toml (one source for local and hosted).
const toml = readFileSync(join(ROOT, "supabase/config.toml"), "utf8");
function section(name: string) {
  const start = toml.indexOf(`[${name}]`);
  if (start < 0) throw new Error(`[${name}] not in config.toml`);
  const body = toml.slice(start).split(/\n\[/)[0];
  const value = (key: string) => {
    const m = body.match(new RegExp(`^${key} = "((?:[^"\\\\]|\\\\.)*)"`, "m"));
    return m ? JSON.parse(`"${m[1]}"`) as string : undefined;
  };
  const path = value("content_path");
  return { subject: value("subject"), content: path ? readFileSync(join(ROOT, path), "utf8") : undefined };
}

const payload: Record<string, string | number | boolean> = {};
for (const kind of ["magic_link", "confirmation", "invite", "email_change"]) {
  const s = section(`auth.email.template.${kind}`);
  payload[`mailer_subjects_${kind}`] = s.subject!;
  payload[`mailer_templates_${kind}_content`] = s.content!;
}
for (const kind of ["email_changed", "mfa_factor_enrolled", "mfa_factor_unenrolled"]) {
  const s = section(`auth.email.notification.${kind}`);
  payload[`mailer_notifications_${kind}_enabled`] = true;
  payload[`mailer_subjects_${kind}_notification`] = s.subject!;
  payload[`mailer_templates_${kind}_notification_content`] = s.content!;
}

if (env.RESEND_API_KEY) {
  const from = env.RESEND_FROM ?? "";
  const email = from.match(/<([^>]+)>/)?.[1] ?? from;
  const name = from.includes("<") ? from.split("<")[0].trim() : "Yolias";
  if (!email.includes("@")) throw new Error("RESEND_FROM must be like: Yolias <no-reply@yolias.com>");
  Object.assign(payload, {
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: env.RESEND_API_KEY,
    smtp_admin_email: email,
    smtp_sender_name: name,
    rate_limit_email_sent: 30,
  });
} else {
  console.log("No RESEND_API_KEY: templates only (Supabase keeps sending to project members only).");
}

const api = `https://api.supabase.com/v1/projects/${REF}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const current = await fetch(api, { headers });
if (!current.ok) throw new Error(`Reading the auth settings failed: ${current.status} ${await current.text()}`);
const now = (await current.json()) as Record<string, unknown>;

// Redirect URLs (Authentication → URL Configuration): Yolias sign-in and the
// published Admin's sign-in / password reset (D-150). Existing ones are kept.
const redirects = ["https://www.yolias.com/auth/confirm", "https://yol.yolias.com/admin/auth/callback", "https://yol.yolias.com/admin/reset-password"];
const allow = String(now.uri_allow_list ?? "").split(",").map((u) => u.trim()).filter(Boolean);
const merged = [...new Set([...allow, ...redirects])];
if (merged.length !== allow.length) payload.uri_allow_list = merged.join(",");

const changed = Object.keys(payload).filter((k) => k === "smtp_pass" || now[k] !== payload[k]);
console.log(`Project ${REF} — site URL: ${String(now.site_url)}`);
console.log(changed.length ? `Will change:\n  ${changed.join("\n  ")}` : "Nothing to change.");
if (!apply || !changed.length) {
  if (!apply) console.log("\nDry run. Add --apply to change it.");
  process.exit(0);
}

const res = await fetch(api, { method: "PATCH", headers, body: JSON.stringify(Object.fromEntries(changed.map((k) => [k, payload[k]]))) });
if (!res.ok) throw new Error(`Update failed: ${res.status} ${await res.text()}`);
console.log("Done. Auth emails on the hosted project now use the Yolias templates" + (env.RESEND_API_KEY ? " and Resend" : "") + (payload.uri_allow_list ? "; redirect URLs added." : "."));
