import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import { can, type BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { nowIso } from "@/lib/bos/clock";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";
import { autoMap, parseImportFile } from "@/lib/bos/import/parse";
import { normalise } from "@/lib/bos/import/fields";
import { importTypeMap, type ImportType, type Refs, type Values } from "@/services/bos/import-types";

// Data import engine (docs/bos/30 §27, doc 31 Phase 18):
//   choose type → upload (private bucket) → read columns → preview → map →
//   validate (errors, in-file and existing duplicates) → confirm (expected
//   count) → execute through module services → summary → error report →
//   rollback. Nothing is overwritten unless "update matches" is chosen, and
//   then only mapped, non-empty, safe fields; previous values are kept.

export type ImportJob = Tables<"import_jobs">;
const MAX_BYTES = 10 * 1024 * 1024;
const ROLLBACK_DAYS = 7;

function need(bos: BosUser, type?: ImportType) {
  if (!can(bos, "imports.create")) throw new ForbiddenError();
  if (type && !can(bos, type.perm)) throw new ForbiddenError(`ليس لديك صلاحية إنشاء ${type.label}.`);
}

async function loadJob(bos: BosUser, id: string) {
  const { data } = await db().from("import_jobs").select("*").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  if (data.created_by !== bos.userId && !can(bos, "imports.manage")) throw new ForbiddenError();
  return data;
}

export async function startImport(bos: BosUser, input: { dataType: string; fileName: string; size: number }) {
  const type = importTypeMap.get(input.dataType);
  if (!type) throw new ValidationError("نوع بيانات غير معروف.");
  need(bos, type);
  const ext = input.fileName.split(".").pop()?.toLowerCase();
  const format = ext === "csv" ? "csv" : ext === "xlsx" ? "xlsx" : ext === "json" ? "json" : null;
  if (!format) throw new ValidationError("الصيغ المدعومة: CSV وXLSX وJSON.");
  if (!(input.size > 0) || input.size > MAX_BYTES) throw new ValidationError("الحد الأقصى لحجم الملف 10MB.");
  const { data: job, error } = await db().from("import_jobs").insert({ data_type: type.key, source_format: format, file_name: input.fileName.slice(0, 240), file_size: input.size, created_by: bos.userId }).select("*").single();
  if (error) throw error;
  const path = `imports/${job.id}/source.${format}`;
  const { data: signed, error: e2 } = await db().storage.from("bos-files").createSignedUploadUrl(path);
  if (e2 || !signed) throw e2 ?? new Error("upload url");
  await db().from("import_jobs").update({ storage_path: path }).eq("id", job.id);
  return { jobId: job.id, path, token: signed.token };
}

// Reads the uploaded file (never executes content), stores rows and a suggested mapping.
export async function analyzeImport(bos: BosUser, jobId: string, bytesOverride?: Uint8Array) {
  const job = await loadJob(bos, jobId);
  const type = importTypeMap.get(job.data_type)!;
  let bytes = bytesOverride;
  if (!bytes) {
    const { data: blob } = await db().storage.from("bos-files").download(job.storage_path!);
    if (!blob) throw new ValidationError("لم يكتمل رفع الملف.");
    bytes = new Uint8Array(await blob.arrayBuffer());
  }
  if (bytes.length > MAX_BYTES) throw new ValidationError("الملف كبير جداً.");
  let parsed;
  try {
    parsed = await parseImportFile(job.source_format as "csv", bytes);
  } catch (e) {
    await db().from("import_jobs").update({ status: "failed", error: e instanceof Error ? e.message : "parse error" }).eq("id", jobId);
    throw new ValidationError(e instanceof Error ? e.message : "تعذر قراءة الملف.");
  }
  if (!parsed.headers.length || !parsed.rows.length) throw new ValidationError("الملف لا يحتوي على صفوف بيانات.");
  await db().from("import_rows").delete().eq("job_id", jobId);
  const rows = parsed.rows.map((r, i) => ({ job_id: jobId, row_no: i + 2, raw: Object.fromEntries(parsed.headers.map((h, j) => [h, r[j] ?? ""])) }));
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await db().from("import_rows").insert(rows.slice(i, i + 1000) as never);
    if (error) throw error;
  }
  const mapping = autoMap(parsed.headers, type.fields);
  await db().from("import_jobs").update({ headers: parsed.headers, total_rows: rows.length, mapping, match_key: type.matchKeys[0] ?? null, status: "uploaded" }).eq("id", jobId);
  return { headers: parsed.headers, total: rows.length, preview: parsed.rows.slice(0, 10), mapping };
}

