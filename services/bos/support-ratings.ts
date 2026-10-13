import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { db } from "@/lib/bos/db";
import { nowIso } from "@/lib/bos/clock";
import { ValidationError } from "@/lib/bos/errors";

// Support ratings and how staff appear to customers (D-180). Ratings are
// given by visitors in the website messenger after a conversation is
// resolved (services/bos/widgets.ts rateConversation).

export async function ratingsReport(f: { days: number; responder?: string; agent?: string }) {
  const since = new Date(Date.now() - f.days * 86_400_000).toISOString();
  let q = db().from("support_ratings").select("id, conversation_id, rating, comment, responder_kind, agent_user_id, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000);
  if (f.responder === "ai" || f.responder === "human") q = q.eq("responder_kind", f.responder);
  if (f.agent && /^[0-9a-f-]{36}$/i.test(f.agent)) q = q.eq("agent_user_id", f.agent);
  const { data } = await q;
  const rows = data ?? [];
  const avg = (xs: { rating: number }[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x.rating, 0) / xs.length) * 100) / 100 : null);
  const distribution = [5, 4, 3, 2, 1].map((n) => ({ stars: n, count: rows.filter((r) => r.rating === n).length }));
  const ai = rows.filter((r) => r.responder_kind === "ai");
  const human = rows.filter((r) => r.responder_kind === "human");
  const byAgent = new Map<string, { rating: number }[]>();
  for (const r of human) if (r.agent_user_id) byAgent.set(r.agent_user_id, [...(byAgent.get(r.agent_user_id) ?? []), r]);
  return {
    total: rows.length,
    average: avg(rows),
    distribution,
    ai: { count: ai.length, average: avg(ai) },
    human: { count: human.length, average: avg(human) },
    agents: [...byAgent.entries()].map(([userId, xs]) => ({ userId, count: xs.length, average: avg(xs) })).sort((a, b) => b.count - a.count),
    recent: rows.slice(0, 50),
  };
}

export async function agentProfile(userId: string) {
  const { data } = await db().from("support_agent_profiles").select("*").eq("user_id", userId).maybeSingle();
  return data;
}

/** The name and photo a staff member shows to customers. Only for themselves. */
export async function saveAgentProfile(bos: BosUser, input: { displayName: string; showPhoto: boolean }) {
  const name = input.displayName.trim();
  if (name.length > 60) throw new ValidationError("الاسم حتى 60 حرفًا.", { displayName: "طويل جدًا" });
  const before = await agentProfile(bos.userId);
  const { error } = await db().from("support_agent_profiles").upsert({ user_id: bos.userId, display_name: name || null, show_photo: input.showPhoto, updated_at: nowIso() });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "support.agent_profile", entityType: "support_agent_profile", entityId: bos.userId, oldValue: before, newValue: { display_name: name || null, show_photo: input.showPhoto } });
}
