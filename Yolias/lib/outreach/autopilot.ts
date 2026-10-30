import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { addLeads, leadsCreated, type LeadTarget } from "@/lib/crm";
import { enrollLeads, prepareNextStep } from "@/lib/outreach/sequence";
import { notifyUser } from "@/lib/outreach/execute";
import { searchTargets } from "@/services/prospects";
import type { Json } from "@/types/database";
import type { CampaignAim } from "@/types/acquisition";

// Autopilot (owner 2026-10-21, D-253): from a search to the conversations,
// with one approval per campaign. Making a campaign by hand (Prospects →
// Send) stays; this is the default path.
//   1. A finished search that found prospects gets an email campaign prepared
//      by the server: its prospects as leads, a first email and two
//      follow-ups, one real first email written. Nothing is sent. A message
//      with an Approve card waits in the search's chat, and a notification.
//   2. After approval the worker sends, reads replies, answers them, follows
//      up and moves interested leads in the CRM (lib/outreach/execute.ts),
//      with the site closed.
//   3. A continuous search keeps finding people: after each new run the new
//      ones join the approved, running campaign.
// Searches finished before this shipped are left alone (AUTOPILOT_FROM).

export const AUTOPILOT_FROM = "2026-10-21T17:00:00Z";
const DAY = 86_400_000;
type Db = ReturnType<typeof createAdminClient>;
type Search = { id: string; workspace_id: string; strategy_id: string; created_by: string | null; name: string; status: string; prospects_found: number; runs_count: number };

