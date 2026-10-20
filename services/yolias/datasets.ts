import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { ydb, yintel } from "@/lib/yolias/db";
import { aiGenerate, parseAiJson } from "@/services/bos/ai";
import { DATASET_FIELDS, guessDatasetMapping, guessEntity, normalizeCountry, normalizeRow, usable, type DatasetEntity, type DatasetMapping } from "../../Yolias/lib/datasets/normalize";
import type { IntelDatasetRow, Json } from "../../Yolias/types/database";

// Data import (owner brief 2026-10-20, D-248). Every dataset Yolias buys or
// collects is uploaded here with its source and licence. The browser reads the
// file and sends it in batches; each batch is normalised here, staged, and
// merged into the shared database (intel.dataset_merge). Mapping is suggested
// by AI from the headers and a few sample rows, then reviewed by the admin.

export const SOURCE_KINDS: { value: IntelDatasetRow["source_kind"]; label: string }[] = [
  { value: "purchased", label: "بيانات مشتراة" },
  { value: "open_data", label: "بيانات مفتوحة" },
  { value: "registry", label: "سجل حكومي" },
  { value: "crawl", label: "زحف المواقع" },
  { value: "partner", label: "شريك" },
  { value: "other", label: "أخرى" },
];

export const MAX_BATCH_ROWS = 500;

export async function listDatasets(): Promise<(IntelDatasetRow & { report: Report })[]> {
  const { data, error } = await yintel().from("datasets").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return Promise.all((data ?? []).map(async (d) => ({ ...d, report: await datasetReport(d.id) })));
}

export interface Report {
  rows: number;
  by_status: Partial<Record<"staged" | "invalid" | "new" | "merged" | "duplicate", number>>;
  problems: Record<string, number>;
  filled: Record<string, number>;
  companies_new: number;
  companies_matched: number;
  people_new: number;
  people_matched: number;
  enriched: number;
  possible_duplicates: number;
}

export async function datasetReport(id: string): Promise<Report> {
  const { data, error } = await yintel().rpc("dataset_report", { p_dataset: id });
  if (error) throw error;
  return data as unknown as Report;
}

export async function getDataset(id: string) {
  const { data, error } = await yintel().from("datasets").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError();
  const [report, { data: invalid }, { data: dupes }] = await Promise.all([
    datasetReport(id),
    yintel().from("dataset_rows").select("row_no, raw, problems").eq("dataset_id", id).eq("status", "invalid").order("row_no").limit(50),
    yintel().from("dataset_rows").select("row_no, raw, status, company_id").eq("dataset_id", id).in("status", ["merged", "duplicate"]).order("row_no").limit(30),
  ]);
  return { dataset: data, report, invalid: invalid ?? [], matched: dupes ?? [] };
}

/** Whether the datasets migration (20261120000000) is in the Yolias database. */
export async function datasetsReady(): Promise<boolean> {
  const { error } = await yintel().from("datasets").select("id", { head: true, count: "exact" }).limit(1);
  return !error;
}

// ───────────────────────── Mapping ─────────────────────────

const fieldList = DATASET_FIELDS.map((f) => `${f.key}: ${f.label} (${f.entity === "both" ? "company or person" : f.entity})`).join("\n");

function cleanMapping(raw: unknown, columns: number): DatasetMapping {
  const out: DatasetMapping = {};
  const used = new Set<number>();
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const i = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN;
    if (!DATASET_FIELDS.some((f) => f.key === k) || !Number.isInteger(i) || i < 0 || i >= columns || used.has(i)) continue;
    out[k] = i;
    used.add(i);
  }
  return out;
}

/**
 * Column mapping for a file: AI reads the headers and sample values (it never
 * sees more than 8 rows); without AI, or when it fails, header names decide.
 */
