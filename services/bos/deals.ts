import { nowIso } from "@/lib/bos/clock";
import "server-only";
import type { Json } from "@/types/database";
import { db, dec, type Tables } from "@/lib/bos/db";
import { getTeamUserIds, type BosUser } from "@/lib/bos/auth";
import { myClientIds } from "@/lib/bos/access";
import type { Scope } from "@/lib/bos/permissions";
import { audit, diffFields, recordStatus } from "@/lib/bos/audit";
import { emitEvent, dispatchPendingEvents } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { addMoney, HUNDRED_PERCENT, parseMoney } from "@/lib/bos/money";
import { getPipeline } from "@/services/bos/shared";

export type Deal = Tables<"deals">;

export interface PaymentTerm {
  label: string;
  percent: string;
  trigger: "on_signing" | "on_date";
  due_offset_days: number;
}

export function validatePaymentTerms(terms: PaymentTerm[]): void {
  if (!terms.length) return;
  for (const t of terms) {
    const p = parseMoney(t.percent);
    if (p === null || p <= BigInt(0) || p > HUNDRED_PERCENT) throw new ValidationError("كل دفعة يجب أن تكون نسبة بين 0 و 100.", { payment_terms: "نسب غير صالحة" });
    if (!t.label.trim()) throw new ValidationError("اسم الدفعة مطلوب.", { payment_terms: "اسم الدفعة مطلوب" });
  }
  if (addMoney(...terms.map((t) => t.percent)) !== HUNDRED_PERCENT) {
    throw new ValidationError("مجموع نسب الدفعات يجب أن يساوي 100%.", { payment_terms: "المجموع يجب أن يساوي 100%" });
  }
}

export interface DealFilters {
  q?: string;
  stage?: string;
  assigned?: string;
  client?: string;
  currency?: string;
  status?: string;
  upsell?: string;
  closeFrom?: string;
  closeTo?: string;
  sort?: string;
  dir?: string;
  page?: number;
  pageSize?: number;
}

const sortable = new Set(["name", "value", "probability", "expected_close_date", "created_at", "updated_at"]);

export async function dealScopeFilter(bos: BosUser, scope: Scope): Promise<string | null> {
  if (scope === "all") return null;
  const users = scope === "team" ? await getTeamUserIds(bos) : [bos.userId];
  const parts = [`assigned_to.in.(${users.join(",")})`, `created_by.in.(${users.join(",")})`];
  if (bos.roleKeys.includes("account_manager")) {
    const clients = await myClientIds(bos, scope);
    if (clients?.length) parts.push(`client_id.in.(${clients.join(",")})`);
  }
  return parts.join(",");
}

