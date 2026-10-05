// Writes the Supabase Auth email templates (supabase/templates/*.html) from
// lib/email/templates.ts so auth and product emails share one design.
// Run: npm run emails:build
import { writeFileSync } from "node:fs";
import { supabaseAuthTemplate, supabaseEmailChangedTemplate, supabaseSecurityNoticeTemplate, type AuthTemplate } from "../lib/email/templates.ts";

const names: AuthTemplate[] = ["magic_link", "confirmation", "invite", "email_change"];
for (const name of names) {
  writeFileSync(new URL(`../supabase/templates/${name}.html`, import.meta.url), supabaseAuthTemplate(name));
  console.log(`supabase/templates/${name}.html`);
}
writeFileSync(new URL("../supabase/templates/email_changed_notification.html", import.meta.url), supabaseEmailChangedTemplate());
console.log("supabase/templates/email_changed_notification.html");
for (const notice of ["mfa_factor_enrolled", "mfa_factor_unenrolled"] as const) {
  writeFileSync(new URL(`../supabase/templates/${notice}_notification.html`, import.meta.url), supabaseSecurityNoticeTemplate(notice));
  console.log(`supabase/templates/${notice}_notification.html`);
}
