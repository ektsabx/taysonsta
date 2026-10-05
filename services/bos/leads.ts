import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db, dec, type Tables } from "@/lib/bos/db";
import { getTeamUserIds, type BosUser } from "@/lib/bos/auth";
import type { Scope } from "@/lib/bos/permissions";
import { audit, diffFields, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { getPipeline } from "@/services/bos/shared";

export type Lead = Tables<"leads">;

export interface LeadFilters {
  q?: string;
  stage?: string;
  source?: string;
  assigned?: string;
  country?: string;
  industry?: string;
  priority?: string;
  scoreMin?: string;
  from?: string;
  to?: string;
  overdue?: string;
  archived?: string;
  sort?: string;
  dir?: string;
  page?: number;
  pageSize?: number;
}

const sortable = new Set(["name", "company_name", "created_at", "updated_at", "total_score", "estimated_budget", "last_activity_at", "next_activity_at", "country"]);

export async function scopeOwnerFilter(bos: BosUser, scope: Scope): Promise<string | null> {
  if (scope === "all") return null;
  const users = scope === "team" ? await getTeamUserIds(bos) : [bos.userId];
  const list = users.join(",");
  return `assigned_to.in.(${list}),created_by.in.(${list})`;
}

export async function listLeads(bos: BosUser, scope: Scope, f: LeadFilters) {
  const pageSize = Math.min(f.pageSize ?? 25, 200);
  const page = Math.max(1, f.page ?? 1);
  let query = db()
    .from("leads")
    .select(
      "id, lead_number, name, company_name, contact_name, email, phone, country, industry, estimated_budget, budget_currency, total_score, priority, last_activity_at, next_activity_at, created_at, updated_at, assigned_to, converted_deal_id, archived_at, stage_id, pipeline_stages!inner(name, key, category), lead_sources(name)",
      { count: "exact" },
    );

  const owner = await scopeOwnerFilter(bos, scope);
  if (owner) query = query.or(owner);
  query = f.archived === "1" ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  if (f.q) {
    const p = `%${f.q.replace(/[%_,()]/g, " ").trim()}%`;
    query = query.or(`name.ilike.${p},company_name.ilike.${p},email.ilike.${p},contact_name.ilike.${p},lead_number.ilike.${p},phone.ilike.${p}`);
  }
  if (f.stage) query = query.eq("stage_id", f.stage);
  if (f.source) query = query.eq("source_id", f.source);
  if (f.assigned === "none") query = query.is("assigned_to", null);
  else if (f.assigned === "me") query = query.eq("assigned_to", bos.userId);
  else if (f.assigned) query = query.eq("assigned_to", f.assigned);
  if (f.country) query = query.ilike("country", f.country);
  if (f.industry) query = query.ilike("industry", `%${f.industry}%`);
  if (f.priority) query = query.eq("priority", f.priority as Lead["priority"]);
  if (f.scoreMin) query = query.gte("total_score", Number(f.scoreMin));
  if (f.from) query = query.gte("created_at", `${f.from}T00:00:00Z`);
  if (f.to) query = query.lte("created_at", `${f.to}T23:59:59Z`);
  if (f.overdue === "1") query = query.lt("next_activity_at", nowIso());

  const sort = f.sort && sortable.has(f.sort) ? f.sort : "created_at";
  query = query.order(sort, { ascending: f.dir === "asc", nullsFirst: false }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getLead(id: string) {
  // leads↔clients and leads↔deals reference each other in both directions,
  // so embeds must name the foreign key explicitly.
  const { data, error } = await db()
    .from("leads")
    .select(
      "*, pipeline_stages!inner(id, name, key, category), lead_sources(name), clients!leads_client_id_fkey(id, name, company_name), contacts!leads_contact_id_fkey(id, full_name, email)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError();
  return data;
}

export async function findDuplicateLead(email: string | null | undefined, excludeId?: string) {
  if (!email) return null;
  let query = db().from("leads").select("id, name, lead_number, assigned_to").ilike("email", email.trim()).is("archived_at", null);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query.limit(1).maybeSingle();
  return data;
}

export interface LeadInput {
  name: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  industry: string | null;
  source_id: string | null;
  estimated_budget: string | null;
  budget_currency: string | null;
  business_stage: string | null;
  timeline: string | null;
  decision_maker: string | null;
  current_solution: string | null;
  problem: string | null;
  notes: string | null;
  assigned_to: string | null;
  team_id: string | null;
  priority: Lead["priority"];
  budget_score: number;
  fit_score: number;
  intent_score: number;
  engagement_score: number;
  client_id?: string | null;
  booking_id?: string | null;
}

export async function createLead(bos: BosUser, input: LeadInput, opts: { allowDuplicate?: boolean; source?: string } = {}) {
  const duplicate = await findDuplicateLead(input.email);
  if (duplicate && !opts.allowDuplicate) {
    throw new ValidationError(`يوجد عميل محتمل بنفس البريد (${duplicate.lead_number} — ${duplicate.name}). افتح السجل الموجود بدلاً من إنشاء نسخة مكررة.`, {
      email: "البريد مستخدم لعميل محتمل آخر",
    });
  }
  const { stages } = await getPipeline("lead");
  const first = stages.find((s) => s.is_active && s.category === "open");
  if (!first) throw new ValidationError("لا توجد مراحل مفعلة في مسار العملاء المحتملين.");

  const { data, error } = await db()
    .from("leads")
    .insert({
      ...input,
      email: duplicate && opts.allowDuplicate ? null : input.email,
      estimated_budget: dec(input.estimated_budget),
      budget_currency: input.estimated_budget ? input.budget_currency ?? "USD" : input.budget_currency,
      stage_id: first.id,
      created_by: bos.userId,
    })
    .select("*")
    .single();
  if (error) throw error;

  await recordStatus("lead", data.id, null, first.key, bos.userId);
  await audit({ actorId: bos.userId, action: "lead.created", entityType: "lead", entityId: data.id, newValue: { name: data.name, email: data.email, assigned_to: data.assigned_to, source: opts.source ?? "manual" } });
  await emitEvent({
    type: "lead.created",
    entityType: "lead",
    entityId: data.id,
    summary: `Lead created: ${data.name}${data.company_name ? ` (${data.company_name})` : ""}`,
    payload: { lead_id: data.id, assigned_to: data.assigned_to, source_id: data.source_id, country: data.country, creator_user_id: bos.userId },
    links: [{ type: "client", id: data.client_id }],
    actorId: bos.userId,
  });
  if (data.assigned_to) {
    await emitEvent({
      type: "lead.assigned",
      entityType: "lead",
      entityId: data.id,
      summary: `Assigned to ${await nameOf(data.assigned_to)}`,
      payload: { assignee_user_id: data.assigned_to },
      actorId: bos.userId,
      dedupeKey: `lead.assigned:${data.id}:${data.assigned_to}:initial`,
    });
  }
  return data;
}

async function nameOf(userId: string | null) {
  if (!userId) return "—";
  const { data } = await db().from("employees").select("full_name").eq("user_id", userId).maybeSingle();
  return data?.full_name ?? "—";
}

const auditedFields: (keyof Lead)[] = [
  "name", "company_name", "email", "phone", "country", "industry", "estimated_budget", "budget_currency", "assigned_to", "priority",
  "budget_score", "fit_score", "intent_score", "engagement_score", "source_id", "team_id",
];

export async function updateLead(bos: BosUser, id: string, input: LeadInput) {
  const { data: before } = await db().from("leads").select("*").eq("id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  if (input.email && input.email.toLowerCase() !== (before.email ?? "").toLowerCase()) {
    const duplicate = await findDuplicateLead(input.email, id);
    if (duplicate) throw new ValidationError(`البريد مستخدم لعميل محتمل آخر (${duplicate.lead_number}).`, { email: "البريد مستخدم" });
  }
  const { data, error } = await db()
    .from("leads")
    .update({ ...input, estimated_budget: dec(input.estimated_budget) })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  const diff = diffFields(before as unknown as Record<string, unknown>, input as unknown as Record<string, unknown>, auditedFields as string[]);
  if (diff.changed) {
    await audit({ actorId: bos.userId, action: "lead.updated", entityType: "lead", entityId: id, oldValue: diff.oldValue, newValue: diff.newValue });
  }
  if (before.assigned_to !== data.assigned_to) {
    await emitLeadAssigned(bos, data, before.assigned_to);
  }
  return data;
}

async function emitLeadAssigned(bos: BosUser, lead: Lead, previous: string | null) {
  await emitEvent({
    type: "lead.assigned",
    entityType: "lead",
    entityId: lead.id,
    summary: previous ? `Reassigned from ${await nameOf(previous)} to ${await nameOf(lead.assigned_to)}` : `Assigned to ${await nameOf(lead.assigned_to)}`,
    payload: { assignee_user_id: lead.assigned_to, previous_assignee_user_id: previous },
    actorId: bos.userId,
  });
}

export async function assignLeads(bos: BosUser, ids: string[], userId: string | null) {
  for (const id of ids) {
    const { data: before } = await db().from("leads").select("*").eq("id", id).maybeSingle();
    if (!before || before.assigned_to === userId) continue;
    const { data } = await db().from("leads").update({ assigned_to: userId }).eq("id", id).select("*").single();
    await audit({ actorId: bos.userId, action: "lead.reassigned", entityType: "lead", entityId: id, oldValue: { assigned_to: before.assigned_to }, newValue: { assigned_to: userId } });
    if (data) await emitLeadAssigned(bos, data, before.assigned_to);
  }
}

const stageEvent: Record<string, string> = {
  contacted: "lead.contacted",
  replied: "lead.replied",
  qualified: "lead.qualified",
  won: "lead.won",
  lost: "lead.lost",
};

export async function changeLeadStage(bos: BosUser, id: string, stageId: string, reason?: string | null, opts: { allowReopen?: boolean } = {}) {
  const client = db();
  const { data: lead } = await client.from("leads").select("*, pipeline_stages!inner(key, name, category)").eq("id", id).maybeSingle();
  if (!lead) throw new NotFoundError();
  const { stages } = await getPipeline("lead");
  const target = stages.find((s) => s.id === stageId);
  if (!target) throw new ValidationError("مرحلة غير صالحة.");
  const current = lead.pipeline_stages as unknown as { key: string; name: string; category: string };
  if (current.key === target.key) return lead;

  if (current.category !== "open" && !opts.allowReopen) {
    throw new ValidationError(`هذا العميل المحتمل في مرحلة "${current.name}". إعادة فتحه تتطلب صلاحية إدارة العملاء المحتملين.`);
  }
  if (target.category === "lost" && !reason?.trim()) {
    throw new ValidationError("سبب الخسارة مطلوب.", { reason: "سبب الخسارة مطلوب" });
  }
  if (target.key === "qualified") {
    const { data: sales } = await client.from("bos_settings").select("value").eq("key", "sales").maybeSingle();
    const minScore = Number((sales?.value as { qualified_min_score?: number } | null)?.qualified_min_score ?? 0);
    if ((lead.total_score ?? 0) < minScore) {
      throw new ValidationError(`نقاط التأهيل (${lead.total_score}) أقل من الحد الأدنى المطلوب (${minScore}). حدّث تقييم العميل أولاً.`);
    }
  }

  await client
    .from("leads")
    .update({ stage_id: stageId, lost_reason: target.category === "lost" ? reason ?? null : lead.lost_reason })
    .eq("id", id);
  await recordStatus("lead", id, current.key, target.key, bos.userId, reason);
  await audit({ actorId: bos.userId, action: "lead.stage_changed", entityType: "lead", entityId: id, oldValue: { stage: current.key }, newValue: { stage: target.key }, reason });
  await emitEvent({
    type: stageEvent[target.key] ?? "lead.stage_changed",
    entityType: "lead",
    entityId: id,
    summary: `${current.name} → ${target.name}${reason ? ` (${reason})` : ""}`,
    payload: { from: current.key, to: target.key, reason, assignee_user_id: lead.assigned_to },
    links: [{ type: "client", id: lead.client_id }, { type: "deal", id: lead.converted_deal_id }],
    actorId: bos.userId,
  });
  return lead;
}

export async function archiveLead(bos: BosUser, id: string, archived: boolean) {
  const { error } = await db()
    .from("leads")
    .update({ archived_at: archived ? nowIso() : null, archived_by: archived ? bos.userId : null })
    .eq("id", id);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: archived ? "lead.archived" : "lead.restored", entityType: "lead", entityId: id });
  await emitEvent({ type: archived ? "lead.archived" : "lead.restored", entityType: "lead", entityId: id, summary: archived ? "Lead archived" : "Lead restored", actorId: bos.userId });
}

// ---------------------------------------------------------------------------
// Convert lead → deal (docs/bos/05 workflow 5). Never duplicates accounts or
// contacts: links existing ones by id/email.
// ---------------------------------------------------------------------------

export interface ConvertInput {
  clientId: string | null;
  newClientName: string | null;
  newClientEmail: string | null;
  contactId: string | null;
  dealName: string;
  value: string;
  currency: string;
  expectedCloseDate: string | null;
}

export async function convertLeadToDeal(bos: BosUser, leadId: string, input: ConvertInput): Promise<string> {
  const client = db();
  const { data: lead } = await client.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) throw new NotFoundError();
  if (lead.converted_deal_id) {
    throw new ValidationError("تم تحويل هذا العميل المحتمل إلى صفقة بالفعل.");
  }

  // 1. Account: existing (selected) → existing by email → new.
  let clientId = input.clientId ?? lead.client_id;
  if (!clientId) {
    const email = (input.newClientEmail ?? lead.email ?? "").trim().toLowerCase();
    if (!email) throw new ValidationError("اختر حساباً موجوداً أو أدخل بريد الحساب الجديد.", { newClientEmail: "مطلوب" });
    const { data: existing } = await client.from("clients").select("id").eq("normalized_email", email).is("archived_at", null).maybeSingle();
    if (existing) {
      clientId = existing.id;
    } else {
      const { data: created, error } = await client
        .from("clients")
        .insert({
          name: input.newClientName || lead.company_name || lead.name,
          company_name: lead.company_name,
          email,
          phone: lead.phone,
          country: lead.country,
          website: lead.website,
          industry: lead.industry,
          city: lead.city,
          account_status: "prospect",
          source_lead_id: lead.id,
          created_by: bos.userId,
          crm_stage: "qualified",
        })
        .select("id, name")
        .single();
      if (error) throw error;
      clientId = created.id;
      await audit({ actorId: bos.userId, action: "client.created", entityType: "client", entityId: created.id, newValue: { name: created.name, from_lead: lead.id } });
      await emitEvent({ type: "client.created", entityType: "client", entityId: created.id, summary: `Account created from lead ${lead.lead_number}`, links: [{ type: "lead", id: lead.id }], actorId: bos.userId });
    }
  }

  // 2. Contact: selected → existing by email → new from lead contact info.
  let contactId = input.contactId ?? lead.contact_id;
  if (!contactId && (lead.contact_name || lead.email)) {
    const email = lead.email?.trim().toLowerCase() ?? null;
    const { data: existing } = email ? await client.from("contacts").select("id, client_id").ilike("email", email).is("archived_at", null).maybeSingle() : { data: null };
    if (existing) {
      contactId = existing.id;
      if (!existing.client_id) await client.from("contacts").update({ client_id: clientId }).eq("id", existing.id);
    } else {
      const { data: created } = await client
        .from("contacts")
        .insert({ client_id: clientId, full_name: lead.contact_name || lead.name, email, phone: lead.phone, is_decision_maker: /yes|نعم|true/i.test(lead.decision_maker ?? ""), created_by: bos.userId })
        .select("id")
        .single();
      contactId = created?.id ?? null;
    }
  }
  if (contactId) {
    await client.from("clients").update({ primary_contact_id: contactId }).eq("id", clientId).is("primary_contact_id", null);
  }

  // 3. Deal
  const { pipeline, stages } = await getPipeline("deal");
  const firstStage = stages.find((s) => s.is_active && s.category === "open");
  if (!firstStage) throw new ValidationError("لا توجد مراحل مفعلة في مسار الصفقات.");
  const { data: deal, error: dealError } = await client
    .from("deals")
    .insert({
      name: input.dealName,
      client_id: clientId!,
      contact_id: contactId,
      lead_id: lead.id,
      source_id: lead.source_id,
      pipeline_id: pipeline.id,
      stage_id: firstStage.id,
      value: dec(input.value),
      currency: input.currency,
      probability: firstStage.probability,
      expected_close_date: input.expectedCloseDate,
      assigned_to: lead.assigned_to ?? bos.userId,
      scope: lead.problem ? `Problem/opportunity: ${lead.problem}` : null,
      created_by: bos.userId,
    })
    .select("*")
    .single();
  if (dealError) throw dealError;

  await client
    .from("leads")
    .update({ converted_deal_id: deal.id, converted_at: nowIso(), client_id: clientId, contact_id: contactId })
    .eq("id", lead.id);
  await recordStatus("deal", deal.id, null, firstStage.key, bos.userId);
  await audit({ actorId: bos.userId, action: "lead.converted", entityType: "lead", entityId: lead.id, newValue: { deal_id: deal.id, client_id: clientId, contact_id: contactId } });

  const links = [{ type: "lead", id: lead.id }, { type: "client", id: clientId }, { type: "contact", id: contactId }];
  await emitEvent({
    type: "deal.created",
    entityType: "deal",
    entityId: deal.id,
    summary: `Deal created: ${deal.name} (${deal.value} ${deal.currency})`,
    payload: { deal_id: deal.id, value: deal.value, currency: deal.currency, owner_user_id: deal.assigned_to, client_id: clientId },
    links,
    actorId: bos.userId,
  });
  await emitEvent({
    type: "lead.converted",
    entityType: "lead",
    entityId: lead.id,
    summary: `Converted to deal ${deal.deal_number}`,
    payload: { deal_id: deal.id },
    links: [{ type: "deal", id: deal.id }, { type: "client", id: clientId }],
    actorId: bos.userId,
  });
  return deal.id;
}

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
