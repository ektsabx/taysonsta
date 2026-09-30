import { nowIso, nowMs } from "@/lib/bos/clock";
import "server-only";
import type { Json } from "@/types/database";
import { db, dec } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { addMoney, allocateByPercent, formatMoney, HUNDRED_PERCENT, parseMoney, toDecimalString } from "@/lib/bos/money";
import { getSetting } from "@/lib/bos/settings";
import { createProposal, publishProposal, ProposalValidationFailedError } from "@/services/proposals";
import { parseProposalContent, emptyProposalContent, type ProposalContent } from "@/types/proposal";
import { requestApproval } from "@/services/bos/approvals";
import { getPipeline } from "@/services/bos/shared";

// Proposal lifecycle (§15): Draft → Internal Review → Sent → Viewed →
// Accepted | Rejected | Expired. Extends the existing proposal system
// (frozen published snapshots, per-proposal client login) — docs/bos/08.

export interface ScheduleRow {
  label: string;
  percent: string;
  amount: string;
}

export function computeSchedule(total: string, rows: { label: string; percent: string }[], currency: string): ScheduleRow[] {
  const amounts = allocateByPercent(total, rows.map((r) => r.percent), currency);
  return rows.map((r, i) => ({ label: r.label, percent: r.percent, amount: toDecimalString(amounts[i], 2) }));
}

async function linkProposalToStage(actorId: string | null, proposal: { deal_id: string | null }, dealStageKey: string, leadStageKey: string) {
  if (!proposal.deal_id) return;
  const { data: deal } = await db().from("deals").select("id, lead_id, stage_id, pipeline_stages!inner(key, category, sort_order)").eq("id", proposal.deal_id).maybeSingle();
  if (!deal) return;
  const current = deal.pipeline_stages as unknown as { key: string; category: string; sort_order: number };
  if (current.category !== "open") return;
  const { stages } = await getPipeline("deal");
  const target = stages.find((s) => s.key === dealStageKey && s.is_active);
  if (target && target.sort_order > current.sort_order) {
    await db().from("deals").update({ stage_id: target.id, probability: target.probability }).eq("id", deal.id);
    await recordStatus("deal", deal.id, current.key, target.key, actorId, `Proposal ${dealStageKey === "proposal" ? "sent" : "accepted"}`);
    await emitEvent({
      type: "deal.stage_changed",
      entityType: "deal",
      entityId: deal.id,
      summary: `${current.key} → ${target.key} (proposal)`,
      payload: { from: current.key, to: target.key },
      actorId,
      actorType: actorId ? "user" : "client",
    });
  }
  if (deal.lead_id) {
    const { stages: leadStages } = await getPipeline("lead");
    const leadStage = leadStages.find((s) => s.key === leadStageKey);
    const { data: lead } = await db().from("leads").select("stage_id, pipeline_stages!inner(sort_order, category)").eq("id", deal.lead_id).maybeSingle();
    const leadCurrent = lead?.pipeline_stages as unknown as { sort_order: number; category: string } | undefined;
    if (leadStage && leadCurrent && leadCurrent.category === "open" && leadStage.sort_order > leadCurrent.sort_order) {
      await db().from("leads").update({ stage_id: leadStage.id }).eq("id", deal.lead_id);
    }
  }
}