export async function listDeals(bos: BosUser, scope: Scope, f: DealFilters) {
  const pageSize = Math.min(f.pageSize ?? 25, 200);
  const page = Math.max(1, f.page ?? 1);
  let query = db()
    .from("deals")
    .select("id, deal_number, name, value, currency, probability, expected_close_date, payment_status, assigned_to, is_upsell, won_at, lost_at, created_at, updated_at, client_id, clients(name, company_name, country), contacts(full_name), pipeline_stages!inner(id, name, key, category)", { count: "exact" })
    .is("archived_at", null);

  const owner = await dealScopeFilter(bos, scope);
  if (owner) query = query.or(owner);
  if (f.q) {
    const p = `%${f.q.replace(/[%_,()]/g, " ").trim()}%`;
    query = query.or(`name.ilike.${p},deal_number.ilike.${p}`);
  }
  if (f.stage) query = query.eq("stage_id", f.stage);
  if (f.status) query = query.eq("pipeline_stages.category", f.status as "open");
  if (f.assigned === "me") query = query.eq("assigned_to", bos.userId);
  else if (f.assigned) query = query.eq("assigned_to", f.assigned);
  if (f.client) query = query.eq("client_id", f.client);
  if (f.currency) query = query.eq("currency", f.currency);
  if (f.upsell === "1") query = query.eq("is_upsell", true);
  if (f.closeFrom) query = query.gte("expected_close_date", f.closeFrom);
  if (f.closeTo) query = query.lte("expected_close_date", f.closeTo);

  const sort = f.sort && sortable.has(f.sort) ? f.sort : "created_at";
  const { data, count, error } = await query.order(sort, { ascending: f.dir === "asc", nullsFirst: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getDeal(id: string) {
  const { data, error } = await db()
    .from("deals")
    .select("*, clients(id, name, company_name, email, country, account_manager_id), contacts(id, full_name, email, phone), pipeline_stages!inner(id, name, key, category, probability), lead_sources(name), leads!deals_lead_id_fkey(id, name, lead_number)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError();
  return data;
}

export interface DealInput {
  name: string;
  client_id: string;
  contact_id: string | null;
  lead_id: string | null;
  source_id: string | null;
  value: string;
  currency: string;
  probability: string | null;
  expected_close_date: string | null;
  assigned_to: string | null;
  scope: string | null;
  notes: string | null;
  payment_terms: PaymentTerm[];
  is_upsell?: boolean;
  previous_deal_id?: string | null;
}

async function assertContactBelongs(clientId: string, contactId: string | null) {
  if (!contactId) return;
  const { data } = await db().from("contacts").select("client_id").eq("id", contactId).maybeSingle();
  if (!data) throw new ValidationError("جهة الاتصال غير موجودة.", { contact_id: "غير موجودة" });
  if (data.client_id && data.client_id !== clientId) throw new ValidationError("جهة الاتصال تابعة لحساب آخر.", { contact_id: "تابعة لحساب آخر" });
}

export async function createDeal(bos: BosUser, input: DealInput) {
  validatePaymentTerms(input.payment_terms);
  const { data: client } = await db().from("clients").select("id, archived_at").eq("id", input.client_id).maybeSingle();
  if (!client || client.archived_at) throw new ValidationError("اختر حساباً صالحاً (موجوداً وغير مؤرشف).", { client_id: "حساب غير صالح" });
  await assertContactBelongs(input.client_id, input.contact_id);

  const { pipeline, stages } = await getPipeline("deal");
  const first = stages.find((s) => s.is_active && s.category === "open");
  if (!first) throw new ValidationError("لا توجد مراحل مفعلة في مسار الصفقات.");

  const { data, error } = await db()
    .from("deals")
    .insert({
      name: input.name,
      client_id: input.client_id,
      contact_id: input.contact_id,
      lead_id: input.lead_id,
      source_id: input.source_id,
      pipeline_id: pipeline.id,
      stage_id: first.id,
      value: dec(input.value),
      currency: input.currency,
      probability: input.probability ? dec(input.probability) : first.probability,
      expected_close_date: input.expected_close_date,
      assigned_to: input.assigned_to ?? bos.userId,
      scope: input.scope,
      notes: input.notes,
      payment_terms: input.payment_terms as unknown as Json,
      is_upsell: input.is_upsell ?? false,
      previous_deal_id: input.previous_deal_id ?? null,
      created_by: bos.userId,
    })
    .select("*")
    .single();
  if (error) throw error;

  await recordStatus("deal", data.id, null, first.key, bos.userId);
  await audit({ actorId: bos.userId, action: "deal.created", entityType: "deal", entityId: data.id, newValue: { name: data.name, value: data.value, currency: data.currency, client_id: data.client_id, assigned_to: data.assigned_to } });
  await emitEvent({
    type: "deal.created",
    entityType: "deal",
    entityId: data.id,
    summary: `Deal created: ${data.name} (${data.value} ${data.currency})${data.is_upsell ? " — upsell" : ""}`,
    payload: { deal_id: data.id, value: data.value, currency: data.currency, owner_user_id: data.assigned_to, client_id: data.client_id, is_upsell: data.is_upsell },
    links: [{ type: "client", id: data.client_id }, { type: "lead", id: data.lead_id }, { type: "contact", id: data.contact_id }],
    actorId: bos.userId,
  });
  return data;
}

const audited: (keyof Deal)[] = ["name", "value", "currency", "probability", "expected_close_date", "assigned_to", "client_id", "contact_id", "payment_terms", "scope"];

export async function updateDeal(bos: BosUser, id: string, input: DealInput) {
  validatePaymentTerms(input.payment_terms);
  const { data: before } = await db().from("deals").select("*").eq("id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  await assertContactBelongs(input.client_id, input.contact_id);
  if (before.won_processed_at && (String(before.value) !== String(Number(input.value)) || before.currency !== input.currency)) {
    // Value/currency changes after Won don't silently change invoices or
    // schedules; Finance is notified (docs/bos/06).
    await emitEvent({
      type: "deal.value_changed_after_won",
      entityType: "deal",
      entityId: id,
      summary: `Deal value changed after Won: ${before.value} ${before.currency} → ${input.value} ${input.currency}`,
      payload: { previous: before.value, current: input.value },
      actorId: bos.userId,
    });
  }

  const patch = {
    name: input.name,
    client_id: input.client_id,
    contact_id: input.contact_id,
    source_id: input.source_id,
    value: dec(input.value),
    currency: input.currency,
    probability: input.probability ? dec(input.probability) : before.probability,
    expected_close_date: input.expected_close_date,
    assigned_to: input.assigned_to ?? before.assigned_to,
    scope: input.scope,
    notes: input.notes,
    payment_terms: input.payment_terms as unknown as Json,
  };
  const { data, error } = await db().from("deals").update(patch).eq("id", id).select("*").single();
  if (error) throw error;

  const diff = diffFields(before as unknown as Record<string, unknown>, { ...patch, value: input.value } as unknown as Record<string, unknown>, audited as string[]);
  if (diff.changed) {
    await audit({ actorId: bos.userId, action: "deal.updated", entityType: "deal", entityId: id, oldValue: diff.oldValue, newValue: diff.newValue });
    await emitEvent({
      type: "deal.updated",
      entityType: "deal",
      entityId: id,
      summary: `Deal updated (${Object.keys(diff.newValue).join(", ")})`,
      payload: { owner_user_id: data.assigned_to, changed: Object.keys(diff.newValue) },
      actorId: bos.userId,
    });
  }
  return data;
}

export async function changeDealStage(bos: BosUser, id: string, stageId: string, opts: { reason?: string | null; allowReopen?: boolean } = {}) {
  const { data: deal } = await db().from("deals").select("*, pipeline_stages!inner(key, name, category)").eq("id", id).maybeSingle();
  if (!deal) throw new NotFoundError();
  const { stages } = await getPipeline("deal");
  const target = stages.find((s) => s.id === stageId);
  if (!target) throw new ValidationError("مرحلة غير صالحة.");
  const current = deal.pipeline_stages as unknown as { key: string; name: string; category: string };
  if (current.key === target.key) return;

  if (target.category === "won") return markDealWon(bos, id);
  if (target.category === "lost") return markDealLost(bos, id, opts.reason ?? "");

  if (current.category !== "open") {
    if (!opts.allowReopen) throw new ValidationError(`الصفقة في مرحلة "${current.name}". إعادة فتحها تتطلب صلاحية المدير.`);
    return reopenDeal(bos, id, stageId, opts.reason ?? "");
  }

  await db().from("deals").update({ stage_id: stageId, probability: target.probability }).eq("id", id);
  await recordStatus("deal", id, current.key, target.key, bos.userId, opts.reason);
  await audit({ actorId: bos.userId, action: "deal.stage_changed", entityType: "deal", entityId: id, oldValue: { stage: current.key, probability: deal.probability }, newValue: { stage: target.key, probability: target.probability } });
  await emitEvent({
    type: "deal.stage_changed",
    entityType: "deal",
    entityId: id,
    summary: `${current.name} → ${target.name}`,
    payload: { from: current.key, to: target.key, owner_user_id: deal.assigned_to, value: deal.value, currency: deal.currency },
    links: [{ type: "client", id: deal.client_id }, { type: "lead", id: deal.lead_id }],
    actorId: bos.userId,
  });

  // Keep the originating lead's pipeline in step for proposal/negotiation.
  if (deal.lead_id && ["proposal", "negotiation"].includes(target.key)) {
    const { stages: leadStages } = await getPipeline("lead");
    const leadStage = leadStages.find((s) => s.key === target.key);
    if (leadStage) await db().from("leads").update({ stage_id: leadStage.id }).eq("id", deal.lead_id);
  }
}

// Deal Won runs atomically in Postgres (bos_process_deal_won): account,
// schedule, first invoice, commission, onboarding — idempotent.
export async function markDealWon(bos: BosUser, id: string): Promise<void> {
  const { data: settings } = await db().from("bos_settings").select("value").eq("key", "sales").maybeSingle();
  const requiresApproval = Boolean((settings?.value as { deal_won_requires_approval?: boolean } | null)?.deal_won_requires_approval);
  if (requiresApproval && !bos.permissions.get("deals.approve")) {
    throw new ValidationError("كسب الصفقة يتطلب موافقة مدير المبيعات حسب إعدادات الشركة.");
  }
  const { error } = await db().rpc("bos_process_deal_won", { p_deal_id: id, p_actor: bos.userId });
  if (error) throw error;
  await dispatchPendingEvents();
}

export async function markDealLost(bos: BosUser, id: string, reason: string) {
  if (!reason.trim()) throw new ValidationError("سبب الخسارة مطلوب.", { reason: "مطلوب" });
  const { data: deal } = await db().from("deals").select("*, pipeline_stages!inner(key, name, category)").eq("id", id).maybeSingle();
  if (!deal) throw new NotFoundError();
  const current = deal.pipeline_stages as unknown as { key: string; category: string };
  if (current.category === "won") throw new ValidationError("لا يمكن تسجيل صفقة مكسوبة كخاسرة. أعد فتحها أولاً.");
  const { stages } = await getPipeline("deal");
  const lost = stages.find((s) => s.category === "lost");
  if (!lost) throw new ValidationError("لا توجد مرحلة خسارة في المسار.");

  await db().from("deals").update({ stage_id: lost.id, probability: 0, lost_at: nowIso(), lost_reason: reason }).eq("id", id);
  await recordStatus("deal", id, current.key, lost.key, bos.userId, reason);
  await audit({ actorId: bos.userId, action: "deal.lost", entityType: "deal", entityId: id, oldValue: { stage: current.key }, newValue: { stage: lost.key }, reason });
  await db().rpc("bos_update_commission_eligibility", { p_deal_id: id, p_actor: bos.userId });
  await db().from("proposals").update({ status: "rejected", rejected_at: nowIso(), rejection_reason: `Deal lost: ${reason}` }).eq("deal_id", id).in("status", ["published", "viewed"]);
  await emitEvent({
    type: "deal.lost",
    entityType: "deal",
    entityId: id,
    summary: `Deal lost: ${reason}`,
    payload: { reason, owner_user_id: deal.assigned_to, value: deal.value, currency: deal.currency },
    links: [{ type: "client", id: deal.client_id }, { type: "lead", id: deal.lead_id }],
    actorId: bos.userId,
  });
  if (deal.lead_id) {
    const { stages: leadStages } = await getPipeline("lead");
    const leadLost = leadStages.find((s) => s.category === "lost");
    if (leadLost) await db().from("leads").update({ stage_id: leadLost.id, lost_reason: reason }).eq("id", deal.lead_id);
  }
}

// Manager-only: reopen a won/lost deal. A won deal with payments cannot be
// reopened (the commercial lifecycle has started).
export async function reopenDeal(bos: BosUser, id: string, stageId: string, reason: string) {
  if (!reason.trim()) throw new ValidationError("سبب إعادة الفتح مطلوب.", { reason: "مطلوب" });
  const { data: deal } = await db().from("deals").select("*, pipeline_stages!inner(key, category)").eq("id", id).maybeSingle();
  if (!deal) throw new NotFoundError();
  const current = deal.pipeline_stages as unknown as { key: string; category: string };
  if (current.category === "won") {
    const { count } = await db().from("bos_payments").select("id", { count: "exact", head: true }).eq("deal_id", id).in("status", ["completed", "processing"]);
    if ((count ?? 0) > 0) throw new ValidationError("لا يمكن إعادة فتح صفقة تم تحصيل دفعات لها.");
  }
  const { stages } = await getPipeline("deal");
  const target = stages.find((s) => s.id === stageId && s.category === "open");
  if (!target) throw new ValidationError("اختر مرحلة مفتوحة.");
  await db().from("deals").update({ stage_id: stageId, probability: target.probability, lost_at: null, lost_reason: null }).eq("id", id);
  await recordStatus("deal", id, current.key, target.key, bos.userId, reason);
  await audit({ actorId: bos.userId, action: "deal.reopened", entityType: "deal", entityId: id, oldValue: { stage: current.key }, newValue: { stage: target.key }, reason });
  await emitEvent({ type: "deal.reopened", entityType: "deal", entityId: id, summary: `Deal reopened: ${reason}`, payload: { owner_user_id: deal.assigned_to }, actorId: bos.userId });
}

export async function archiveDeal(bos: BosUser, id: string) {
  const { data: deal } = await db().from("deals").select("won_at").eq("id", id).maybeSingle();
  if (deal?.won_at) throw new ValidationError("لا يمكن أرشفة صفقة مكسوبة.");
  await db().from("deals").update({ archived_at: nowIso(), archived_by: bos.userId }).eq("id", id);
  await audit({ actorId: bos.userId, action: "deal.archived", entityType: "deal", entityId: id });
}

