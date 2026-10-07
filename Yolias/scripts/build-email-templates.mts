// Writes the Supabase Auth email templates (supabase/templates/*.html) and
// their subjects (supabase/config.toml) from lib/email/templates.ts so auth and
// product emails share one design. Run: npm run emails:build
import { readFileSync, writeFileSync } from "node:fs";
import {
  supabaseAuthSubject, supabaseAuthTemplate, supabaseEmailChangedTemplate, supabaseNoticeSubject, supabaseSecurityNoticeTemplate,
  type AuthTemplate, type SecurityNotice,
} from "../lib/email/templates.ts";

const configUrl = new URL("../supabase/config.toml", import.meta.url);
let toml = readFileSync(configUrl, "utf8");

function write(section: string, file: string, html: string, subject: string) {
  writeFileSync(new URL(`../supabase/templates/${file}`, import.meta.url), html);
  const header = `[${section}]`;
  const start = toml.indexOf(header);
  if (start < 0) throw new Error(`${header} is missing in supabase/config.toml`);
  const end = toml.indexOf("\n[", start + header.length);
  const body = toml.slice(start, end < 0 ? undefined : end).replace(/^subject = .*$/m, `subject = ${JSON.stringify(subject)}`);
  toml = toml.slice(0, start) + body + (end < 0 ? "" : toml.slice(end));
  console.log(`supabase/templates/${file}`);
}

const names: AuthTemplate[] = ["magic_link", "confirmation", "invite", "email_change", "recovery", "reauthentication"];
for (const name of names) write(`auth.email.template.${name}`, `${name}.html`, supabaseAuthTemplate(name), supabaseAuthSubject(name));
write("auth.email.notification.email_changed", "email_changed_notification.html", supabaseEmailChangedTemplate(), "Your Yolias email address was changed");
const notices: SecurityNotice[] = ["mfa_factor_enrolled", "mfa_factor_unenrolled", "password_changed"];
for (const notice of notices) write(`auth.email.notification.${notice}`, `${notice}_notification.html`, supabaseSecurityNoticeTemplate(notice), supabaseNoticeSubject(notice));
writeFileSync(configUrl, toml);
console.log("supabase/config.toml (subjects)");
