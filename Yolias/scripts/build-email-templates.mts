// Writes the Supabase Auth email templates (supabase/templates/*.html) from
// lib/email/templates.ts so auth and product emails share one design.
// Run: npm run emails:build
import { writeFileSync } from "node:fs";
import { supabaseAuthTemplate, type AuthTemplate } from "../lib/email/templates.ts";

const names: AuthTemplate[] = ["magic_link", "confirmation", "invite"];
for (const name of names) {
  writeFileSync(new URL(`../supabase/templates/${name}.html`, import.meta.url), supabaseAuthTemplate(name));
  console.log(`supabase/templates/${name}.html`);
}