// Create a proposal pre-filled from the deal: client, title, pricing lines,
// payment schedule and scope — no re-entry of existing data (§3).
export async function createProposalFromDeal(bos: BosUser, dealId: string, title?: string, subtitle?: string): Promise<string> {
  const { data: deal } = await db().from("deals").select("*, clients(name, company_name)").eq("id", dealId).maybeSingle();
  if (!deal) throw new NotFoundError("الصفقة غير موجودة.");
  const { data: lines } = await db().from("deal_products").select("quantity, unit_price, line_total, products(name)").eq("deal_id", dealId).order("sort_order");
  const terms = (deal.payment_terms as unknown as { label: string; percent: string | number }[]) ?? [];
  const total = String(deal.value);
  const schedule = terms.length ? computeSchedule(total, terms.map((t) => ({ label: t.label, percent: String(t.percent) })), deal.currency) : [];

  const id = await createProposal({ clientId: deal.client_id, title: title || deal.name, subtitle: subtitle ?? "", createdBy: bos.userId });

  const content: ProposalContent = {
    ...emptyProposalContent,
    overview: deal.scope ?? "",
    proposedSolution: deal.scope ?? "",
    packages: [
      {
        id: crypto.randomUUID(),
        name: deal.name,
        goal: "",
        priceLabel: formatMoney(total, deal.currency),
        timelineLabel: "",
        scope: (lines ?? []).map((l) => `${(l.products as unknown as { name: string } | null)?.name ?? ""}${Number(l.quantity) !== 1 ? ` × ${l.quantity}` : ""}`),
        deliverables: [],
        excludes: [],
        roadmap: [],
        paymentMilestones: schedule.map((s) => ({ id: crypto.randomUUID(), label: s.label, percentage: `${s.percent}%`, amount: formatMoney(s.amount, deal.currency) })),
      },
    ],
    paymentTerms: schedule.map((s) => `${s.label}: ${s.percent}% (${formatMoney(s.amount, deal.currency)})`).join("\n"),
  };

  const validUntil = new Date(nowMs() + 30 * 86400000).toISOString().slice(0, 10);
  await db()
    .from("proposals")
    .update({
      deal_id: dealId,
      owner_id: deal.assigned_to ?? bos.userId,
      content: content as unknown as Json,
      total_amount: dec(total),
      currency: deal.currency,
      payment_schedule: schedule as unknown as Json,
      valid_until: validUntil,
    })
    .eq("id", id);

  await recordStatus("proposal", id, null, "draft", bos.userId);
  await audit({ actorId: bos.userId, action: "proposal.created", entityType: "proposal", entityId: id, newValue: { deal_id: dealId, total, currency: deal.currency } });
  await emitEvent({
    type: "proposal.created",
    entityType: "proposal",
    entityId: id,
    summary: `Proposal created: ${title || deal.name}`,
    payload: { deal_id: dealId, owner_user_id: deal.assigned_to },
    links: [{ type: "deal", id: dealId }, { type: "client", id: deal.client_id }, { type: "lead", id: deal.lead_id }],
    actorId: bos.userId,
  });
  return id;
}

export interface CommercialTermsInput {
  total_amount: string;
  currency: string;
  schedule: { label: string; percent: string }[];
  valid_until: string | null;
  assumptions: string | null;
  terms: string | null;
}

export async function saveCommercialTerms(bos: BosUser, id: string, input: CommercialTermsInput) {
  if (input.schedule.length) {
    for (const row of input.schedule) {
      const p = parseMoney(row.percent);
      if (p === null || p <= BigInt(0) || p > HUNDRED_PERCENT || !row.label.trim()) {
        throw new ValidationError("كل دفعة تحتاج اسماً ونسبة بين 0 و100.", { schedule: "بيانات غير صالحة" });
      }
    }
    if (addMoney(...input.schedule.map((r) => r.percent)) !== HUNDRED_PERCENT) {
      throw new ValidationError("مجموع نسب جدول الدفعات يجب أن يساوي 100%.", { schedule: "المجموع ≠ 100%" });
    }
  }
  const schedule = computeSchedule(input.total_amount, input.schedule, input.currency);
  const { data: before } = await db().from("proposals").select("total_amount, currency, valid_until").eq("id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  const { error } = await db()
    .from("proposals")
    .update({
      total_amount: dec(input.total_amount),
      currency: input.currency,
      payment_schedule: schedule as unknown as Json,
      valid_until: input.valid_until,
      assumptions: input.assumptions,
      terms: input.terms,
    })
    .eq("id", id);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "proposal.commercial_updated", entityType: "proposal", entityId: id, oldValue: before, newValue: { total_amount: input.total_amount, currency: input.currency, valid_until: input.valid_until } });
  return schedule;
}

