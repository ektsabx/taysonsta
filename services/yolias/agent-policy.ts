import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { ydb } from "@/lib/yolias/db";
import { AgentPolicySchema, changedSections, DEFAULT_POLICY, normalizePolicy, type AgentPolicy } from "../../Yolias/lib/agent/policy-schema";

// Yolias AI control center (D-141): the owner edits a draft of the agent
// policy, publishes it (the published one is archived) and can bring any
// earlier version back. Evaluation cases run against a version through the
// Yolias worker. platform.read to view, platform.manage to change; every
// change is audited.

export type PolicySection = keyof AgentPolicy;
export type PolicyVersionRow = { id: string; version: number; status: "draft" | "published" | "archived"; note: string | null; created_by: string | null; created_at: string; published_by: string | null; published_at: string | null; policy: AgentPolicy; changed: string[] };

export async function policyState() {
  const { data, error } = await ydb().from("agent_policies").select("*").order("version", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []).map((r) => ({ ...r, policy: normalizePolicy(r.config) }));
  // "What changed" against the version before it.
  const versions: PolicyVersionRow[] = rows.map((r, i) => ({
    id: r.id, version: r.version, status: r.status, note: r.note, created_by: r.created_by, created_at: r.created_at, published_by: r.published_by, published_at: r.published_at,
    policy: r.policy, changed: rows[i + 1] ? changedSections(rows[i + 1].policy, r.policy) : [],
  }));
  const published = versions.find((v) => v.status === "published") ?? null;
  const draft = versions.find((v) => v.status === "draft") ?? null;
  return { published, draft, versions, editing: draft?.policy ?? published?.policy ?? DEFAULT_POLICY };
}

async function ensureDraft(bos: BosUser) {
  const s = await policyState();
  if (s.draft) return s.draft;
  const version = (s.versions[0]?.version ?? 0) + 1;
  const { data, error } = await ydb().from("agent_policies").insert({ version, status: "draft", config: (s.published?.policy ?? DEFAULT_POLICY) as never, created_by: bos.email }).select("*").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.agent_policy.draft_created", entityType: "yolias_agent_policy", entityId: null, metadata: { version } });
  return { ...data, policy: normalizePolicy(data.config), changed: [] } as unknown as PolicyVersionRow;
}

/** Saves one section into the draft (created from the published version if needed). */
export async function savePolicySection(bos: BosUser, section: PolicySection, value: unknown) {
  const shape = AgentPolicySchema.shape[section];
  if (!shape) throw new ValidationError("قسم غير معروف.");
  const parsed = shape.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(`قيمة غير صالحة: ${issue.path.join(".") || section} — ${issue.message}`);
  }
  const draft = await ensureDraft(bos);
  const next = { ...draft.policy, [section]: parsed.data };
  const { error } = await ydb().from("agent_policies").update({ config: next as never }).eq("id", draft.id).eq("status", "draft");
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.agent_policy.section_saved", entityType: "yolias_agent_policy", entityId: null, oldValue: { [section]: draft.policy[section] }, newValue: { [section]: parsed.data }, metadata: { version: draft.version, section } });
}

export async function publishDraft(bos: BosUser, note: string) {
  const s = await policyState();
  if (!s.draft) throw new ValidationError("لا توجد مسودة لنشرها.");
  const now = new Date().toISOString();
  if (s.published) {
    const { error } = await ydb().from("agent_policies").update({ status: "archived" }).eq("id", s.published.id);
    if (error) throw error;
  }
  const { error } = await ydb().from("agent_policies").update({ status: "published", published_by: bos.email, published_at: now, note: note.trim().slice(0, 500) || null }).eq("id", s.draft.id);
  if (error) {
    // Put the previous version back so Yolias AI always has a published policy.
    if (s.published) await ydb().from("agent_policies").update({ status: "published" }).eq("id", s.published.id);
    throw error;
  }
  await audit({ actorId: bos.userId, action: "yolias.agent_policy.published", entityType: "yolias_agent_policy", entityId: null, oldValue: { version: s.published?.version ?? null }, newValue: { version: s.draft.version, changed: changedSections(s.published?.policy ?? DEFAULT_POLICY, s.draft.policy) }, metadata: { note } });
}

export async function discardDraft(bos: BosUser) {
  const s = await policyState();
  if (!s.draft) return;
  const { error } = await ydb().from("agent_policies").delete().eq("id", s.draft.id).eq("status", "draft");
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.agent_policy.draft_discarded", entityType: "yolias_agent_policy", entityId: null, metadata: { version: s.draft.version } });
}

/** Rollback: an earlier version becomes the draft (review it, then publish). */
export async function restoreVersion(bos: BosUser, version: number) {
  const s = await policyState();
  const v = s.versions.find((x) => x.version === version);
  if (!v) throw new NotFoundError();
  if (s.draft) {
    const { error } = await ydb().from("agent_policies").update({ config: v.policy as never }).eq("id", s.draft.id);
    if (error) throw error;
  } else {
    const { error } = await ydb().from("agent_policies").insert({ version: (s.versions[0]?.version ?? 0) + 1, status: "draft", config: v.policy as never, created_by: bos.email, note: `من الإصدار ${version}` });
    if (error) throw error;
  }
  await audit({ actorId: bos.userId, action: "yolias.agent_policy.restored", entityType: "yolias_agent_policy", entityId: null, metadata: { from: version } });
}

