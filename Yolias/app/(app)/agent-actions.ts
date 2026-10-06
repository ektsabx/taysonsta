"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageTeam, requireSession } from "@/lib/session";
import { executeTool } from "@/lib/agent/tools";
import { activePolicy } from "@/lib/agent/policy";
import { AGENT_TOOLS } from "@/lib/agent/policy-schema";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import type { Json } from "@/types/database";

// Human-in-the-loop (D-141): an action Yolias AI prepared runs only when a
// member presses Approve under the reply. The person who asked, or an owner /
// admin, decides. The tool runs with the decider's own session, so roles,
// permissions and RLS apply exactly as if they had done it themselves.
export async function decideAgentAction(id: string, approve: boolean): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  const t = await getDictionary();
  const a = t.agent.approval;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: a.notFound };
  const db = await createClient();
  const { data: pa } = await db.from("agent_pending_actions").select("*").eq("id", id).maybeSingle();
  if (!pa || pa.workspace_id !== session.workspace.id) return { ok: false, error: a.notFound };
  if (pa.requested_by !== session.userId && !canManageTeam(session)) return { ok: false, error: a.notYours };
  const admin = createAdminClient();
  if (pa.status !== "pending") return { ok: false, error: a.decided };
  if (Date.parse(pa.expires_at) < Date.now()) {
    await admin.from("agent_pending_actions").update({ status: "expired" }).eq("id", id).eq("status", "pending");
    return { ok: false, error: a.expiredError };
  }
  // Claim it first, so a double click can never run it twice.
  const { data: claimed } = await admin.from("agent_pending_actions")
    .update({ status: approve ? "approved" : "rejected", decided_by: session.userId, decided_at: new Date().toISOString() })
    .eq("id", id).eq("status", "pending").select("id").maybeSingle();
  if (!claimed) return { ok: false, error: a.decided };

  const { data: conv } = pa.conversation_id ? await admin.from("conversations").select("id, strategy_id").eq("id", pa.conversation_id).maybeSingle() : { data: null };
  const label = AGENT_TOOLS.find((x) => x.name === pa.tool)?.label[session.profile.language === "ar" ? "ar" : "en"] ?? pa.tool;
  let content = fmt(a.rejectedNote, { action: label });
  const meta: Record<string, unknown> = { approvalResult: id };
  if (approve) {
    const launched: string[] = [];
    const { policy } = await activePolicy();
    const result = await executeTool({ session, db, conversationId: pa.conversation_id, strategyId: conv?.strategy_id ?? null, launched, policy, approved: true }, pa.tool, pa.input);
    await admin.from("agent_pending_actions").update({ status: result.ok ? "approved" : "failed", result: (result.ok ? { ok: true } : { ok: false, outcome: result.outcome, message: result.message }) as Json }).eq("id", id);
    content = result.ok ? fmt(a.doneNote, { action: label }) : fmt(a.failedNote, { action: label, reason: result.message });
    if (launched.length) meta.campaigns = launched;
  }
  if (conv) {
    await admin.from("agent_messages").insert({ workspace_id: pa.workspace_id, conversation_id: conv.id, strategy_id: conv.strategy_id, user_id: null, role: "assistant", content, meta: meta as Json });
    if (conv.strategy_id) revalidatePath(`/search/${conv.strategy_id}`);
  }
  return { ok: true };
}
