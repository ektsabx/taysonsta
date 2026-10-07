import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { audit } from "@/lib/bos/audit";
import { nowIso } from "@/lib/bos/clock";
import { getSetting } from "@/lib/bos/settings";
import { formatMoney } from "@/lib/bos/money";
import { statusDef } from "@/lib/bos/labels";
import { translate } from "@/lib/bos/i18n/core";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";
import { renderTemplate, validateTemplate, type TemplateData } from "@/lib/bos/documents/template";
import { parseMarkup } from "@/lib/bos/documents/markup";
import { documentHtml, defaultDocStyle, type DocFrame, type DocStyle } from "@/lib/bos/documents/html";
import { documentDocx, type DocxLogo } from "@/lib/bos/documents/docx";
import { currentCompensation, getEmployeePrivate } from "@/services/bos/hr/people";

// Documents & templates (docs/bos/30 §3.5, §8; doc 31 Phase 5).
// • Templates hold design + content with {{variables}}; every edit is a new,
//   immutable version.
// • Generation resolves variables from the real record (permission-checked),
//   renders HTML and DOCX, and freezes the result (DB trigger): the issued /
//   sent / signed copy never changes, even if the template or record does.

export type DocType = Tables<"document_templates">["doc_type"];
export type Template = Tables<"document_templates">;
export type TemplateVersion = Tables<"document_template_versions">;

export const docTypeLabels: Record<string, string> = {
  proposal: "عرض سعر / مقترح",
  client_contract: "عقد عميل",
  invoice: "فاتورة",
  email: "قالب بريد",
  job_offer: "عرض عمل",
  employment_contract: "عقد عمل",
  nda_ip: "اتفاقية السرية والملكية الفكرية",
  hr_document: "مستند موارد بشرية",
  report: "قالب تقرير",
};

// Which records each document type is generated from.
export const docTypeEntities: Record<string, string[]> = {
  invoice: ["invoice"],
  client_contract: ["contract", "deal"],
  proposal: ["deal"],
  job_offer: ["job_offer"],
  employment_contract: ["employee"],
  nda_ip: ["employee", "client"],
  hr_document: ["employee"],
};

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function listTemplates(filters: { docType?: string; language?: string; active?: boolean } = {}) {
  let q = db().from("document_templates").select("*, document_template_versions!document_templates_current_version_fk(version, created_at)").order("doc_type").order("language").order("name");
  if (filters.docType) q = q.eq("doc_type", filters.docType);
  if (filters.language) q = q.eq("language", filters.language);
  if (filters.active !== undefined) q = q.eq("is_active", filters.active);
  const { data } = await q;
  return data ?? [];
}

export async function getTemplate(id: string) {
  const { data: t } = await db().from("document_templates").select("*").eq("id", id).maybeSingle();
  if (!t) throw new NotFoundError();
  const { data: versions } = await db().from("document_template_versions").select("*").eq("template_id", id).order("version", { ascending: false });
  const current = (versions ?? []).find((v) => v.id === t.current_version_id) ?? versions?.[0] ?? null;
  return { template: t, versions: versions ?? [], current };
}

function assertCanEditTemplate(bos: BosUser, t: Pick<Template, "edit_role_keys">) {
  if (!can(bos, "documents.manage", "all")) throw new ForbiddenError();
  if (t.edit_role_keys.length && !bos.isSuperAdmin && !t.edit_role_keys.some((k) => bos.roleKeys.includes(k))) throw new ForbiddenError("هذا القالب مقيد بأدوار أخرى.");
}

function cleanStyle(style: Partial<DocStyle> | null | undefined): DocStyle {
  const s = { ...defaultDocStyle, ...(style ?? {}) };
  return {
    primary: /^#[0-9a-f]{6}$/i.test(s.primary) ? s.primary : defaultDocStyle.primary,
    accent: /^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : defaultDocStyle.accent,
    fontSize: Math.min(Math.max(Number(s.fontSize) || 11, 8), 16),
    showLogo: Boolean(s.showLogo),
  };
}

export interface TemplateInput {
  key: string;
  name: string;
  doc_type: DocType;
  language: "ar" | "en";
  module: string;
  description: string | null;
  edit_role_keys: string[];
}

export interface VersionInput {
  subject: string | null;
  body: string;
  style: Partial<DocStyle>;
  header_note: string | null;
  footer_note: string | null;
  change_note: string | null;
}