export async function submitForReview(bos: BosUser, id: string) {
  const { data: p } = await db().from("proposals").select("id, status, title, deal_id, client_id").eq("id", id).maybeSingle();
  if (!p) throw new NotFoundError();
  if (p.status !== "draft") throw new ValidationError("يمكن إرسال المسودات فقط للمراجعة الداخلية.");
  await db().from("proposals").update({ status: "ready" }).eq("id", id);
  await recordStatus("proposal", id, "draft", "ready", bos.userId);
  const policies = await getSetting("approval_policies");
  if (policies.proposal.required) {
    await requestApproval({
      type: "proposal",
      entityType: "proposal",
      entityId: id,
      title: `Internal review: ${p.title}`,
      requestedBy: bos.userId,
      steps: [policies.proposal.approver],
      links: [{ type: "deal", id: p.deal_id }, { type: "client", id: p.client_id }],
    });
  }
  await emitEvent({ type: "proposal.submitted", entityType: "proposal", entityId: id, summary: `Submitted for internal review: ${p.title}`, links: [{ type: "deal", id: p.deal_id }], actorId: bos.userId });
}

export async function returnToDraft(bos: BosUser, id: string) {
  const { data: p } = await db().from("proposals").select("status").eq("id", id).maybeSingle();
  if (!p) throw new NotFoundError();
  if (["accepted", "rejected", "expired"].includes(p.status)) throw new ValidationError("لا يمكن إرجاع مقترح مغلق إلى مسودة. أنشئ نسخة جديدة.");
  await db().from("proposals").update({ status: "draft" }).eq("id", id);
  await recordStatus("proposal", id, p.status, "draft", bos.userId);
}

