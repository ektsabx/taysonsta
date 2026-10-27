// Sign-up attribution end to end (D-257), local stack only, no email sent:
//   npm run test:seo-attribution   (needs Yolias running on YOLIAS_URL, default http://localhost:3201)
// A visitor lands on /compare/apollo from Google, accepts cookies and signs
// up; /auth/confirm stores the first page and the channel. Without the cookie
// the sign-up counts as unknown. A visitor who chose essential cookies gets no
// first-touch cookie from the front door.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";
import { encodeFirstTouch, firstTouch } from "@/lib/attribution.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
assert.match(url, /127\.0\.0\.1|localhost/, "local database only");
const site = process.env.YOLIAS_URL ?? "http://localhost:3201";
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const users: string[] = [];

async function signUp(cookie: string) {
  const email = `attr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@yolias.local`;
  const { data, error } = await db.auth.admin.generateLink({ type: "signup", email, password: crypto.randomUUID() });
  if (error) throw error;
  users.push(data.user.id);
  const res = await fetch(`${site}/auth/confirm?token_hash=${data.properties.hashed_token}&type=signup`, { headers: { cookie }, redirect: "manual" });
  assert.ok(res.status >= 300 && res.status < 400, `confirm redirects (${res.status})`);
  for (let i = 0; i < 20; i++) {
    const { data: row } = await db.from("signup_attribution").select("*").eq("user_id", data.user.id).maybeSingle();
    if (row) return row;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("no attribution row");
}

try {
  const ft = encodeFirstTouch(firstTouch(new URL("https://www.yolias.com/compare/apollo?utm_campaign=x"), "https://www.google.com/"));
  const organic = await signUp(`yolias_ft=${ft}`);
  assert.equal(organic.channel, "organic_search");
  assert.equal(organic.search_engine, "google");
  assert.equal(organic.landing_path, "/compare/apollo");
  assert.equal(organic.referrer_host, "www.google.com");
  console.log("✓ organic sign-up keeps its landing page");

  const unknown = await signUp("");
  assert.equal(unknown.channel, "unknown");
  assert.equal(unknown.landing_path, null);
  console.log("✓ no cookie: unknown, nothing guessed");

  const page = async (cookie: string) => (await fetch(`${site}/pricing`, { headers: { cookie, accept: "text/html" }, redirect: "manual" })).headers.get("set-cookie") ?? "";
  assert.ok(!/yolias_ft=/.test(await page("yolias_consent=essential")), "essential only: no attribution cookie");
  assert.ok(!/yolias_ft=/.test(await page("")), "before a choice: no cookie from the server");
  assert.ok(/yolias_ft=/.test(await page("yolias_consent=all")), "accepted: the first page is kept");
  console.log("✓ the cookie follows the visitor's consent");
  console.log("\nAll attribution checks passed.");
} finally {
  for (const id of users) {
    const { data: p } = await db.from("profiles").select("workspace_id").eq("id", id).maybeSingle();
    await db.auth.admin.deleteUser(id).catch(() => {});
    if (p?.workspace_id) await db.from("workspaces").delete().eq("id", p.workspace_id);
  }
}
