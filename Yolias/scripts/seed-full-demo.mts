// LOCAL DEMO DATA ONLY — the whole customer journey on localhost, so the
// owner can click through it: a Free workspace (test@yolias.local) whose
// one-time prospects get used up by real pipeline runs (stand-in provider,
// source "demo_seed", .example domains), follow-up conversations with Yolias
// AI in every search (a revealed contact, a draft email in Outreach, a
// pending approval, a saved fact), and a last search paused because the
// prospects ran out (Buy more prospects). The chat replies are written by
// this script, not by the model. Never run against production:
//   npm run seed:full-demo            (re-creates the account)
//   npm run seed:full-demo -- --login (only prints a fresh sign-in link)
import { createClient } from "@supabase/supabase-js";
import { runDiscovery } from "@/lib/discovery/pipeline.ts";
import type { IcpCriteria } from "@/lib/discovery/icp.ts";
import { installDemoAdapter } from "./demo-adapter.mts";
import type { Database } from "@/types/database.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Local database only.");
const db = createClient<Database>(url, key, { auth: { persistSession: false } });
const EMAIL = "test@yolias.local";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/$/, "");

async function loginLink() {
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  if (error) throw error;
  return `${SITE}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`;
}

if (process.argv.includes("--login")) {
console.log(`\nSign in as ${EMAIL} (open in the browser, one use):\n${await loginLink()}\n`);
  process.exit(0);
}

// ── A fresh account (signup trigger creates the profile + workspace) ──
const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
const old = list.users.find((u) => u.email === EMAIL);
if (old) {
  const { data: p } = await db.from("profiles").select("workspace_id").eq("id", old.id).maybeSingle();
  if (p?.workspace_id) await db.from("workspaces").delete().eq("id", p.workspace_id);
  await db.auth.admin.deleteUser(old.id);
}
const { data: created, error: createError } = await db.auth.admin.createUser({ email: EMAIL, email_confirm: true, user_metadata: { full_name: "Mona Adel" } });
if (createError) throw createError;
const userId = created.user.id;
const ws = (await db.from("profiles").select("workspace_id").eq("id", userId).single()).data!.workspace_id!;
await db.from("profiles").update({ full_name: "Mona Adel", onboarded_at: new Date().toISOString(), language: "ar", country: "EG", timezone: "Africa/Cairo" }).eq("id", userId);
await db.from("workspaces").update({
  name: "Nile CRM", website: "https://nilecrm.example", offering: "A simple CRM for small sales teams in Egypt and the Gulf",
  plan: "free", subscription_status: "active", billing_country: "EG",
}).eq("id", ws);

// ── Searches, run by the real pipeline with the stand-in provider ──
const uninstall = await installDemoAdapter(url, key);
const base: Omit<IcpCriteria, "search_type" | "campaign_name" | "summary" | "target_count"> = {
  lookalike_seeds: [], target_unit: "prospects", countries: ["SA", "AE", "EG"], cities: [], industries: ["Fintech", "SaaS"], keywords: [],
  employees_min: 20, employees_max: 500, job_titles: ["Head of Sales", "CEO", "Founder"], seniorities: ["founder", "c_level"], hiring: null, hiring_roles: [],
  funding_stages: [], technologies: [], exclusions: [], assumptions: [],
};
type Search = { prompt: string; icp: IcpCriteria };
const searches: Search[] = [
  { prompt: "عايز مؤسسين ومديري مبيعات في شركات SaaS وفينتك في السعودية والإمارات ومصر", icp: { ...base, target_count: 20, search_type: "people", campaign_name: "السعودية والإمارات ومصر — مؤسسون ومديرو مبيعات", summary: "مؤسسون ومديرو مبيعات في شركات SaaS وفينتك", assumptions: ["شركات من 20 إلى 500 موظف."] } },
  { prompt: "شركات SaaS في السعودية", icp: { ...base, target_count: 8, target_unit: "companies", search_type: "companies", countries: ["SA"], campaign_name: "السعودية — شركات SaaS", summary: "شركات SaaS في السعودية" } },
  { prompt: "عيادات وسبا وجيم في الرياض", icp: { ...base, target_count: 5, target_unit: "companies", search_type: "local_businesses", cities: ["Riyadh"], countries: ["SA"], industries: ["Clinic", "Spa", "Gym", "Restaurant", "Pharmacy"], campaign_name: "الرياض — عيادات وسبا وجيم", summary: "أنشطة محلية في الرياض" } },
  { prompt: "شركات شبه Tabby و Tamara", icp: { ...base, target_count: 4, target_unit: "companies", search_type: "company_lookalikes", lookalike_seeds: ["tabby.ai", "tamara.co"], campaign_name: "شركات شبيهة بـ Tabby و Tamara", summary: "شركات شبيهة بـ Tabby و Tamara" } },
  { prompt: "مديرين تسويق في شركات تجارة إلكترونية في مصر", icp: { ...base, target_count: 30, search_type: "people", countries: ["EG"], industries: ["E-commerce"], job_titles: ["Marketing Director", "Head of Marketing"], seniorities: ["director", "head"], campaign_name: "مصر — مديرو تسويق في التجارة الإلكترونية", summary: "مديرو تسويق في شركات التجارة الإلكترونية في مصر" } },
  // Runs after the Free prospects are gone: paused, "Buy more prospects".
  { prompt: "أصحاب شركات لوجستيات في الإمارات", icp: { ...base, target_count: 15, search_type: "people", countries: ["AE"], industries: ["Logistics"], job_titles: ["Owner", "CEO"], campaign_name: "الإمارات — أصحاب شركات لوجستيات", summary: "أصحاب ومديرو شركات اللوجستيات في الإمارات" } },
];