export async function suggestMapping(bos: BosUser, headers: string[], sample: string[][]): Promise<{ mapping: DatasetMapping; entity: DatasetEntity; source: "ai" | "rules"; note: string | null }> {
  const rules = guessDatasetMapping(headers);
  const columns = headers.map((h, i) => `${i}. ${h || `(column ${i + 1})`}: ${sample.slice(0, 8).map((r) => JSON.stringify((r[i] ?? "").slice(0, 60))).join(", ")}`).join("\n");
  const res = await aiGenerate({
    feature: "datasets.mapping",
    userId: bos.userId,
    json: true,
    maxTokens: 800,
    temperature: 0,
    system: "You map the columns of a B2B data file (companies or people, possibly in Arabic, French or English) to a fixed list of fields. Use the header and the sample values. Map a column only when you are confident; leave fields out otherwise. Never map one column to two fields.",
    prompt: `Fields (key: meaning):\n${fieldList}\n\nColumns (index. header: sample values):\n${columns}\n\nAnswer as JSON: {"entity": "company" | "person", "mapping": {"<field key>": <column index>}, "note": "<one short sentence in Arabic about anything unclear, or empty>"}. "person" when rows are people (a person's name or job title per row).`,
  }).catch(() => null);
  if (res?.ok) {
    const j = parseAiJson<{ entity?: string; mapping?: unknown; note?: string }>(res.text);
    const mapping = cleanMapping(j?.mapping, headers.length);
    if (Object.keys(mapping).length) {
      return { mapping, entity: j?.entity === "person" ? "person" : j?.entity === "company" ? "company" : guessEntity(mapping), source: "ai", note: j?.note?.trim() ? j.note.trim().slice(0, 300) : null };
    }
  }
  return { mapping: rules, entity: guessEntity(rules), source: "rules", note: res && !res.ok ? "تعذر الوصول للذكاء الاصطناعي، فالربط مبني على أسماء الأعمدة. راجعه قبل المتابعة." : null };
}

// ───────────────────────── Create / stage / merge ─────────────────────────

export interface DatasetInput {
  name: string;
  sourceKind: IntelDatasetRow["source_kind"];
  vendor: string | null;
  sourceUrl: string | null;
  licenseName: string | null;
  customerFacing: boolean;
  redistributable: boolean;
  attribution: string | null;
  retentionDays: number | null;
  purchasedAt: string | null;
  costUsd: number | null;
  countries: string[];
  defaultCountry: string | null;
  notes: string | null;
  enrich: boolean;
}

function validInput(i: DatasetInput) {
  const bad = (msg: string, field: string) => new ValidationError(msg, { [field]: msg });
  if (i.name.trim().length < 2 || i.name.length > 200) throw bad("اكتب اسمًا للبيانات.", "name");
  if (!SOURCE_KINDS.some((k) => k.value === i.sourceKind)) throw bad("اختر نوع المصدر.", "source_kind");
  if (i.sourceUrl && !/^https?:\/\/\S+$/.test(i.sourceUrl)) throw bad("رابط غير صالح.", "source_url");
  if (i.retentionDays != null && (!Number.isInteger(i.retentionDays) || i.retentionDays < 1 || i.retentionDays > 36500)) throw bad("مدة الاحتفاظ غير صالحة.", "retention_days");
  if (i.costUsd != null && (!Number.isFinite(i.costUsd) || i.costUsd < 0)) throw bad("تكلفة غير صالحة.", "cost_usd");
  if (i.purchasedAt && !/^\d{4}-\d{2}-\d{2}$/.test(i.purchasedAt)) throw bad("تاريخ غير صالح.", "purchased_at");
  if (i.redistributable && !i.customerFacing) throw bad("إعادة الاستخدام لكل العملاء تتطلب أن يكون العرض للعملاء مسموحًا.", "redistributable");
  const countries = [...new Set(i.countries.map((c) => normalizeCountry(c)).filter(Boolean) as string[])];
  const defaultCountry = i.defaultCountry ? normalizeCountry(i.defaultCountry) : null;
  if (i.defaultCountry && !defaultCountry) throw bad("دولة غير معروفة.", "default_country");
  return { countries, defaultCountry };
}

