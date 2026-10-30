// Email only and "try again later" (D-268, D-269), local Supabase:
//   npm run test:steps
// The mailbox only ever picks up email drafts; people who didn't reply to a
// sequence that ended 60+ days ago are offered again, and nobody else is.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

const { reengageTargets } = await import("@/lib/outreach/reengage.ts");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
assert.match(url, /127\.0\.0\.1|localhost/, "local database only");
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let userId = "", ws = "";
try {
  const { data: u, error } = await db.auth.admin.createUser({ email: `steps-${Date.now()}@yolias.local`, email_confirm: true });
  if (error) throw error;
  userId = u.user.id;
  ws = (await db.from("profiles").select("workspace_id").eq("id", userId).single()).data!.workspace_id!;
  const search = (await db.from("campaigns").insert({ workspace_id: ws, name: "s", criteria: {}, status: "completed", search_type: "companies" }).select("id").single()).data!.id;
  const co = (await db.from("companies").insert({ workspace_id: ws, campaign_id: search, name: "Step Co", source: "test", email: "info@stepco.example" }).select("id").single()).data!.id;
  const lead = (await db.from("sales_leads").insert({ workspace_id: ws, lead_key: `companyrow:${co}`, company_id: co, name: "Step Co", email: "info@stepco.example", created_by: userId }).select("id").single()).data!.id;
  const camp = (await db.from("outreach_campaigns").insert({ workspace_id: ws, name: "Steps", channel: "email", status: "active", created_by: userId }).select("id").single()).data!.id;
  await db.from("outreach_steps").insert([{ workspace_id: ws, campaign_id: camp, position: 1, delay_days: 0, objective: "introduction" }]);
  const enr = (await db.from("outreach_enrollments").insert({ workspace_id: ws, campaign_id: camp, lead_id: lead, status: "completed", current_step: 1, stop_reason: "sequence_done", created_by: userId }).select("id").single()).data!.id;

  // An old non-email draft (from before D-269) is never picked up by the mailbox.
  await db.from("outreach_messages").insert({ workspace_id: ws, lead_id: lead, company_id: co, channel: "whatsapp", direction: "outbound", status: "draft", subject: "", body: "Hi", language: "en", outreach_campaign_id: camp, enrollment_id: enr, step_position: 2 });
  const picked = (await db.from("outreach_messages").select("id").eq("outreach_campaign_id", camp).eq("direction", "outbound").eq("channel", "email").in("status", ["draft", "approved"])).data ?? [];
  assert.equal(picked.length, 0, "the mailbox sends email only");
  console.log("✓ email only");

  // Try again later: only after 60 days, only without a reply.
  assert.equal((await reengageTargets(db, ws)).companyIds.length, 0, "not before 60 days");
  const old = new Date(Date.now() - 70 * 86_400_000).toISOString();
  const pg = await import("node:child_process");
  pg.execSync(`psql "postgresql://postgres:postgres@127.0.0.1:54632/postgres" -c "alter table public.outreach_enrollments disable trigger user; update public.outreach_enrollments set updated_at = '${old}' where id = '${enr}'; alter table public.outreach_enrollments enable trigger user;"`, { stdio: "ignore" });
  assert.deepEqual((await reengageTargets(db, ws)).companyIds, [co], "offered again after 60 days");
  await db.from("outreach_messages").insert({ workspace_id: ws, lead_id: lead, company_id: co, channel: "email", direction: "inbound", status: "received", subject: "Re", body: "No thanks", language: "en", outreach_campaign_id: camp });
  assert.equal((await reengageTargets(db, ws)).companyIds.length, 0, "someone who replied isn't");
  console.log("✓ try again later: 60+ days, never replied");
} finally {
  if (ws) await db.from("workspaces").delete().eq("id", ws);
  if (userId) await db.auth.admin.deleteUser(userId).catch(() => {});
}