function refResolvers(): Refs {
  const cache = new Map<string, string | null>();
  const memo = async (k: string, fn: () => Promise<string | null>) => {
    if (!cache.has(k)) cache.set(k, await fn());
    return cache.get(k)!;
  };
  return {
    user: (email) => memo(`u:${email.toLowerCase()}`, async () => (await db().from("employees").select("user_id").ilike("email", email.trim()).not("user_id", "is", null).is("archived_at", null).maybeSingle()).data?.user_id ?? null),
    client: (s) => memo(`c:${s.toLowerCase()}`, async () => {
      const v = s.trim();
      const byEmail = v.includes("@") ? (await db().from("clients").select("id").ilike("email", v).is("archived_at", null).limit(1).maybeSingle()).data : null;
      if (byEmail) return byEmail.id;
      const { data } = await db().from("clients").select("id").or(`company_name.ilike.${v.replace(/[,()]/g, " ")},name.ilike.${v.replace(/[,()]/g, " ")}`).is("archived_at", null).limit(2);
      return data?.length === 1 ? data[0].id : null; // ambiguous names are not guessed
    }),
    byName: (table, name) => memo(`${table}:${name.toLowerCase()}`, async () => {
      const { data } = await db().from(table as "vendors").select("id").ilike("name", name.trim()).limit(2);
      return data?.length === 1 ? data[0].id : null;
    }),
  };
}

export async function validateImport(bos: BosUser, jobId: string, input: { mapping: Record<string, string>; matchKey: string | null; mode: "create_only" | "update_matches"; expectedCount: number | null }) {
  const job = await loadJob(bos, jobId);
  const type = importTypeMap.get(job.data_type)!;
  need(bos, type);
  if (["running", "completed", "rolled_back"].includes(job.status)) throw new ValidationError("لا يمكن تعديل عملية استيراد منفّذة.");
  const mapping = Object.fromEntries(Object.entries(input.mapping).filter(([k, h]) => h && type.fields.some((f) => f.key === k) && job.headers.includes(h)));
  for (const f of type.fields) if (f.required && !mapping[f.key]) throw new ValidationError(`اربط الحقل المطلوب: ${f.label}`);
  const matchKey = input.matchKey && type.matchKeys.includes(input.matchKey) ? input.matchKey : null;
  if (input.mode === "update_matches" && !matchKey) throw new ValidationError("اختر حقل المطابقة لتحديث السجلات الموجودة.");
  const refs = refResolvers();
  const { data: rows } = await db().from("import_rows").select("id, row_no, raw").eq("job_id", jobId).order("row_no").limit(20000);
  const seen = new Map<string, number>();
  let valid = 0, errors = 0, dups = 0;
  const updates: { id: number; values: Values; status: string; errors: string[]; match_id: string | null }[] = [];
  for (const r of rows ?? []) {
    const raw = r.raw as Record<string, string>;
    const v: Values = {};
    const errs: string[] = [];
    for (const f of type.fields) {
      if (!mapping[f.key]) continue;
      const n = normalise(f, raw[mapping[f.key]]);
      if (n.ok) v[f.key] = n.value;
      else errs.push(n.error);
    }
    if (!errs.length && type.resolve) errs.push(...(await type.resolve(v, refs)));
    let status = errs.length ? "error" : "valid";
    let matchId: string | null = null;
    if (!errs.length && matchKey && v[matchKey] != null) {
      const k = String(v[matchKey]).toLowerCase();
      if (seen.has(k)) { status = "error"; errs.push(`مكرر داخل الملف مع السطر ${seen.get(k)}`); }
      else {
        seen.set(k, r.row_no);
        matchId = await type.find(v, matchKey);
        if (matchId) status = "duplicate";
      }
    }
    if (status === "valid") valid++;
    else if (status === "duplicate") dups++;
    else errors++;
    updates.push({ id: r.id, values: v, status, errors: errs, match_id: matchId });
  }
  for (const u of updates) await db().from("import_rows").update({ values: u.values as never, status: u.status, errors: u.errors, match_id: u.match_id }).eq("id", u.id);
  await db().from("import_jobs").update({ mapping, match_key: matchKey, mode: input.mode, expected_count: input.expectedCount, valid_rows: valid, error_rows: errors, duplicate_rows: dups, status: "validated", validated_at: nowIso() }).eq("id", jobId);
  return { valid, errors, duplicates: dups, total: (rows ?? []).length };
}