function checkBody(v: VersionInput, docType: string) {
  if (!v.body.trim()) throw new ValidationError("محتوى القالب مطلوب.", { body: "مطلوب" });
  if (v.body.length > 100_000) throw new ValidationError("المحتوى طويل جداً.", { body: "طويل جداً" });
  const err = validateTemplate(v.body) ?? (v.subject ? validateTemplate(v.subject) : null);
  if (err) throw new ValidationError(`خطأ في صياغة المتغيرات: ${err}`, { body: err });
  if (docType === "email" && !v.subject?.trim()) throw new ValidationError("موضوع البريد مطلوب لقوالب البريد.", { subject: "مطلوب" });
}

export async function createTemplate(bos: BosUser, input: TemplateInput, version: VersionInput): Promise<string> {
  if (!can(bos, "documents.manage", "all")) throw new ForbiddenError();
  if (!/^[a-z0-9_]{3,60}$/.test(input.key)) throw new ValidationError("المفتاح حروف إنجليزية صغيرة وأرقام و _ فقط.", { key: "غير صالح" });
  checkBody(version, input.doc_type);
  const { data: t, error } = await db().from("document_templates").insert({ ...input, created_by: bos.userId, updated_by: bos.userId }).select("id").single();
  if (error) throw error.code === "23505" ? new ValidationError("المفتاح مستخدم لقالب آخر.", { key: "مكرر" }) : error;
  await addVersion(bos, t.id, version, true);
  await audit({ actorId: bos.userId, action: "document_template.created", entityType: "document_template", entityId: t.id, newValue: input });
  return t.id;
}