// Publishing = sending to the client (existing snapshot logic), plus the BOS
// lifecycle: approval gate, version, timeline, deal/lead stage sync.
export async function sendProposal(bos: BosUser, id: string): Promise<{ errors: string[] }> {
  const { data: before } = await db().from("proposals").select("*").eq("id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  if (["accepted", "rejected"].includes(before.status)) return { errors: ["المقترح مغلق (مقبول أو مرفوض). أنشئ نسخة جديدة للتعديل."] };

  const policies = await getSetting("approval_policies");
  if (policies.proposal.required) {
    const { data: approved } = await db()
      .from("approvals")
      .select("id")
      .eq("entity_type", "proposal")
      .eq("entity_id", id)
      .eq("approval_type", "proposal")
      .eq("status", "approved")
      .limit(1)
      .maybeSingle();
    if (!approved) return { errors: ["يتطلب المقترح موافقة المراجعة الداخلية قبل الإرسال (Settings → Approval policies)."] };
  }

  try {
    await publishProposal(id);
  } catch (error) {
    if (error instanceof ProposalValidationFailedError) return { errors: error.errors.map((e) => e.message) };
    throw error;
  }

  const republish = Boolean(before.sent_at);
  await db()
    .from("proposals")
    .update({ sent_at: before.sent_at ?? nowIso(), version: republish ? before.version + 1 : before.version })
    .eq("id", id);
  await recordStatus("proposal", id, before.status, "published", bos.userId, republish ? `Republished v${before.version + 1}` : null);
  await audit({ actorId: bos.userId, action: republish ? "proposal.republished" : "proposal.sent", entityType: "proposal", entityId: id, newValue: { version: republish ? before.version + 1 : before.version } });

  const links = [{ type: "deal", id: before.deal_id }, { type: "client", id: before.client_id }];
  await emitEvent({
    type: "proposal.sent",
    entityType: "proposal",
    entityId: id,
    summary: republish ? `Proposal updated and re-sent (v${before.version + 1}): ${before.title}` : `Proposal sent: ${before.title}`,
    payload: { deal_id: before.deal_id, owner_user_id: before.owner_id, total: before.total_amount, currency: before.currency },
    links,
    actorId: bos.userId,
  });
  if (before.deal_id && !republish) {
    await emitEvent({
      type: "deal.proposal_sent",
      entityType: "deal",
      entityId: before.deal_id,
      summary: `Proposal sent: ${before.title}`,
      payload: { proposal_id: id, owner_user_id: before.owner_id },
      links: [{ type: "client", id: before.client_id }, { type: "proposal", id }],
      actorId: bos.userId,
    });
  }
  await linkProposalToStage(bos.userId, before, "proposal", "proposal");
  return { errors: [] };
}

export async function recordFirstView(proposalId: string) {
  const { data: p } = await db().from("proposals").select("id, title, deal_id, client_id, owner_id, view_count").eq("id", proposalId).maybeSingle();
  if (!p) return;
  await emitEvent({
    type: "proposal.viewed",
    entityType: "proposal",
    entityId: p.id,
    summary: `Client viewed the proposal: ${p.title}`,
    payload: { owner_user_id: p.owner_id, deal_id: p.deal_id },
    links: [{ type: "deal", id: p.deal_id }, { type: "client", id: p.client_id }],
    actorType: "client",
    visibility: "client",
    dedupeKey: `proposal.viewed:${p.id}`,
  });
  await recordStatus("proposal", p.id, "published", "viewed", null, "First client view");
}

function isExpired(validUntil: string | null): boolean {
  if (!validUntil) return false;
  return validUntil < nowIso().slice(0, 10);
}

export async function acceptProposal(proposalId: string, actor: { userId: string | null; onBehalf: boolean; clientUserId?: string | null }) {
  const { data: p } = await db().from("proposals").select("*").eq("id", proposalId).maybeSingle();
  if (!p) throw new NotFoundError();
  if (!["published", "viewed"].includes(p.status)) throw new ValidationError("لا يمكن قبول هذا المقترح في حالته الحالية.");
  if (isExpired(p.valid_until)) throw new ValidationError("انتهت صلاحية المقترح — اطلب نسخة جديدة.");

  await db().from("proposals").update({ status: "accepted", accepted_at: nowIso() }).eq("id", proposalId);
  await recordStatus("proposal", proposalId, p.status, "accepted", actor.userId, actor.onBehalf ? "Recorded by staff on behalf of client" : "Accepted by client");
  await audit({
    actorId: actor.userId ?? actor.clientUserId ?? null,
    actorType: actor.onBehalf ? "user" : "client",
    action: "proposal.accepted",
    entityType: "proposal",
    entityId: proposalId,
    newValue: { status: "accepted", total: p.total_amount, currency: p.currency, version: p.version },
    metadata: { on_behalf: actor.onBehalf },
  });

  // Only one proposal per deal can be accepted: others are closed as superseded.
  if (p.deal_id) {
    const { data: others } = await db().from("proposals").select("id, status").eq("deal_id", p.deal_id).neq("id", proposalId).in("status", ["draft", "ready", "published", "viewed"]);
    for (const o of others ?? []) {
      await db().from("proposals").update({ status: "rejected", rejected_at: nowIso(), rejection_reason: "Superseded by accepted proposal" }).eq("id", o.id);
      await recordStatus("proposal", o.id, o.status, "rejected", actor.userId, "Superseded by accepted proposal");
    }
  }

  await emitEvent({
    type: "proposal.accepted",
    entityType: "proposal",
    entityId: proposalId,
    summary: `Proposal accepted${actor.onBehalf ? " (recorded by staff)" : " by client"}: ${p.title}`,
    payload: { deal_id: p.deal_id, owner_user_id: p.owner_id, total: p.total_amount, currency: p.currency },
    links: [{ type: "deal", id: p.deal_id }, { type: "client", id: p.client_id }],
    actorId: actor.userId,
    actorType: actor.onBehalf ? "user" : "client",
    visibility: "client",
  });
  const { data: client } = await db().from("clients").select("crm_stage").eq("id", p.client_id).maybeSingle();
  if (client && ["proposal_sent", "proposal_viewed"].includes(client.crm_stage)) {
    await db().from("clients").update({ crm_stage: "proposal_accepted" }).eq("id", p.client_id);
  }
  await linkProposalToStage(actor.userId, p, "negotiation", "negotiation");
}

export async function rejectProposal(proposalId: string, reason: string, actor: { userId: string | null; onBehalf: boolean; clientUserId?: string | null }) {
  if (!reason.trim()) throw new ValidationError("سبب الرفض مطلوب.", { reason: "مطلوب" });
  const { data: p } = await db().from("proposals").select("*").eq("id", proposalId).maybeSingle();
  if (!p) throw new NotFoundError();
  if (!["published", "viewed"].includes(p.status)) throw new ValidationError("لا يمكن رفض هذا المقترح في حالته الحالية.");
  await db().from("proposals").update({ status: "rejected", rejected_at: nowIso(), rejection_reason: reason }).eq("id", proposalId);
  await recordStatus("proposal", proposalId, p.status, "rejected", actor.userId, reason);
  await audit({ actorId: actor.userId ?? actor.clientUserId ?? null, actorType: actor.onBehalf ? "user" : "client", action: "proposal.rejected", entityType: "proposal", entityId: proposalId, reason });
  await emitEvent({
    type: "proposal.rejected",
    entityType: "proposal",
    entityId: proposalId,
    summary: `Proposal rejected: ${reason}`,
    payload: { deal_id: p.deal_id, owner_user_id: p.owner_id, reason },
    links: [{ type: "deal", id: p.deal_id }, { type: "client", id: p.client_id }],
    actorId: actor.userId,
    actorType: actor.onBehalf ? "user" : "client",
  });
  const { data: client } = await db().from("clients").select("crm_stage").eq("id", p.client_id).maybeSingle();
  if (client && ["proposal_sent", "proposal_viewed"].includes(client.crm_stage)) {
    await db().from("clients").update({ crm_stage: "proposal_rejected" }).eq("id", p.client_id);
  }
}

// Sweep: sent/viewed proposals past valid_until → expired; reminder 2 days before.
export async function expireProposals(): Promise<{ expired: number; reminded: number }> {
  const today = nowIso().slice(0, 10);
  const soon = new Date(nowMs() + 2 * 86400000).toISOString().slice(0, 10);
  const { data: due } = await db().from("proposals").select("id, title, status, deal_id, client_id, owner_id, valid_until").in("status", ["published", "viewed"]).lt("valid_until", today);
  for (const p of due ?? []) {
    await db().from("proposals").update({ status: "expired", expired_at: nowIso() }).eq("id", p.id).in("status", ["published", "viewed"]);
    await recordStatus("proposal", p.id, p.status, "expired", null, "Validity period ended");
    await emitEvent({
      type: "proposal.expired",
      entityType: "proposal",
      entityId: p.id,
      summary: `Proposal expired: ${p.title}`,
      payload: { deal_id: p.deal_id, owner_user_id: p.owner_id },
      links: [{ type: "deal", id: p.deal_id }, { type: "client", id: p.client_id }],
      actorType: "system",
      dedupeKey: `proposal.expired:${p.id}`,
    });
  }
  const { data: expiring } = await db().from("proposals").select("id, title, deal_id, owner_id, valid_until").in("status", ["published", "viewed"]).gte("valid_until", today).lte("valid_until", soon);
  for (const p of expiring ?? []) {
    await emitEvent({
      type: "proposal.expiring",
      entityType: "proposal",
      entityId: p.id,
      summary: `Proposal expires on ${p.valid_until}: ${p.title}`,
      payload: { deal_id: p.deal_id, owner_user_id: p.owner_id, assignee_user_id: p.owner_id },
      actorType: "system",
      dedupeKey: `proposal.expiring:${p.id}:${p.valid_until}`,
    });
  }
  return { expired: due?.length ?? 0, reminded: expiring?.length ?? 0 };
}

export function proposalContentOf(value: unknown) {
  return parseProposalContent(value);
}
