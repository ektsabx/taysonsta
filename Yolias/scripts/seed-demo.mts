// A demo account with sample data (owner, 2026-11-03, D-276), for the
// website's product screenshots: demo@yolias.local, three campaigns over the
// last 30 days with their audiences, the people reached, opens, replies and
// meetings, at the rates the pricing page uses (lib/pricing-estimates.ts).
// Every company and person is invented. LOCAL DATABASE ONLY: it refuses to
// run against anything else. Run again to rebuild it from scratch.
//   set -a && . ./.env.local && set +a && npx tsx --conditions=react-server --tsconfig tsconfig.json scripts/seed-demo.mts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) { console.error("seed-demo runs on the local database only."); process.exit(1); }
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const DAY = 86_400_000;
const EMAIL = "demo@yolias.local";

// Inserts one row and returns it, or stops with the database's reason.
async function ins(table: string, row: Record<string, unknown>): Promise<{ id: string }> {
  const { data, error } = await (db.from(table as never) as any).insert(row).select("id").single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

// Deterministic randomness, so every run makes the same pictures.
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];

// Start clean: the old demo user (cascades to their workspace's rows).
const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
const old = users.users.find((u) => u.email === EMAIL);
if (old) {
  const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", old.id).maybeSingle();
  if (prof?.workspace_id) await db.from("workspaces").delete().eq("id", prof.workspace_id);
  await db.auth.admin.deleteUser(old.id);
}
const { data: created, error } = await db.auth.admin.createUser({ email: EMAIL, email_confirm: true });
if (error) throw error;
const userId = created.user.id;
const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", userId).single();
const ws = prof!.workspace_id!;
const now = Date.now();
await db.from("workspaces").update({
  name: "Nile Growth Agency", plan: "growth", subscription_status: "test", billing_period: "monthly", current_period_end: new Date(now + 20 * DAY).toISOString(),
  website: "https://nilegrowth.example", industry: "Marketing agency", offering: "Performance marketing and websites for clinics and restaurants", target_markets: "Saudi Arabia, UAE, Egypt",
}).eq("id", ws);
await db.from("profiles").update({ full_name: "Sara Mansour", onboarded_at: new Date(now - 32 * DAY).toISOString(), timezone: "Asia/Riyadh", welcome_video_seen_at: new Date().toISOString(), review_prompted_at: new Date().toISOString() } as never).eq("id", userId);
await ins("mailboxes", { workspace_id: ws, user_id: userId, provider: "gmail", email: "sara@nilegrowth.example", display_name: "Sara Mansour", status: "connected", can_read: true });

{ const { error: calError } = await db.from("calendar_connections").insert({ user_id: userId, workspace_id: ws, provider: "google", status: "connected", email: "sara@nilegrowth.example" } as never); if (calError) throw new Error(`calendar_connections: ${calError.message}`); }
{ const { error: pageError } = await db.from("booking_pages").insert({ user_id: userId, workspace_id: ws, slug: `sara-demo-${userId.slice(0, 6)}`, enabled: true, title: "Intro call with Sara", timezone: "Asia/Riyadh" } as never); if (pageError) throw new Error(`booking_pages: ${pageError.message}`); }

const firstNames = ["Ahmed", "Omar", "Khalid", "Faisal", "Youssef", "Hassan", "Nour", "Lina", "Rania", "Mona", "Tariq", "Saad", "Hala", "Dina", "Ziad", "Reem"];
const lastNames = ["Al-Harbi", "Mansour", "Haddad", "Al-Qahtani", "Fawzi", "Saleh", "Khoury", "Al-Mutairi", "Nasser", "Aziz", "Hamdan", "Rahman"];
// AR_NAMES=1: the same campaigns with Arabic names, for the Arabic screenshots.
const AR = process.env.AR_NAMES === "1";
const campaigns = [
  { name: AR ? "عيادات الأسنان في الرياض" : "Riyadh dental clinics", objective: "meetings", groups: [{ name: AR ? "أصحاب العيادات" : "Clinic owners", industry: "Dental clinic", country: "SA", title: "Owner", n: 320, meet: 0.016 }, { name: AR ? "مديرو العيادات" : "Clinic managers", industry: "Dental clinic", country: "SA", title: "Clinic Manager", n: 260, meet: 0.008 }] },
  { name: AR ? "مطاعم دبي" : "Dubai restaurants", objective: "meetings", groups: [{ name: AR ? "مؤسسو المطاعم" : "Restaurant founders", industry: "Restaurant", country: "AE", title: "Founder", n: 300, meet: 0.013 }, { name: AR ? "مديرو التسويق" : "Marketing managers", industry: "Restaurant", country: "AE", title: "Marketing Manager", n: 240, meet: 0.006 }] },
  { name: AR ? "العقارات في القاهرة" : "Cairo real estate", objective: "form_leads", groups: [{ name: AR ? "المطورون العقاريون" : "Developers", industry: "Real estate", country: "EG", title: "Sales Director", n: 280, meet: 0.01 }] },
];