const made: { strategyId: string; campaignId: string; conversationId: string; icp: IcpCriteria }[] = [];
let minute = 0;
const at = () => new Date(Date.now() - (240 - (minute += 3)) * 60_000).toISOString();
for (const { prompt, icp } of searches) {
  const { data: s } = await db.from("strategies").insert({ workspace_id: ws, created_by: userId, title: icp.campaign_name, prompt, icp: icp as never, status: "ready", created_at: at() }).select("id").single();
  const { data: c } = await db.from("campaigns").insert({ workspace_id: ws, strategy_id: s!.id, created_by: userId, name: icp.campaign_name, criteria: icp as never, search_type: icp.search_type, quota: icp.target_count, status: "queued" }).select("id").single();
  await runDiscovery(c!.id);
  const { data: conv } = await db.from("conversations").insert({ workspace_id: ws, scope: "campaign", strategy_id: s!.id, campaign_id: c!.id, title: icp.campaign_name }).select("id").single();
  made.push({ strategyId: s!.id, campaignId: c!.id, conversationId: conv!.id, icp });
  const { data: after } = await db.from("campaigns").select("status, prospects_found, partial_reason").eq("id", c!.id).single();
  console.log(`✓ ${icp.search_type.padEnd(18)} ${String(after!.prospects_found).padStart(3)} found · ${after!.status}${after!.partial_reason ? ` (${after!.partial_reason})` : ""} · ${icp.campaign_name}`);
}
await uninstall();

// ── Conversations (follow-ups under each search card) ──
async function say(i: number, role: "user" | "assistant", content: string, meta: Record<string, unknown> = {}) {
  const m = made[i];
  await db.from("agent_messages").insert({
    workspace_id: ws, conversation_id: m.conversationId, strategy_id: m.strategyId, user_id: role === "user" ? userId : null, role, content,
    meta: (role === "assistant" ? { policyVersion: 1, demo: true, ...meta } : meta) as never, created_at: at(),
  });
}

// 1) People search: best matches → reveal → draft → a new campaign waiting for approval.
const { data: top } = await db.from("prospects").select("id, full_name, title, email, email_status, match_score, match_reasons, company_id, companies(name, city)")
  .eq("campaign_id", made[0].campaignId).order("match_score", { ascending: false }).limit(20)
  .then((r) => ({ data: (r.data ?? []).filter((p, k, all) => all.findIndex((x) => x.full_name === p.full_name) === k).slice(0, 3) }));