/** Worker step (every minute): proposals for finished searches, and new prospects into approved campaigns. */
export async function autopilotSweep(): Promise<{ proposed: number; topped: number }> {
  const db = createAdminClient();
  const out = { proposed: 0, topped: 0 };
  const since = new Date(Math.max(Date.now() - DAY, Date.parse(AUTOPILOT_FROM))).toISOString();
  const { data: searches } = await db.from("campaigns").select("id, workspace_id, strategy_id, created_by, name, status, prospects_found, runs_count")
    .gt("prospects_found", 0)
    // Finished since autopilot shipped, or a continuous search that ran since.
    .or(`and(status.in.(completed,partial),completed_at.gte.${since}),and(status.eq.scheduled,updated_at.gte.${since})`)
    .order("updated_at").limit(20);
  for (const s of (searches ?? []) as Search[]) {
    if (!s.created_by) continue;
    try {
      const { data: existing } = await db.from("outreach_campaigns").select("id, approved_at, status, created_by").eq("source_campaign_id", s.id).neq("status", "archived").order("created_at").limit(1).maybeSingle();
      if (!existing) {
        // One worker only, once per search.
        // A few per minute: each one writes a first email with the AI.
        if (out.proposed < 3 && await claim(db, `autopilot:propose:${s.id}`)) { await propose(db, s, s.created_by); out.proposed++; }
        continue;
      }
      if (!existing.approved_at || existing.status !== "active") continue;
      // A new run of a continuous search: its new prospects join the running campaign.
      const key = `autopilot:topup:${existing.id}`;
      const { data: st } = await db.from("worker_state").select("value").eq("key", key).maybeSingle();
      const seen = Number((st?.value as { runs?: number } | null)?.runs ?? -1);
      if (seen === s.runs_count) continue;
      await db.from("worker_state").upsert({ key, value: { runs: s.runs_count } as Json, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (seen >= 0) { await enrollSearch(db, s.workspace_id, existing.created_by ?? s.created_by, existing.id, s.id); out.topped++; }
    } catch (e) {
      console.error("[autopilot]", s.id, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

/** True for the one worker that claims this key first. */
async function claim(db: Db, key: string) {
  const { data } = await db.from("worker_state").upsert({ key, value: {} as Json, updated_at: new Date().toISOString() }, { onConflict: "key", ignoreDuplicates: true }).select("key");
  return Boolean(data?.length);
}

/** The search's prospects become leads and join the campaign (do-not-contact, suppression and re-contact rules apply). */
async function enrollSearch(db: Db, ws: string, userId: string, outreachId: string, searchId: string) {
  const targets: LeadTarget[] = await searchTargets(ws, searchId, db as never);
  if (!targets.length) return null;
  const before = new Set(((await db.from("sales_leads").select("id").eq("workspace_id", ws).limit(10000)).data ?? []).map((l) => l.id));
  const { ids } = await addLeads(db as never, targets, "search");
  await leadsCreated(ws, ids.filter((id) => !before.has(id)), "agent");
  return enrollLeads(db as never, ws, userId, outreachId, ids);
}

async function propose(db: Db, s: Search, userId: string) {
  const ws = s.workspace_id;
  const [{ data: profile }, { data: last }, settings] = await Promise.all([
    db.from("profiles").select("language").eq("id", userId).maybeSingle(),
    // The aim, link and tone of the workspace's last campaign.
    db.from("outreach_campaigns").select("aim, cta_url, tone").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    loadAiSettings(ws),
  ]);
  const ar = profile?.language === "ar";
  const aim: CampaignAim = (last?.aim as CampaignAim | undefined) ?? "meeting";
  const steps = Math.max(1, Math.min(3, settings.limits.max_messages_per_lead));
  const { data: camp, error } = await db.from("outreach_campaigns").insert({
    workspace_id: ws, created_by: userId, name: s.name.slice(0, 160), channel: "email", language: ar ? "ar" : "en", tone: (last?.tone ?? "direct") as never,
    source_campaign_id: s.id, strategy_id: s.strategy_id, aim, cta_url: last?.cta_url ?? null,
  }).select("id").single();
  if (error || !camp) throw error ?? new Error("campaign insert failed");
  await db.from("outreach_steps").insert(Array.from({ length: steps }, (_, i) => ({
    workspace_id: ws, campaign_id: camp.id, position: i + 1, delay_days: i === 0 ? 0 : 3 * i, objective: (i === 0 ? "introduction" : "follow_up") as never,
  })));
  const enrolled = await enrollSearch(db, ws, userId, camp.id, s.id);
  const recipients = enrolled?.added ?? 0;
  if (!recipients) return;

  // One real first email, so the approval shows exactly what goes out.
  const { data: firsts } = await db.from("outreach_enrollments").select("id, lead:sales_leads(email)").eq("campaign_id", camp.id).eq("status", "active").order("created_at").limit(20);
  const withEmail = (firsts ?? []).filter((e) => (e.lead as unknown as { email: string | null } | null)?.email);
  if (withEmail[0]) await prepareNextStep(ws, userId, withEmail[0].id, "user").catch(() => null);
  const { data: sample } = await db.from("outreach_messages").select("subject, body").eq("outreach_campaign_id", camp.id).eq("direction", "outbound").eq("step_position", 1).neq("status", "canceled").limit(1).maybeSingle();

  // The search's chat: a message with the Approve card.
  let { data: conv } = await db.from("conversations").select("id").eq("scope", "campaign").eq("strategy_id", s.strategy_id).maybeSingle();
  if (!conv) conv = (await db.from("conversations").insert({ workspace_id: ws, user_id: userId, scope: "campaign", strategy_id: s.strategy_id, campaign_id: s.id, title: s.name.slice(0, 200) }).select("id").single()).data;
  const aimText = ar ? { meeting: "حجز اجتماعات", sell: "الشراء من موقعك" }[aim] : { meeting: "book meetings", sell: "purchases on your website" }[aim];
  const { data: pa } = await db.from("agent_pending_actions").insert({
    workspace_id: ws, conversation_id: conv?.id ?? null, requested_by: userId, tool: "startOutreachCampaign",
    input: { id: camp.id, sendFromMailbox: true, autoReply: true } as Json,
    summary: ar ? `بدء «${s.name}»: ${recipients} عميل، مع الرد التلقائي` : `Start "${s.name}": ${recipients} leads, auto-replies on`,
    expires_at: new Date(Date.now() + 7 * DAY).toISOString(),
  }).select("id").single();
  const link = `/outreach/${camp.id}`;
  const text = ar
    ? [`لقيت ${s.prospects_found} عميل محتمل، وجهّزت حملة «${s.name}» لـ ${recipients} منهم، هدفها ${aimText}: إيميل أول ومتابعتين. ما اتبعتش أي حاجة لسه.`,
       sample ? `أول إيميل:\n\n**${sample.subject}**\n\n${sample.body.slice(0, 1500)}` : "",
       `وافق مرة واحدة وأنا أكمّل لوحدي حتى لو قفلت الموقع: أبعت، وأتابع اللي ما ردّوش، وأجاوب الأسئلة البسيطة. أول ما حد يهتم أو يطلب اجتماع، أنقله لإدارة العملاء وأبعتلك إشعار عشان تكمّل انت. الاعتراضات وطلبات الكلام مع شخص والردود غير الواضحة وطلبات الإيقاف هتوصلك أنت. تقدر تغيّر الهدف أو اللينك أو الإيميل من [المحادثات](${link}) قبل الموافقة.`]
    : [`I found ${s.prospects_found} prospects and prepared the campaign "${s.name}" for ${recipients} of them, to ${aimText}: a first email and two follow-ups. Nothing has been sent.`,
       sample ? `First email:\n\n**${sample.subject}**\n\n${sample.body.slice(0, 1500)}` : "",
       `Approve once and I carry on by myself, even with the site closed: I send, follow up with those who don't reply and answer simple questions. As soon as someone is interested or asks for a meeting, I move them to the CRM and notify you so you take it from there. Objections, requests to talk to a person, unclear replies and stop requests come to you. You can change the aim, the link or the email in [Conversations](${link}) before approving.`];
  if (conv) await db.from("agent_messages").insert({
    workspace_id: ws, conversation_id: conv.id, strategy_id: s.strategy_id, user_id: null, role: "assistant",
    content: text.filter(Boolean).join("\n\n"), meta: { approvals: pa ? [pa.id] : [], outreach: camp.id, by: "autopilot" } as Json,
  });
  await notifyUser(ws, userId, ar ? `حملة «${s.name}» جاهزة لموافقتك` : `"${s.name}" is ready for your approval`,
    ar ? `${recipients} عميل. وافق مرة واحدة ويولياس يكمّل لوحده.` : `${recipients} leads. Approve once and Yolias runs it.`, link, `autopilot:${camp.id}`);
}