let totalPeople = 0;
for (const [ci, c] of campaigns.entries()) {
  const started = now - (28 - ci * 3) * DAY;
  const camp = await ins("outreach_campaigns", {
    workspace_id: ws, created_by: userId, name: c.name, objective: c.objective, aim: c.objective === "meetings" ? "meeting" : "form", status: "active",
    approved_at: new Date(started).toISOString(), approved_by: userId, started_at: new Date(started).toISOString(), auto_reply: true, language: "mul",
    budget_type: "daily", budget_usd: 12, daily_limit: 60, target_meetings: 20, sender_name: "Sara from Nile Growth",
  });
  const strat = await ins("strategies", { workspace_id: ws, created_by: userId, title: c.name, prompt: c.name, status: "ready" });
  const search = await ins("campaigns", { workspace_id: ws, strategy_id: strat.id, name: c.name, criteria: {}, status: "completed", search_type: "companies" });
  for (const g of c.groups) {
    const group = await ins("audience_groups", { workspace_id: ws, campaign_id: camp.id, name: g.name, source: "find_new", strategy_id: strat.id, search_campaign_id: search.id, angle_a: `${g.industry}s lose bookings every week to slow follow-up.`, created_by: userId, learning: false });
    for (let i = 0; i < g.n; i++) {
      const sentAt = started + Math.floor(rnd() * (now - started - DAY));
      const person = `${pick(firstNames)} ${pick(lastNames)}`;
      const coName = `${pick(["Al", "Nova", "Prime", "Golden", "Royal", "Smile", "Urban", "Blue"])} ${g.industry.split(" ")[0]} ${i + 1}`;
      const co = await ins("companies", { workspace_id: ws, campaign_id: search.id, name: coName, domain: `demo${totalPeople}.example`, source: "demo", country: g.country, industry: g.industry, employee_count: 10 + Math.floor(rnd() * 140), delivered_at: new Date(sentAt - DAY).toISOString(), saved_at: new Date(sentAt - DAY).toISOString() });
      const pr = await ins("prospects", { workspace_id: ws, campaign_id: search.id, company_id: co.id, full_name: person, title: g.title, country: g.country, email: `p${totalPeople}@demo${totalPeople}.example`, email_status: "verified", source: "demo", saved_at: new Date(sentAt - DAY).toISOString() });
      const lead = await ins("sales_leads", { workspace_id: ws, lead_key: `demo:${pr.id}`, prospect_id: pr.id, company_id: co.id, name: person, company_name: coName, email: `p${ci}${i}@demo.example`, source: "search", created_at: new Date(sentAt).toISOString() });
      const en = await ins("outreach_enrollments", { workspace_id: ws, campaign_id: camp.id, lead_id: lead.id, audience_group_id: group.id, status: "active", current_step: 1, created_at: new Date(sentAt).toISOString() });
      const opened = rnd() < 0.52;
      await ins("outreach_messages", { workspace_id: ws, lead_id: lead.id, outreach_campaign_id: camp.id, enrollment_id: en.id, prospect_id: pr.id, company_id: co.id, direction: "outbound", status: "sent", step_position: 1, sent_at: new Date(sentAt).toISOString(), to_email: `p${ci}${i}@demo.example`, subject: "Quick question", body: "…", delivery_status: rnd() < 0.015 ? "bounced" : "sent", recipient_opened_at: opened ? new Date(sentAt + 3 * 3600_000).toISOString() : null, open_count: opened ? 1 : 0, variant: rnd() < 0.5 ? "a" : "b" });
      const r = rnd();
      const positive = r < g.meet * 2.2, replied = r < 0.06;
      if (replied) {
        const kind = positive ? (rnd() < 0.5 ? "meeting_request" : "interested") : pick(["not_interested", "question", "objection", "out_of_office"]);
        await ins("outreach_messages", { workspace_id: ws, lead_id: lead.id, outreach_campaign_id: camp.id, direction: "inbound", status: "received", received_at: new Date(sentAt + 26 * 3600_000).toISOString(), subject: "Re: Quick question", body: "…", analysis: { kind, summary: kind } });
      }
      if (positive && rnd() < g.meet / (g.meet * 2.2) * 1.4) {
        const at = sentAt + (2 + Math.floor(rnd() * 6)) * DAY;
        await ins("sales_meetings", { workspace_id: ws, lead_id: lead.id, campaign_id: camp.id, title: `${person} · ${coName}`, starts_at: new Date(at).toISOString(), status: at < now ? "completed" : "scheduled", source: "booking", host_id: userId });
      }
      totalPeople++;
    }
  }
  // Prospects used (the spend), by day.
  await ins("usage_ledger", { workspace_id: ws, kind: "consume", prospects: c.groups.reduce((s, g) => s + g.n, 0), period_start: new Date(now).toISOString().slice(0, 8) + "01", campaign_id: search.id });
}
// Booking page visits.
for (let i = 0; i < 140; i++) await ins("booking_visits", { workspace_id: ws, host_id: userId, slug: "sara", visitor: `visitor-${String(i).padStart(4, "0")}`, created_at: new Date(now - Math.floor(rnd() * 28) * DAY).toISOString() });
console.log(`demo ready: ${EMAIL} · ${totalPeople} people reached`);