export async function createDataset(bos: BosUser, i: DatasetInput, file: { name: string; rows: number; headers: string[]; sample: string[][]; mapping: DatasetMapping; mappingSource: "ai" | "rules" | "manual"; entity: DatasetEntity }): Promise<string> {
  const { countries, defaultCountry } = validInput(i);
  if (!file.headers.length || file.headers.length > 300) throw new ValidationError("الملف بدون أعمدة.");
  if (!Number.isInteger(file.rows) || file.rows < 1 || file.rows > 5_000_000) throw new ValidationError("عدد الصفوف غير صالح.");
  const mapping = cleanMapping(file.mapping, file.headers.length);
  const needs = file.entity === "person" ? ["full_name", "first_name"] : ["company_name", "website", "email"];
  if (!needs.some((k) => mapping[k] !== undefined)) throw new ValidationError(file.entity === "person" ? "اربط عمود اسم الشخص." : "اربط عمود اسم الشركة أو الموقع.");
  if (file.entity === "person" && mapping.company_name === undefined && mapping.website === undefined && mapping.email === undefined) throw new ValidationError("بيانات الأشخاص تحتاج عمود الشركة أو الموقع أو البريد لربط كل شخص بشركته.");
  const row = {
    name: i.name.trim(), source_kind: i.sourceKind, vendor: i.vendor?.trim() || null, source_url: i.sourceUrl?.trim() || null,
    license_name: i.licenseName?.trim() || null, license_scope: i.redistributable ? ("yolias_shared" as const) : ("internal" as const),
    customer_facing: i.customerFacing, redistributable: i.redistributable, attribution: i.attribution?.trim() || null, retention_days: i.retentionDays,
    purchased_at: i.purchasedAt, cost_usd: i.costUsd, countries, default_country: defaultCountry, notes: i.notes?.trim() || null,
    entity: file.entity, status: "importing" as const, file_name: file.name.slice(0, 300), file_rows: file.rows,
    headers: file.headers.map((h) => String(h).slice(0, 200)), sample: file.sample.slice(0, 10) as unknown as Json, mapping: mapping as unknown as Json,
    mapping_source: file.mappingSource, enrich: i.enrich, created_by: bos.email,
  };
  const { data, error } = await yintel().from("datasets").insert(row).select("id").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.datasets.create", entityType: "yolias_dataset", entityId: null, newValue: { ...row, sample: undefined }, metadata: { dataset: data.id } });
  return data.id;
}

/**
 * One batch of rows (in file order from `start`): normalised, staged (rows
 * already staged are skipped, so a batch can be sent again), then merged.
 */
export async function stageBatch(id: string, start: number, rows: string[][]): Promise<{ staged: number; invalid: number; merged: number; remaining: number }> {
  if (!Number.isInteger(start) || start < 1) throw new ValidationError("بداية غير صالحة.");
  if (!Array.isArray(rows) || rows.length > MAX_BATCH_ROWS) throw new ValidationError("دفعة كبيرة جدًا.");
  const { data: d } = await yintel().from("datasets").select("id, status, mapping, entity, default_country").eq("id", id).maybeSingle();
  if (!d) throw new NotFoundError();
  if (d.status === "deleted") throw new ValidationError("هذه البيانات محذوفة.");
  const mapping = d.mapping as unknown as DatasetMapping;
  let invalid = 0;
  const staged = rows.map((cells, n) => {
    const cellsOk = (Array.isArray(cells) ? cells : []).slice(0, 300).map((c) => String(c ?? "").slice(0, 4000));
    const norm = normalizeRow(cellsOk, mapping, d.entity, { country: d.default_country });
    const ok = usable(norm);
    if (!ok) invalid++;
    return { dataset_id: id, row_no: start + n, raw: cellsOk as unknown as Json, data: norm as unknown as Json, status: ok ? ("staged" as const) : ("invalid" as const), problems: ok ? norm.problems : [...new Set([...norm.problems, d.entity === "person" && norm.person?.full_name ? "missing_company" : "missing_name"])] };
  });
  if (staged.length) {
    const { error } = await yintel().from("dataset_rows").upsert(staged, { onConflict: "dataset_id,row_no", ignoreDuplicates: true });
    if (error) throw error;
  }
  if (d.status === "ready") await yintel().from("datasets").update({ status: "importing", updated_at: new Date().toISOString() }).eq("id", id);
  const merged = await mergeSome(id);
  return { staged: staged.length - invalid, invalid, ...merged };
}