const line = (p: NonNullable<typeof top>[number], k: number) => {
  const co = p.companies as unknown as { name: string; city: string | null } | null;
  return `${k + 1}. ${p.full_name} — ${p.title ?? ""} في ${co?.name ?? ""}${co?.city ? ` (${co.city})` : ""} · تطابق ${p.match_score ?? "—"}%`;
};
await say(0, "user", "مين أقوى 3 أشخاص في النتايج دي وليه؟");
await say(0, "assistant", `دول أعلى 3 من حيث التطابق مع طلبك:\n${(top ?? []).map(line).join("\n")}\n\nالسبب: مناصبهم قرار مباشر في الشراء، وشركاتهم في المجال والحجم اللي طلبتهم. تحب أظهرلك بيانات التواصل لحد منهم؟`, { toolCalls: 1 });
const first = top?.[0];
if (first) {
  await db.from("prospects").update({ revealed_at: new Date().toISOString(), revealed_by: userId, saved_at: new Date().toISOString() }).eq("id", first.id);
  await say(0, "user", `اظهرلي إيميل ${first.full_name}`);
  await say(0, "assistant", first.email
    ? `إيميل ${first.full_name}: ${first.email}${first.email_status === "verified" ? " (موثّق)" : " (غير موثّق بعد)"}.\nاتحفظ كمان في قائمة العملاء المحتملين بتاعتك.`
    : `مفيش إيميل متاح لـ ${first.full_name} حالياً من المصادر المتصلة.`, { toolCalls: 1 });
  if (first.email) {
    const co = (first.companies as unknown as { name: string } | null)?.name ?? "";
    await db.from("outreach_messages").insert({
      workspace_id: ws, prospect_id: first.id, campaign_id: made[0].campaignId, created_by: userId, to_email: first.email, language: "ar", status: "draft",
      subject: `فكرة سريعة لفريق مبيعات ${co}`,
      body: `أهلاً ${first.full_name.split(" ")[0]}،\n\nلاحظت إن ${co} بتكبر فريق المبيعات. Nile CRM بيساعد الفرق الصغيرة تتابع كل عميل من غير جداول ولا رسائل ضايعة.\n\nينفع نتكلم 15 دقيقة الأسبوع ده؟\n\nمنى عادل\nNile CRM`,
      instruction: "رسالة تعريفية قصيرة عن منتجنا", model: "demo",
    });
    await say(0, "user", "اكتبله رسالة تعريفية قصيرة عن منتجنا");
    await say(0, "assistant", `جهّزت مسودة رسالة لـ ${first.full_name}. هتلاقيها في صفحة التواصل (Outreach) وفي صفحة الشخص، تراجعها وتعدّلها وتبعتها بنفسك. مفيش حاجة اتبعتت.`, { toolCalls: 1 });
  }
}
await say(0, "user", "احفظ إننا بنبيع CRM للشركات الصغيرة وبنستهدف فرق المبيعات اللي أقل من 50 شخص");
await db.from("agent_memories").insert({ workspace_id: ws, created_by: userId, content: "Nile CRM تبيع CRM للشركات الصغيرة وتستهدف فرق المبيعات الأقل من 50 شخصاً." });
await say(0, "assistant", "تمام، حفظت المعلومة دي وهستخدمها في أي بحث أو رسالة جاية.", { toolCalls: 1 });
await say(0, "user", "اعمل نفس البحث بس في السعودية بس و 100 شخص");
const request = "مؤسسون ومديرو مبيعات في شركات SaaS وفينتك في السعودية فقط، 100 شخص";
const { data: pa } = await db.from("agent_pending_actions").insert({
  workspace_id: ws, conversation_id: made[0].conversationId, requested_by: userId, tool: "createCampaign", input: { request } as never,
  summary: `بدء حملة — «${request}»`,
}).select("id").single();
await say(0, "assistant", "هبدأ حملة جديدة لنفس البحث في السعودية بس بهدف 100 شخص. الحملة دي محتاجة موافقتك من الكارت اللي تحت.", { approvals: [pa!.id], toolCalls: 1 });

// 2) Companies search: a simple follow-up.
const { data: cos } = await db.from("companies").select("name, employee_count, city").eq("campaign_id", made[1].campaignId).order("employee_count", { ascending: false }).limit(5);
await say(1, "user", "رتبهم حسب عدد الموظفين");
await say(1, "assistant", `من الأكبر للأصغر:\n${(cos ?? []).map((c, k) => `${k + 1}. ${c.name} — ${c.employee_count ?? "؟"} موظف${c.city ? ` · ${c.city}` : ""}`).join("\n")}\n\nتحب أدوّرلك على صناع القرار في أول شركتين؟`, { toolCalls: 1 });

// 6) The paused search: why it stopped.
const last = made.length - 1;
const { data: usage } = await db.rpc("usage_summary", { p_ws: ws });
await say(last, "user", "ليه الحملة دي واقفة؟");
await say(last, "assistant", `الحملة متوقفة لأن رصيد العملاء المحتملين في الخطة المجانية خلص (${usage?.[0]?.consumed ?? 0} من ${usage?.[0]?.allowance ?? 0}). مفيش أي حاجة اتخصمت على الحملة دي.\n\nتقدر تشتري عملاء محتملين إضافيين من الإعدادات ← الاستخدام ← شراء عملاء محتملين إضافيين، أو تعمل ترقية لخطة Pro. أول ما الرصيد يتوفر الحملة هتكمل لوحدها.`, { toolCalls: 1 });

// Outreach progress example (statuses set directly; nothing is sent).
const { data: three } = await db.from("prospects").select("id, email, campaign_id, full_name").eq("workspace_id", ws).not("email", "is", null).neq("email_status", "invalid").limit(3);
const progressIds: string[] = [];
for (const [k, p] of (three ?? []).entries()) {
  const { data: m } = await db.from("outreach_messages").insert({
    workspace_id: ws, prospect_id: p.id, campaign_id: p.campaign_id, created_by: userId, to_email: p.email, language: "ar", model: "demo",
    status: (["sent", "sending", "approved"] as const)[k], sent_at: k === 0 ? new Date().toISOString() : null,
    subject: "فكرة سريعة لفريقكم", body: `أهلاً ${p.full_name.split(" ")[0]}،\n\nرسالة تجريبية (بيانات محلية).\n\nمنى`,
  }).select("id").single();
  if (m) progressIds.push(m.id);
}

for (const m of made) await db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", m.conversationId);

const u = usage?.[0];
console.log(`\nUsage: ${u?.consumed ?? 0} used of ${u?.allowance ?? 0} (Free, one-time) · available ${u?.available ?? 0}`);
console.log(`Results page: ${SITE}/search/${made[0].strategyId}/results · Outreach progress: ${SITE}/outreach/progress?ids=${progressIds.join(",")}`);
console.log(`\nSign in as ${EMAIL} (open in the browser, one use; npm run seed:full-demo -- --login for a new one):\n${await loginLink()}\n`);