// Every content/design change is a new immutable version.
export async function addVersion(bos: BosUser, templateId: string, v: VersionInput, skipPermission = false): Promise<string> {
  const { data: t } = await db().from("document_templates").select("*").eq("id", templateId).maybeSingle();
  if (!t) throw new NotFoundError();
  if (!skipPermission) assertCanEditTemplate(bos, t);
  checkBody(v, t.doc_type);
  const { data: last } = await db().from("document_template_versions").select("version").eq("template_id", templateId).order("version", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await db()
    .from("document_template_versions")
    .insert({ template_id: templateId, version: (last?.version ?? 0) + 1, subject: v.subject, body: v.body, style: cleanStyle(v.style) as never, header_note: v.header_note, footer_note: v.footer_note, change_note: v.change_note, created_by: bos.userId })
    .select("id, version")
    .single();
  if (error) throw error;
  await db().from("document_templates").update({ current_version_id: data.id, updated_by: bos.userId }).eq("id", templateId);
  if (!skipPermission) await audit({ actorId: bos.userId, action: "document_template.version_added", entityType: "document_template", entityId: templateId, newValue: { version: data.version, change_note: v.change_note } });
  return data.id;
}

export async function updateTemplateMeta(bos: BosUser, id: string, patch: { name?: string; is_active?: boolean; description?: string | null; edit_role_keys?: string[] }) {
  const { data: t } = await db().from("document_templates").select("*").eq("id", id).maybeSingle();
  if (!t) throw new NotFoundError();
  assertCanEditTemplate(bos, t);
  if (patch.name !== undefined && !patch.name.trim()) throw new ValidationError("الاسم مطلوب.", { name: "مطلوب" });
  await db().from("document_templates").update({ ...patch, updated_by: bos.userId }).eq("id", id);
  await audit({ actorId: bos.userId, action: "document_template.updated", entityType: "document_template", entityId: id, oldValue: { name: t.name, is_active: t.is_active, edit_role_keys: t.edit_role_keys }, newValue: patch });
}

// Roll back = a new version copying an older one (history is never rewritten).
export async function restoreVersion(bos: BosUser, templateId: string, versionId: string) {
  const { data: v } = await db().from("document_template_versions").select("*").eq("id", versionId).eq("template_id", templateId).maybeSingle();
  if (!v) throw new NotFoundError();
  return addVersion(bos, templateId, { subject: v.subject, body: v.body, style: v.style as Partial<DocStyle>, header_note: v.header_note, footer_note: v.footer_note, change_note: `Restored from v${v.version}` });
}

export async function duplicateTemplate(bos: BosUser, id: string, key: string, name: string, language?: "ar" | "en") {
  const { template, current } = await getTemplate(id);
  if (!current) throw new ValidationError("لا يوجد إصدار لنسخه.");
  return createTemplate(bos, { key, name, doc_type: template.doc_type, language: language ?? (template.language as "ar" | "en"), module: template.module, description: template.description, edit_role_keys: template.edit_role_keys }, { subject: current.subject, body: current.body, style: current.style as Partial<DocStyle>, header_note: current.header_note, footer_note: current.footer_note, change_note: `Duplicated from ${template.key} v${current.version}` });
}

// ---------------------------------------------------------------------------
// Data resolvers (real records only; permission-checked)
// ---------------------------------------------------------------------------

async function companyData() {
  const c = await getSetting("company");
  return {
    name: c.trade_name || c.name,
    legal_name: c.legal_name || c.name,
    trade_name: c.trade_name || c.name,
    address: [c.address, c.city, c.country].filter(Boolean).join("، "),
    city: c.city ?? "",
    country: c.country ?? "",
    phone: c.contact_phone,
    email: c.contact_email,
    website: c.website ?? "",
    tax_id: c.tax_id,
    commercial_registration: c.commercial_registration ?? "",
    _logo: c.logo_path,
  };
}

function clientData(c: Pick<Tables<"clients">, "name" | "company_name" | "email" | "phone" | "address" | "city" | "country" | "tax_id"> | null) {
  if (!c) return { display_name: "" };
  return { ...c, display_name: c.company_name || c.name };
}

async function assertEntityAccess(bos: BosUser, docType: string, entityType: string, entityId: string) {
  if (!docTypeEntities[docType]?.includes(entityType)) throw new ValidationError("هذا القالب لا يُستخدم مع هذا النوع من السجلات.");
  const need: Record<string, Parameters<typeof can>[1]> = { invoice: "invoices.read", contract: "contracts.read", deal: "deals.read", job_offer: "recruitment.read", client: "clients.read", employee: "employees.read" };
  if (!can(bos, need[entityType] ?? "documents.read")) throw new ForbiddenError();
  // Salary / legal data: HR sensitive access only.
  if (entityType === "employee" && ["employment_contract", "hr_document"].includes(docType) && !(bos.isSuperAdmin || can(bos, "payroll.read", "all") || can(bos, "employees.view_sensitive", "all"))) throw new ForbiddenError("يتطلب صلاحية بيانات الموظفين الحساسة.");
  if (!(await canAccessEntity(bos, entityType, entityId))) throw new ForbiddenError();
}

export async function resolveData(docType: string, entityType: string, entityId: string, locale: "ar" | "en"): Promise<{ data: TemplateData; reference: string | null; title: string }> {
  const c = db();
  const company = await companyData();
  const base: TemplateData = { company, today: nowIso().slice(0, 10) };
  const t = (s: string) => translate(locale, s);

  if (entityType === "invoice") {
    const { data: inv } = await c.from("bos_invoices").select("*, clients(name, company_name, email, phone, address, city, country, tax_id)").eq("id", entityId).maybeSingle();
    if (!inv) throw new NotFoundError();
    const { data: items } = await c.from("invoice_items").select("description, quantity, unit_price, line_total, sort_order").eq("invoice_id", entityId).order("sort_order");
    return {
      reference: inv.invoice_number,
      title: `${t("فاتورة")} ${inv.invoice_number}`,
      data: { ...base, invoice: { ...inv, number: inv.invoice_number }, client: clientData(inv.clients as never), lines: (items ?? []).map((i) => ({ ...i, currency: inv.currency })) },
    };
  }
  if (entityType === "contract" || (entityType === "deal" && docType === "client_contract")) {
    let contract: Record<string, unknown>;
    let dealId: string | null;
    if (entityType === "contract") {
      const { data: ct } = await c.from("contracts").select("*").eq("id", entityId).maybeSingle();
      if (!ct) throw new NotFoundError();
      contract = { ...ct, number: ct.contract_number };
      dealId = ct.deal_id;
    } else {
      const { data: d } = await c.from("deals").select("*").eq("id", entityId).maybeSingle();
      if (!d) throw new NotFoundError();
      const terms = ((d.payment_terms as unknown as { label: string; percent: number | string }[]) ?? []).map((x) => `- ${x.label}: ${x.percent}%`).join("\n");
      contract = { number: d.deal_number, title: `${t("عقد تقديم خدمات")} — ${d.name}`, value: d.value, currency: d.currency, payment_terms: terms, client_id: d.client_id, start_date: null, end_date: null };
      dealId = d.id;
    }
    const [{ data: client }, { data: deal }] = await Promise.all([
      c.from("clients").select("name, company_name, email, phone, address, city, country, tax_id").eq("id", String(contract.client_id)).maybeSingle(),
      dealId ? c.from("deals").select("deal_number, name, scope").eq("id", dealId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const scope = (deal?.scope as string | null) ?? null;
    return {
      reference: String(contract.number ?? ""),
      title: String(contract.title ?? t("عقد")),
      data: { ...base, contract, client: clientData(client), deal: deal ? { number: deal.deal_number, name: deal.name } : {}, scope: typeof scope === "string" ? scope : null },
    };
  }
  if (entityType === "deal") {
    const { data: d } = await c.from("deals").select("*, clients(name, company_name, email, phone, address, city, country, tax_id)").eq("id", entityId).maybeSingle();
    if (!d) throw new NotFoundError();
    const [{ data: proposal }] = await Promise.all([
      c.from("proposals").select("title, total_amount, currency, valid_until, terms, assumptions").eq("deal_id", entityId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return {
      reference: d.deal_number,
      title: `${t("عرض سعر")} — ${d.name}`,
      data: {
        ...base,
        deal: { number: d.deal_number, name: d.name, value: d.value, currency: d.currency },
        client: clientData(d.clients as never),
        payment_terms: (d.payment_terms as unknown as { label: string; percent: number | string }[]) ?? [],
        proposal: proposal ?? {},
      },
    };
  }
  if (entityType === "job_offer") {
    const { data: o } = await c.from("job_offers").select("*, candidates(first_name, last_name, email, phone), departments(name)").eq("id", entityId).maybeSingle();
    if (!o) throw new NotFoundError();
    const cand = o.candidates as unknown as { first_name: string; last_name: string | null; email: string | null; phone: string | null } | null;
    const { data: mgr } = o.manager_employee_id ? await c.from("employees").select("full_name").eq("id", o.manager_employee_id).maybeSingle() : { data: null };
    const allowances = Array.isArray(o.allowances) ? (o.allowances as { name?: string; label?: string; amount?: string | number }[]).map((a) => ({ name: a.name ?? a.label ?? "", amount: a.amount ?? 0 })) : [];
    return {
      reference: o.offer_number,
      title: `${t("عرض عمل")} — ${o.position_title}`,
      data: {
        ...base,
        offer: { ...o, number: o.offer_number, employment_type_label: t(statusDef("employment_type", o.employment_type).label) },
        candidate: { full_name: [cand?.first_name, cand?.last_name].filter(Boolean).join(" "), email: cand?.email ?? "", phone: cand?.phone ?? "" },
        department: { name: (o.departments as unknown as { name: string } | null)?.name ?? "" },
        manager: { name: mgr?.full_name ?? "" },
        allowances,
        currency: o.currency,
      },
    };
  }
  if (entityType === "employee") {
    const { data: e } = await c.from("employees").select("*, departments(name)").eq("id", entityId).maybeSingle();
    if (!e) throw new NotFoundError();
    const today = nowIso().slice(0, 10);
    const [priv, comp, { data: contract }, { data: sep }, { data: comps }] = await Promise.all([
      getEmployeePrivate(entityId),
      currentCompensation(entityId, today),
      c.from("employee_contracts").select("*").eq("employee_id", entityId).in("status", ["active", "draft", "pending_signature"]).order("start_date", { ascending: false }).limit(1).maybeSingle(),
      c.from("employee_separations").select("last_working_day").eq("employee_id", entityId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      c.from("employee_salary_components").select("amount, effective_from, effective_to, salary_components(kind, calc_type)").eq("employee_id", entityId),
    ]);
    const fixedEarnings = (comps ?? []).filter((x) => {
      const sc = x.salary_components as unknown as { kind: string; calc_type: string } | null;
      return sc?.kind === "earning" && sc.calc_type === "fixed" && x.effective_from <= today && (!x.effective_to || x.effective_to >= today);
    });
    const basic = comp?.basic_salary ?? contract?.basic_salary ?? null;
    const total = basic !== null && fixedEarnings.length ? String(fixedEarnings.reduce((s, x) => s + Number(x.amount), Number(basic))) : null;
    const employee = { full_name: e.full_name, position: e.position ?? "", department: (e.departments as unknown as { name: string } | null)?.name ?? "", start_date: e.start_date, end_date: sep?.last_working_day ?? null, email: e.email ?? "", phone: e.phone ?? "", national_id: priv?.national_id ?? "", code: e.employee_code ?? "" };
    return {
      reference: contract?.contract_number ?? e.employee_code ?? null,
      title: docType === "employment_contract" ? `${t("عقد عمل")} — ${e.full_name}` : docType === "nda_ip" ? `${t("اتفاقية السرية والملكية الفكرية")} — ${e.full_name}` : e.full_name,
      data: {
        ...base,
        employee,
        party: { name: e.full_name, type: "employee" },
        contract: contract ? { ...contract, number: contract.contract_number, position_title: contract.position_title ?? e.position } : { number: "", position_title: e.position ?? "", start_date: e.start_date, basic_salary: basic, currency: comp?.currency ?? "", notice_period_days: null, terms: null },
        salary: { basic, currency: comp?.currency ?? contract?.currency ?? "", total },
      },
    };
  }
  if (entityType === "client") {
    const { data: cl } = await c.from("clients").select("name, company_name, email, phone, address, city, country, tax_id").eq("id", entityId).maybeSingle();
    if (!cl) throw new NotFoundError();
    const client = clientData(cl);
    return { reference: null, title: `${t("اتفاقية السرية والملكية الفكرية")} — ${client.display_name}`, data: { ...base, client, party: { name: client.display_name, type: "client" } } };
  }
  throw new ValidationError("نوع السجل غير مدعوم.");
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function fmtDate(locale: "ar" | "en") {
  const f = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  return (d: string) => {
    const date = new Date(d.length === 10 ? `${d}T00:00:00Z` : d);
    return Number.isNaN(date.getTime()) ? d : f.format(date);
  };
}

export async function renderWithVersion(version: Pick<TemplateVersion, "body" | "subject" | "style" | "header_note" | "footer_note">, language: "ar" | "en", data: TemplateData, title: string, docNumber = "—") {
  const opts = { locale: language, formatMoney: (v: unknown, cur: string | null | undefined) => formatMoney(v, cur || null, language === "ar" ? "ar-EG" : "en-US"), formatDate: fmtDate(language) };
  const withDoc = { ...data, doc: { number: docNumber, title } };
  const markup = renderTemplate(version.body, withDoc, opts);
  const subject = version.subject ? renderTemplate(version.subject, withDoc, opts).replace(/\\(.)/g, "$1") : null;
  const company = data.company as Awaited<ReturnType<typeof companyData>>;
  const style = cleanStyle({ ...(version.style as Partial<DocStyle>), primary: (version.style as Partial<DocStyle>)?.primary });
  const frame: DocFrame = {
    dir: language === "ar" ? "rtl" : "ltr",
    lang: language,
    title,
    style,
    logoUrl: company._logo ? "/api/bos/company-asset?k=logo" : null,
    headerLines: [company.legal_name, [company.address, company.phone, company.email].filter(Boolean).join(" · "), [company.commercial_registration ? `${translate(language, "رقم السجل التجاري")}: ${company.commercial_registration}` : "", company.tax_id ? `${translate(language, "الرقم الضريبي")}: ${company.tax_id}` : ""].filter(Boolean).join(" · "), version.header_note ?? ""].filter(Boolean),
    footerLines: [version.footer_note ?? "", company.website].filter(Boolean),
  };
  const blocks = parseMarkup(markup);
  return { markup, subject, frame, blocks, html: documentHtml(blocks, frame) };
}

async function loadLogo(path: string | null): Promise<DocxLogo | null> {
  if (!path) return null;
  const type = /\.png$/i.test(path) ? "png" : /\.jpe?g$/i.test(path) ? "jpeg" : null;
  if (!type) return null; // SVG/WEBP can't be embedded in DOCX reliably
  const { data } = await db().storage.from("bos-files").download(path);
  return data ? { bytes: new Uint8Array(await data.arrayBuffer()), type } : null;
}

async function sha256(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Preview without storing anything (template editor / before issuing).
export async function previewDocument(bos: BosUser, templateId: string, entityType: string, entityId: string, versionOverride?: VersionInput) {
  const { template, current } = await getTemplate(templateId);
  if (!current && !versionOverride) throw new ValidationError("القالب بدون محتوى.");
  await assertEntityAccess(bos, template.doc_type, entityType, entityId);
  const lang = template.language as "ar" | "en";
  const r = await resolveData(template.doc_type, entityType, entityId, lang);
  const v = versionOverride ? { ...versionOverride, style: cleanStyle(versionOverride.style) as never } : current!;
  if (versionOverride) checkBody(versionOverride, template.doc_type);
  return renderWithVersion(v, lang, r.data, r.title);
}

export async function generateDocument(bos: BosUser, templateId: string, entityType: string, entityId: string) {
  if (!can(bos, "documents.create")) throw new ForbiddenError();
  const { template, current } = await getTemplate(templateId);
  if (!template.is_active) throw new ValidationError("القالب غير مفعّل.");
  if (!current) throw new ValidationError("القالب بدون محتوى.");
  if (template.doc_type === "email" || template.doc_type === "report") throw new ValidationError("هذا النوع لا يُصدر كمستند.");
  await assertEntityAccess(bos, template.doc_type, entityType, entityId);
  const lang = template.language as "ar" | "en";
  const r = await resolveData(template.doc_type, entityType, entityId, lang);

  // Reserve the number first so it can be printed on the document itself.
  const { data: num } = await db().rpc("bos_next_number", { seq_key: "document" });
  const number = String(num);
  const out = await renderWithVersion(current, lang, r.data, r.title, number);
  const hash = await sha256(JSON.stringify({ markup: out.markup, frame: out.frame }));
  const { data: doc, error } = await db()
    .from("generated_documents")
    .insert({ number, template_id: template.id, template_version_id: current.id, doc_type: template.doc_type, language: lang, entity_type: entityType, entity_id: entityId, reference: r.reference, title: r.title, data_snapshot: r.data as never, markup: out.markup, rendered_html: out.html, style: out.frame.style as never, content_hash: hash, created_by: bos.userId })
    .select("id")
    .single();
  if (error) throw error;

  // Frozen DOCX copy in private storage.
  const company = r.data.company as Awaited<ReturnType<typeof companyData>>;
  const bytes = documentDocx(out.blocks, out.frame, await loadLogo(company._logo), nowIso());
  const path = `documents/${doc.id}.docx`;
  const up = await db().storage.from("bos-files").upload(path, bytes, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: false });
  if (!up.error) await db().from("generated_documents").update({ docx_path: path }).eq("id", doc.id);
  await audit({ actorId: bos.userId, action: "document.issued", entityType, entityId, newValue: { document_id: doc.id, number, template: template.key, version: current.version, hash } });
  return { id: doc.id, number };
}

export async function listDocuments(filters: { entityType?: string; entityId?: string; docType?: string; limit?: number } = {}) {
  let q = db().from("generated_documents").select("id, number, doc_type, language, entity_type, entity_id, reference, title, status, sent_at, created_at, created_by, template_id").order("created_at", { ascending: false }).limit(filters.limit ?? 200);
  if (filters.entityType) q = q.eq("entity_type", filters.entityType);
  if (filters.entityId) q = q.eq("entity_id", filters.entityId);
  if (filters.docType) q = q.eq("doc_type", filters.docType);
  const { data } = await q;
  return data ?? [];
}

export async function getDocument(bos: BosUser, id: string) {
  const { data: d } = await db().from("generated_documents").select("*").eq("id", id).maybeSingle();
  if (!d) throw new NotFoundError();
  if (!can(bos, "documents.read")) throw new ForbiddenError();
  await assertEntityAccess(bos, d.doc_type, d.entity_type, d.entity_id).catch((e) => {
    // Access to the source record is required to open its documents.
    throw e instanceof ForbiddenError || e instanceof NotFoundError ? new ForbiddenError() : e;
  });
  return d;
}

export async function documentDocxBytes(bos: BosUser, id: string): Promise<{ bytes: Uint8Array; filename: string }> {
  const d = await getDocument(bos, id);
  if (d.docx_path) {
    const { data } = await db().storage.from("bos-files").download(d.docx_path);
    if (data) return { bytes: new Uint8Array(await data.arrayBuffer()), filename: `${d.number}.docx` };
  }
  // Rebuild from the frozen markup + style (identical content).
  const company = await companyData();
  const frame: DocFrame = { dir: d.language === "ar" ? "rtl" : "ltr", lang: d.language as "ar" | "en", title: d.title, style: cleanStyle(d.style as Partial<DocStyle>), logoUrl: null, headerLines: [company.legal_name], footerLines: [] };
  return { bytes: documentDocx(parseMarkup(d.markup), frame, await loadLogo(company._logo), d.created_at), filename: `${d.number}.docx` };
}

// The frozen document plus a signature table with provider anchors
// (/sn1/, /dt1/ …) so each signer's signature lands in their own row
// (e-signature, docs/bos/30 §19). The frozen copy itself is not changed.
export async function documentDocxForSigning(bos: BosUser, id: string, signers: { recipientId: number; name: string; role: string }[]): Promise<{ bytes: Uint8Array; filename: string }> {
  const d = await getDocument(bos, id);
  const company = await companyData();
  const ar = d.language === "ar";
  const esc = (t: string) => t.replace(/([\\*|#\[\]_-])/g, "\\$1");
  const block = [
    "", "[[pagebreak]]", "", ar ? "## التوقيعات" : "## Signatures", "",
    ar ? "| الطرف | التوقيع | التاريخ |" : "| Party | Signature | Date |", "|---|---|---|",
    ...signers.map((s) => `| ${esc(s.name)} (${esc(s.role)}) | /sn${s.recipientId}/ | /dt${s.recipientId}/ |`),
  ].join("\n");
  const frame: DocFrame = { dir: ar ? "rtl" : "ltr", lang: d.language as "ar" | "en", title: d.title, style: cleanStyle(d.style as Partial<DocStyle>), logoUrl: null, headerLines: [company.legal_name], footerLines: [] };
  return { bytes: documentDocx(parseMarkup(`${d.markup}\n${block}`), frame, await loadLogo(company._logo), d.created_at), filename: `${d.number}.docx` };
}

export async function setDocumentStatus(bos: BosUser, id: string, status: "sent" | "signed" | "void", extra: { sent_to?: string[]; void_reason?: string } = {}) {
  const d = await getDocument(bos, id);
  if (!can(bos, "documents.create")) throw new ForbiddenError();
  if (d.status === "void") throw new ValidationError("المستند ملغى.");
  if (status === "void" && !extra.void_reason?.trim()) throw new ValidationError("سبب الإلغاء مطلوب.");
  const patch = status === "sent" ? { status, sent_at: nowIso(), sent_to: extra.sent_to ?? [] } : status === "void" ? { status, void_reason: extra.void_reason ?? null, voided_at: nowIso() } : { status };
  const { error } = await db().from("generated_documents").update(patch).eq("id", id);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: `document.${status}`, entityType: d.entity_type, entityId: d.entity_id, newValue: { document_id: id, ...extra } });
}

// Sends the frozen copy (DOCX attached) with the "email_document" template
// in the document's language; marks it sent only when the provider accepted it.
export async function emailDocument(bos: BosUser, id: string, to: string[]) {
  const d = await getDocument(bos, id);
  if (d.status === "void") throw new ValidationError("المستند ملغى.");
  const recipients = [...new Set(to.map((x) => x.trim().toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))];
  if (!recipients.length || recipients.length > 20) throw new ValidationError("أدخل بريداً صالحاً (حتى 20 مستلماً).", { to: "غير صالح" });
  const lang = d.language as "ar" | "en";
  const mail = await renderEmailTemplate("email_document", { doc: { number: d.number, title: d.title } }, lang);
  const { bytes, filename } = await documentDocxBytes(bos, id);
  const { sendEmail } = await import("@/lib/bos/integrations/email");
  const res = await sendEmail({ to: recipients, subject: mail?.subject || d.title, text: mail?.text || d.title, html: mail?.html, attachments: [{ filename, content: bytes }] });
  if (res.status !== "sent") throw new ValidationError(res.status === "skipped" ? `لم يُرسل: ${res.reason}` : `فشل الإرسال: ${res.error}`);
  await setDocumentStatus(bos, id, d.status === "signed" ? "signed" : "sent", { sent_to: recipients });
  return res;
}

// Email templates: subject + body rendered with the same engine (used by
// notifications in Phase 6).
export async function renderEmailTemplate(key: string, data: TemplateData, language: "ar" | "en") {
  const { data: t } = await db().from("document_templates").select("id, is_active, doc_type").eq("key", `${key}_${language}`).maybeSingle();
  if (!t || !t.is_active || t.doc_type !== "email") return null;
  const { current } = await getTemplate(t.id);
  if (!current) return null;
  const out = await renderWithVersion(current, language, { ...data, company: data.company ?? (await companyData()) }, current.subject ?? "");
  return { subject: out.subject ?? "", html: out.html, text: out.markup.replace(/\\(.)/g, "$1").replace(/\*\*/g, "") };
}