export async function executeImport(bos: BosUser, jobId: string, confirm: { acknowledgeCountMismatch: boolean }) {
  const job = await loadJob(bos, jobId);
  const type = importTypeMap.get(job.data_type)!;
  need(bos, type);
  if (job.status !== "validated") throw new ValidationError("تحقق من البيانات أولاً.");
  const willWrite = job.valid_rows + (job.mode === "update_matches" ? job.duplicate_rows : 0);
  if (job.expected_count != null && job.expected_count !== willWrite && !confirm.acknowledgeCountMismatch) throw new ValidationError(`العدد المتوقع ${job.expected_count} لا يطابق ${willWrite} سجلاً سيُكتب — راجع أو أكّد المتابعة.`);
  const { data: claimed } = await db().from("import_jobs").update({ status: "running" }).eq("id", jobId).eq("status", "validated").select("id").maybeSingle();
  if (!claimed) throw new ValidationError("العملية قيد التنفيذ بالفعل.");
  const c = db();
  let created = 0, updated = 0, skipped = 0, failed = 0;
  const { data: rows } = await c.from("import_rows").select("id, status, values, match_id").eq("job_id", jobId).in("status", ["valid", "duplicate", "error"]).order("row_no").limit(20000);
  for (const r of rows ?? []) {
    if (r.status === "error") { skipped++; continue; }
    const v = (r.values ?? {}) as Values;
    try {
      if (r.status === "valid") {
        const id = await type.create(bos, v);
        await c.from("import_rows").update({ status: "created", target_id: id }).eq("id", r.id);
        created++;
      } else if (job.mode === "update_matches" && r.match_id && type.updatable.length) {
        // Only mapped, non-empty, safe columns; previous values kept for rollback.
        const patch = Object.fromEntries(Object.entries(type.toRow(v)).filter(([k, val]) => type.updatable.includes(k) && val != null && val !== ""));
        if (!Object.keys(patch).length) { await c.from("import_rows").update({ status: "skipped" }).eq("id", r.id); skipped++; continue; }
        const { data: before } = await c.from(type.table as "clients").select(Object.keys(patch).join(",")).eq("id", r.match_id).single();
        const { error } = await c.from(type.table as "clients").update(patch as never).eq("id", r.match_id);
        if (error) throw error;
        await c.from("import_rows").update({ status: "updated", target_id: r.match_id, before: before as never }).eq("id", r.id);
        updated++;
      } else {
        await c.from("import_rows").update({ status: "skipped" }).eq("id", r.id);
        skipped++;
      }
    } catch (e) {
      await c.from("import_rows").update({ status: "failed", errors: [e instanceof Error ? e.message.slice(0, 300) : "error"] }).eq("id", r.id);
      failed++;
    }
  }
  await c.from("import_jobs").update({ status: "completed", created_count: created, updated_count: updated, skipped_count: skipped, failed_count: failed, executed_at: nowIso() }).eq("id", jobId);
  await audit({ actorId: bos.userId, action: "import.executed", entityType: "import_job", entityId: jobId, newValue: { type: type.key, file: job.file_name, created, updated, skipped, failed, mode: job.mode } });
  return { created, updated, skipped, failed };
}

