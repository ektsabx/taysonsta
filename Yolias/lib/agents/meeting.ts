import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { LlmNotConfiguredError, runChat } from "@/lib/ai/llm";
import { tasks } from "@/lib/ai/orchestrator";
import { contextText, loadAiSettings, loadBusinessContext } from "@/lib/ai-workspace/server";
import { decide, guidanceFor } from "@/lib/ai-workspace/settings";
import { historyFor } from "@/lib/outreach/sequence";

// Meeting Agent (D-197): a short preparation brief for a meeting, from what
// Yolias holds about the lead, the conversation and Company Knowledge. It
// doesn't create calendar events or video links — that needs a calendar
// integration Yolias doesn't have; the member saves the link they created.

export const MEETING_PROMPT_VERSION = "meeting-brief-2026-10-13";

export async function meetingBrief(workspaceId: string, userId: string, meetingId: string, language: "en" | "ar"): Promise<{ ok: true; brief: string } | { ok: false; error: "denied" | "not_found" | "not_configured" | "failed" }> {
  const s = await loadAiSettings(workspaceId);
  const d = decide(s, "meeting", "prepare_messages");
  if (!d.allowed) return { ok: false, error: "denied" };
  const db = createAdminClient();
  const { data: m } = await db.from("sales_meetings").select("*, lead:sales_leads(*)").eq("id", meetingId).eq("workspace_id", workspaceId).maybeSingle();
  if (!m || !m.lead) return { ok: false, error: "not_found" };
  const lead = m.lead as unknown as { id: string; name: string; company_name: string | null; stage: string; deal_value: number | null; deal_currency: string; prospect_id: string | null; company_id: string | null; customer_profile_id: string | null };
  const [business, { data: person }, { data: company }, { data: notes }] = await Promise.all([
    loadBusinessContext(workspaceId, { customerProfileId: lead.customer_profile_id }),
    lead.prospect_id ? db.from("prospects").select("full_name, title, seniority, city, country").eq("id", lead.prospect_id).maybeSingle() : Promise.resolve({ data: null }),
    lead.company_id ? db.from("companies").select("name, industry, description, employee_count, city, country, website").eq("id", lead.company_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("lead_activities").select("body, created_at").eq("lead_id", lead.id).eq("kind", "note").order("created_at", { ascending: false }).limit(5),
  ]);
  try {
    const r = await runChat(tasks.writing, {
      system: [
        `You prepare a sales meeting brief in ${language === "ar" ? "Arabic" : "English"}: at most 10 short "-" lines under the headings Who, Context so far, Their likely goals, What to offer, Agenda, Questions to ask.`,
        "Use only the facts given. If something is unknown, say so; never invent facts about the prospect, their company or competitors.",
        contextText(business, { competitors: true }),
        guidanceFor(s, "meeting"),
      ].filter(Boolean).join("\n\n"),
      messages: [{ role: "user", text: JSON.stringify({ meeting: { title: m.title, starts_at: m.starts_at, notes: m.notes }, lead: { name: lead.name, company: lead.company_name, stage: lead.stage, deal_value: lead.deal_value, currency: lead.deal_currency }, person, company, member_notes: (notes ?? []).map((n) => n.body), conversation: await historyFor(lead.id, 8) }) }],
      tools: [],
      maxTokens: 1200,
      maxIterations: 1,
    }, { workspaceId, campaignId: null, promptVersion: MEETING_PROMPT_VERSION });
    const brief = r.reply.trim().slice(0, 4000);
    if (!brief) return { ok: false, error: "failed" };
    await db.from("lead_activities").insert({ workspace_id: workspaceId, lead_id: lead.id, kind: "agent", actor_kind: "agent", actor_id: userId, body: brief, meta: { agent: "meeting", meeting_id: m.id } });
    return { ok: true, brief };
  } catch (e) {
    if (e instanceof LlmNotConfiguredError) return { ok: false, error: "not_configured" };
    console.error("[meeting] brief", e);
    return { ok: false, error: "failed" };
  }
}
