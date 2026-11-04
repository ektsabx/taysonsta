// Integration test for link clicks and the funnel (owner, 2026-11-05) against
// the local stack: a click is counted once per person, scanners aren't, an
// unknown code lands on the site.
//   YOLIAS_TEST_APP_URL=http://localhost:3201 npm run test:links
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const app = process.env.YOLIAS_TEST_APP_URL ?? "http://localhost:3201";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: ws } = await db.from("workspaces").select("id").limit(1).single();
const { data: lead, error } = await db.from("sales_leads").insert({ workspace_id: ws!.id, email: `links-${randomUUID()}@example.test`, lead_key: `links:${randomUUID()}`, name: "Link test" }).select("id").single();
assert.ifError(error);
const code = `t${randomUUID().replaceAll("-", "").slice(0, 10)}`;
const url = `${app}/pricing?yc=${lead!.id}`;
const person = { "user-agent": "Mozilla/5.0 (Macintosh) Chrome/130.0 Safari/537.36" };
try {
  const { error: e } = await db.from("email_links").insert({ code, workspace_id: ws!.id, lead_id: lead!.id, url });
  assert.ifError(e);
  const scan = await fetch(`${app}/l/${code}`, { redirect: "manual", headers: { "user-agent": "Proofpoint URL scanner" } });
  assert.equal(scan.status, 302);
  assert.equal(scan.headers.get("location"), url);
  let { data: row } = await db.from("email_links").select("clicks, first_click_at").eq("code", code).single();
  assert.equal(row!.clicks, 0, "a scanner isn't a click");
  const click = await fetch(`${app}/l/${code}`, { redirect: "manual", headers: person });
  assert.equal(click.headers.get("location"), url);
  assert.match(click.headers.get("set-cookie") ?? "", /_yolias_yc=/, "own site keeps the click for signup");
  await fetch(`${app}/l/${code}`, { redirect: "manual", headers: person });
  ({ data: row } = await db.from("email_links").select("clicks, first_click_at").eq("code", code).single());
  assert.equal(row!.clicks, 2);
  assert.ok(row!.first_click_at);
  const unknown = await fetch(`${app}/l/unknown1234`, { redirect: "manual", headers: person });
  assert.equal(new URL(unknown.headers.get("location")!).pathname, "/");
  console.log("Link clicks: ok");
} finally {
  await db.from("sales_leads").delete().eq("id", lead!.id);
}