/* ───────────────────────── Evaluation ───────────────────────── */

export async function evalState() {
  const [{ data: cases }, { data: runs }] = await Promise.all([
    ydb().from("agent_eval_cases").select("*").order("created_at"),
    ydb().from("agent_eval_runs").select("*").order("created_at", { ascending: false }).limit(20),
  ]);
  return { cases: cases ?? [], runs: runs ?? [] };
}

const words = (v: string) => [...new Set(v.split(/\n|,/).map((x) => x.trim()).filter(Boolean))].slice(0, 20);

export async function saveEvalCase(bos: BosUser, id: string | null, input: { name: string; prompt: string; mustInclude: string; mustNotInclude: string; active: boolean }) {
  const name = input.name.trim(), prompt = input.prompt.trim();
  if (!name || name.length > 120) throw new ValidationError("الاسم مطلوب.", { name: "مطلوب" });
  if (!prompt || prompt.length > 2000) throw new ValidationError("السؤال مطلوب.", { prompt: "مطلوب" });
  const row = { name, prompt, must_include: words(input.mustInclude), must_not_include: words(input.mustNotInclude), active: input.active };
  const { error } = id
    ? await ydb().from("agent_eval_cases").update(row).eq("id", id)
    : await ydb().from("agent_eval_cases").insert({ ...row, created_by: bos.email });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: id ? "yolias.agent_eval.case_updated" : "yolias.agent_eval.case_created", entityType: "yolias_agent_eval", entityId: null, newValue: row });
}

export async function deleteEvalCase(bos: BosUser, id: string) {
  const { error } = await ydb().from("agent_eval_cases").delete().eq("id", id);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.agent_eval.case_deleted", entityType: "yolias_agent_eval", entityId: null, metadata: { id } });
}

/** Queues a run; the Yolias worker picks it up within a minute. */
export async function queueEvalRun(bos: BosUser, version: number) {
  const { data: v } = await ydb().from("agent_policies").select("version").eq("version", version).maybeSingle();
  if (!v) throw new NotFoundError();
  const { count } = await ydb().from("agent_eval_cases").select("id", { count: "exact", head: true }).eq("active", true);
  if (!count) throw new ValidationError("أضف حالة اختبار مفعّلة أولاً.");
  const { error } = await ydb().from("agent_eval_runs").insert({ policy_version: version, created_by: bos.email });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.agent_eval.run_queued", entityType: "yolias_agent_eval", entityId: null, metadata: { version } });
}

/* ───────────────────────── Cache & memory ───────────────────────── */

export async function cacheState() {
  const [{ data: top }, { count: entries }, { count: memories }] = await Promise.all([
    ydb().from("agent_answer_cache").select("question, language, hits, policy_version, created_at, expires_at").order("hits", { ascending: false }).limit(20),
    ydb().from("agent_answer_cache").select("key", { count: "exact", head: true }),
    ydb().from("agent_memories").select("id", { count: "exact", head: true }),
  ]);
  const hits = (top ?? []).reduce((s, r) => s + r.hits, 0);
  return { top: top ?? [], entries: entries ?? 0, hits, memories: memories ?? 0 };
}

export async function clearAnswerCache(bos: BosUser) {
  const { error } = await ydb().from("agent_answer_cache").delete().neq("key", "");
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.agent_cache.cleared", entityType: "yolias_agent_policy", entityId: null });
}

/** Messages per policy version and what the new layers did (last 30 days). */
export async function controlMetrics(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [{ data: msgs }, { data: approvals }] = await Promise.all([
    ydb().from("agent_messages").select("meta").eq("role", "assistant").gte("created_at", since).limit(20000),
    ydb().from("agent_pending_actions").select("status").gte("created_at", since).limit(20000),
  ]);
  const byVersion = new Map<number, { replies: number; cost: number; cached: number }>();
  let cached = 0, guardrail = 0;
  for (const m of msgs ?? []) {
    const meta = (m.meta ?? {}) as { policyVersion?: number; cached?: boolean; guardrailHits?: number; costUsd?: number };
    const v = meta.policyVersion ?? 0;
    const row = byVersion.get(v) ?? { replies: 0, cost: 0, cached: 0 };
    row.replies++;
    row.cost += Number(meta.costUsd ?? 0);
    if (meta.cached) { row.cached++; cached++; }
    if (meta.guardrailHits) guardrail += meta.guardrailHits;
    byVersion.set(v, row);
  }
  const ap = { pending: 0, approved: 0, rejected: 0, expired: 0, failed: 0 } as Record<string, number>;
  for (const a of approvals ?? []) ap[a.status] = (ap[a.status] ?? 0) + 1;
  return { cached, guardrail, approvals: ap, byVersion: [...byVersion.entries()].map(([version, r]) => ({ version, ...r })).sort((a, b) => b.version - a.version) };
}