/** Merges staged rows for up to ~6 seconds (one server call). */
export async function mergeSome(id: string): Promise<{ merged: number; remaining: number }> {
  const started = Date.now();
  let merged = 0;
  let remaining = 0;
  do {
    const { data, error } = await yintel().rpc("dataset_merge", { p_dataset: id, p_limit: 250 });
    if (error) throw error;
    const r = data as unknown as { processed: number; remaining: number };
    merged += r.processed;
    remaining = r.remaining;
    if (!r.processed) break;
  } while (remaining > 0 && Date.now() - started < 6000);
  return { merged, remaining };
}

/** After the last batch: merge what's left and start the enrichment when asked. */
export async function finishImport(bos: BosUser, id: string): Promise<{ remaining: number }> {
  const r = await mergeSome(id);
  const { data: d } = await yintel().from("datasets").select("enrich, status").eq("id", id).single();
  if (r.remaining === 0 && d?.status !== "ready") await yintel().from("datasets").update({ status: "ready", imported_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  if (d?.enrich && r.remaining === 0) await startEnrichment(bos, id);
  return { remaining: r.remaining };
}

export async function startEnrichment(bos: BosUser, id: string): Promise<void> {
  await yintel().from("datasets").update({ enrich: true, updated_at: new Date().toISOString() }).eq("id", id);
  const { error } = await ydb().rpc("jobs_enqueue", { p_kind: "dataset.enrich", p_payload: { datasetId: id }, p_delay: 0 });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.datasets.enrich", entityType: "yolias_dataset", entityId: null, metadata: { dataset: id } });
}

export async function updateLicense(bos: BosUser, id: string, i: Pick<DatasetInput, "name" | "licenseName" | "customerFacing" | "redistributable" | "attribution" | "retentionDays" | "notes" | "vendor" | "sourceUrl">): Promise<void> {
  const { data: before } = await yintel().from("datasets").select("*").eq("id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  validInput({ ...i, sourceKind: before.source_kind, purchasedAt: null, costUsd: null, countries: [], defaultCountry: null, enrich: false });
  const patch = {
    name: i.name.trim(), license_name: i.licenseName?.trim() || null, customer_facing: i.customerFacing, redistributable: i.redistributable,
    license_scope: i.redistributable ? ("yolias_shared" as const) : ("internal" as const), attribution: i.attribution?.trim() || null,
    retention_days: i.retentionDays, notes: i.notes?.trim() || null, vendor: i.vendor?.trim() || null, source_url: i.sourceUrl?.trim() || null, updated_at: new Date().toISOString(),
  };
  const { error } = await yintel().from("datasets").update(patch).eq("id", id);
  if (error) throw error;
  // The licence travels with the values already stored.
  await yintel().from("field_values").update({ license_scope: patch.license_scope }).eq("source", `dataset:${id}`);
  await audit({ actorId: bos.userId, action: "yolias.datasets.license", entityType: "yolias_dataset", entityId: null, oldValue: { customer_facing: before.customer_facing, redistributable: before.redistributable, license_name: before.license_name }, newValue: patch, metadata: { dataset: id } });
}

export async function deleteDataset(bos: BosUser, id: string, confirmName: string): Promise<{ companies: number; people: number; values: number }> {
  const { data: d } = await yintel().from("datasets").select("name, status").eq("id", id).maybeSingle();
  if (!d) throw new NotFoundError();
  if (confirmName.trim() !== d.name) throw new ValidationError("اكتب اسم البيانات كما هو للتأكيد.", { confirm: "الاسم غير مطابق" });
  const { data, error } = await yintel().rpc("dataset_delete", { p_dataset: id, p_actor: bos.email });
  if (error) throw error;
  const r = data as unknown as { companies: number; people: number; values: number };
  await audit({ actorId: bos.userId, action: "yolias.datasets.delete", entityType: "yolias_dataset", entityId: null, oldValue: { name: d.name }, newValue: r, metadata: { dataset: id } });
  return r;
}