// Rollback within 7 days: created records are removed (or archived when
// other records already reference them); updated records get their previous values back.
export async function rollbackImport(bos: BosUser, jobId: string) {
  const job = await loadJob(bos, jobId);
  const type = importTypeMap.get(job.data_type)!;
  if (job.status !== "completed") throw new ValidationError("يمكن التراجع عن عمليات الاستيراد المكتملة فقط.");
  if (job.executed_at && Date.now() - new Date(job.executed_at).getTime() > ROLLBACK_DAYS * 86400_000) throw new ValidationError(`انتهت مهلة التراجع (${ROLLBACK_DAYS} أيام).`);
  const c = db();
  const { data: rows } = await c.from("import_rows").select("id, status, target_id, before").eq("job_id", jobId).in("status", ["created", "updated"]).order("row_no", { ascending: false });
  let removed = 0, archived = 0, restored = 0, kept = 0;
  for (const r of rows ?? []) {
    if (!r.target_id) continue;
    if (r.status === "updated" && r.before) {
      await c.from(type.table as "clients").update(r.before as never).eq("id", r.target_id);
      restored++;
    } else if (r.status === "created") {
      const del = await c.from(type.table as "clients").delete().eq("id", r.target_id);
      if (!del.error) removed++;
      else {
        const arch = await c.from(type.table as "clients").update({ archived_at: nowIso() } as never).eq("id", r.target_id);
        if (!arch.error) archived++;
        else { kept++; continue; }
      }
    }
    await c.from("import_rows").update({ status: "rolled_back" }).eq("id", r.id);
  }
  await c.from("import_jobs").update({ status: "rolled_back", rolled_back_at: nowIso(), rolled_back_by: bos.userId }).eq("id", jobId);
  await audit({ actorId: bos.userId, action: "import.rolled_back", entityType: "import_job", entityId: jobId, newValue: { removed, archived, restored, kept } });
  return { removed, archived, restored, kept };
}

export async function errorReportCsv(bos: BosUser, jobId: string) {
  await loadJob(bos, jobId);
  const { data } = await db().from("import_rows").select("row_no, status, errors, raw").eq("job_id", jobId).in("status", ["error", "failed", "duplicate"]).order("row_no");
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"` : s;
  };
  const headers = [...new Set((data ?? []).flatMap((r) => Object.keys(r.raw as object)))];
  return [["row", "status", "errors", ...headers].map(esc).join(","), ...(data ?? []).map((r) => [r.row_no, r.status, (r.errors ?? []).join(" | "), ...headers.map((h) => (r.raw as Record<string, string>)[h])].map(esc).join(","))].join("\n");
}

export async function listImports(bos: BosUser) {
  if (!can(bos, "imports.read") && !can(bos, "imports.create")) throw new ForbiddenError();
  let q = db().from("import_jobs").select("*").order("created_at", { ascending: false }).limit(100);
  if (!can(bos, "imports.manage")) q = q.eq("created_by", bos.userId);
  const { data } = await q;
  return data ?? [];
}

export async function getImport(bos: BosUser, jobId: string) {
  const job = await loadJob(bos, jobId);
  const [{ data: sample }, { data: problems }] = await Promise.all([
    db().from("import_rows").select("row_no, raw").eq("job_id", jobId).order("row_no").limit(10),
    db().from("import_rows").select("row_no, status, errors, values, match_id").eq("job_id", jobId).in("status", ["error", "duplicate", "failed"]).order("row_no").limit(100),
  ]);
  return { job, type: importTypeMap.get(job.data_type)!, sample: sample ?? [], problems: problems ?? [] };
}
