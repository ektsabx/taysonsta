"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckboxField, FormSection, SelectField, TextAreaField, TextField } from "@/components/bos/Form";
import { ProgressBar, StatusBadge } from "@/components/bos/ui";
import { Tx, useT } from "@/components/bos/I18n";
import { parseCsv } from "@/lib/bos/import/csv";
import { parseXlsx } from "@/lib/bos/import/parse";
import { DATASET_FIELDS, normalizeRow, problemLabels, usable, type DatasetEntity, type DatasetMapping } from "../../../../../Yolias/lib/datasets/normalize";
import { createDatasetAction, finishImportAction, stageBatchAction, suggestMappingAction } from "../actions";
import type { DatasetInput } from "@/services/yolias/datasets";

// Data import wizard (D-248): 1) the source, licence and file, 2) the column
// mapping suggested by AI with a live preview of the normalised rows, 3) the
// upload in batches (the file never leaves this browser in one piece), then
// the report page. A batch that fails is retried; the import can resume.

const MAX_FILE_BYTES = 150 * 1024 * 1024;
const MAX_ROWS = 1_000_000;
const BATCH_ROWS = 500;
const BATCH_BYTES = 700_000;

type Kind = DatasetInput["sourceKind"];
interface Parsed { name: string; headers: string[]; rows: string[][] }

function decode(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  // Arabic files exported from old Excel versions are often Windows-1256.
  const bad = (utf8.slice(0, 200_000).match(/�/g) ?? []).length;
  if (bad > 20) {
    try { return new TextDecoder("windows-1256").decode(bytes); } catch { return utf8; }
  }
  return utf8;
}

async function readFile(file: File): Promise<Parsed> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const lower = file.name.toLowerCase();
  let table: string[][];
  if (lower.endsWith(".xlsx")) {
    const p = await parseXlsx(bytes, MAX_ROWS);
    table = [p.headers, ...p.rows];
  } else if (lower.endsWith(".json")) {
    const data = JSON.parse(decode(bytes)) as unknown;
    const arr = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const headers = [...new Set(arr.flatMap((o) => (o && typeof o === "object" ? Object.keys(o) : [])))].slice(0, 300);
    table = [headers, ...arr.map((o) => headers.map((h) => (o?.[h] == null ? "" : String(o[h]))))];
  } else {
    const text = decode(bytes).replace(/^\uFEFF/, "");
    // Semicolon and tab separated files are common in French and Excel exports.
    const first = text.slice(0, text.indexOf("\n") > 0 ? text.indexOf("\n") : 2000);
    const counts = [",", ";", "\t"].map((d) => [d, first.split(d).length] as const).sort((x, y) => y[1] - x[1]);
    table = parseCsv(text, lower.endsWith(".tsv") ? "\t" : counts[0][1] > 1 ? counts[0][0] : ",");
  }
  const headers = (table[0] ?? []).map((h, i) => String(h ?? "").trim() || `Column ${i + 1}`);
  const rows = table.slice(1, MAX_ROWS + 1).filter((r) => r.some((c) => String(c ?? "").trim())).map((r) => headers.map((_, i) => String(r[i] ?? "").trim()));
  return { name: file.name, headers, rows };
}

/** Rows cut so each batch stays under the server's request size. */
function batches(rows: string[][], from: number): { start: number; end: number } {
  let size = 2;
  let end = from;
  while (end < rows.length && end - from < BATCH_ROWS) {
    size += JSON.stringify(rows[end]).length + 1;
    if (size > BATCH_BYTES && end > from) break;
    end++;
  }
  return { start: from, end };
}

export function ImportWizard() {
  const t = useT();
  const router = useRouter();
  const [step, setStep] = useState<"details" | "mapping" | "importing">("details");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState<DatasetInput | null>(null);
  const [file, setFile] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<DatasetMapping>({});
  const [entity, setEntity] = useState<DatasetEntity>("company");
  const [mappingSource, setMappingSource] = useState<"ai" | "rules" | "manual">("rules");
  const [note, setNote] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, staged: 0, invalid: 0, merged: 0 });
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const resumeAt = useRef(0);
  const [kind, setKind] = useState<Kind>("purchased");

  const byColumn = useMemo(() => {
    const out: Record<number, string> = {};
    for (const [k, i] of Object.entries(mapping)) out[i] = k;
    return out;
  }, [mapping]);

  const preview = useMemo(() => (file ? file.rows.slice(0, 6).map((r) => normalizeRow(r, mapping, entity, { country: details?.defaultCountry ?? null })) : []), [file, mapping, entity, details]);

  async function onDetails(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const f = fd.get("file");
    if (!(f instanceof File) || !f.size) return setError(t("اختر ملف البيانات."));
    if (f.size > MAX_FILE_BYTES) return setError(t("الملف أكبر من 150 ميجابايت. قسّمه إلى ملفات أصغر."));
    if (!/\.(csv|tsv|txt|xlsx|json)$/i.test(f.name)) return setError(t("الصيغ المدعومة: CSV وXLSX وJSON."));
    const str = (k: string) => String(fd.get(k) ?? "").trim();
    const num = (k: string) => (str(k) === "" ? null : Number(str(k)));
    const input: DatasetInput = {
      name: str("name"), sourceKind: str("source_kind") as Kind, vendor: str("vendor") || null, sourceUrl: str("source_url") || null,
      licenseName: str("license_name") || null, customerFacing: fd.get("customer_facing") === "on", redistributable: fd.get("redistributable") === "on",
      attribution: str("attribution") || null, retentionDays: num("retention_days"), purchasedAt: str("purchased_at") || null, costUsd: num("cost_usd"),
      countries: str("countries").split(/[,،\s]+/).filter(Boolean), defaultCountry: str("default_country") || null, notes: str("notes") || null, enrich: fd.get("enrich") === "on",
    };
    if (input.name.length < 2) return setError(t("اكتب اسمًا للبيانات."));
    setBusy(true);
    try {
      const parsed = await readFile(f);
      if (!parsed.headers.length || !parsed.rows.length) throw new Error(t("الملف فارغ أو بدون صف عناوين."));
      setDetails(input);
      setFile(parsed);
      const r = await suggestMappingAction(parsed.headers, parsed.rows.slice(0, 8));
      if (r.ok && r.data) {
        setMapping(r.data.mapping);
        setEntity(r.data.entity);
        setMappingSource(r.data.source);
        setNote(r.data.note);
      } else if (!r.ok) setError(r.error);
      setStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("تعذرت قراءة الملف."));
    } finally {
      setBusy(false);
    }
  }

  function setColumn(col: number, key: string) {
    setMappingSource("manual");
    setMapping((m) => {
      const next: DatasetMapping = {};
      for (const [k, i] of Object.entries(m)) if (i !== col && k !== key) next[k] = i;
      if (key) next[key] = col;
      return next;
    });
  }

  async function upload(id: string) {
    if (!file) return;
    setBusy(true);
    setError(null);
    let at = resumeAt.current;
    try {
      while (at < file.rows.length) {
        const { start, end } = batches(file.rows, at);
        let r = await stageBatchAction(id, start + 1, file.rows.slice(start, end));
        for (let attempt = 1; !r.ok && attempt < 3; attempt++) r = await stageBatchAction(id, start + 1, file.rows.slice(start, end));
        if (!r.ok) throw new Error(r.error);
        at = end;
        resumeAt.current = at;
        const d = r.data!;
        setProgress((p) => ({ done: at, staged: p.staged + d.staged, invalid: p.invalid + d.invalid, merged: p.merged + d.merged }));
      }
      for (let i = 0; i < 200; i++) {
        const f = await finishImportAction(id);
        if (!f.ok) throw new Error(f.error);
        if (!f.data || f.data.remaining === 0) break;
      }
      router.push(`/admin/platform/datasets/${id}`);
    } catch (err) {
      setError(`${err instanceof Error ? err.message : t("تعذر الإرسال.")} ${t("اضغط «متابعة الاستيراد» لإكمال ما تبقى.")}`);
      setBusy(false);
    }
  }

  async function onStart() {
    if (!details || !file) return;
    setBusy(true);
    setError(null);
    const r = await createDatasetAction(details, { name: file.name, rows: file.rows.length, headers: file.headers, sample: file.rows.slice(0, 10), mapping, mappingSource, entity });
    if (!r.ok || !r.data) {
      setBusy(false);
      return setError(r.ok ? t("تعذر الإنشاء.") : r.error);
    }
    setDatasetId(r.data.id);
    setStep("importing");
    await upload(r.data.id);
  }

  const fields = DATASET_FIELDS.filter((f) => f.entity === "both" || f.entity === entity);

  if (step === "details") {
    return (
      <form className="bos-form" onSubmit={onDetails}>
        <FormSection title="المصدر">
          <TextField name="name" label="اسم البيانات" required maxLength={200} placeholder="مثال: شركات الرياض من المورد X، أكتوبر 2026" span={2} />
          <SelectField name="source_kind" label="نوع المصدر" value={kind} onChange={(e) => setKind(e.target.value as Kind)} options={[
            { value: "purchased", label: "بيانات مشتراة" }, { value: "open_data", label: "بيانات مفتوحة" }, { value: "registry", label: "سجل حكومي" },
            { value: "crawl", label: "زحف المواقع" }, { value: "partner", label: "شريك" }, { value: "other", label: "أخرى" },
          ]} />
          <TextField name="vendor" label="المورد / الجهة" maxLength={200} />
          <TextField name="source_url" label="رابط المصدر" type="url" dir="ltr" placeholder="https://" />
          <TextField name="purchased_at" label="تاريخ الشراء أو التحميل" type="date" />
          <TextField name="cost_usd" label="التكلفة (USD)" type="number" min={0} step={0.01} />
          <TextField name="countries" label="الدول التي يغطيها (رموز ISO)" placeholder="EG, SA, KW, AE" dir="ltr" />
          <TextField name="default_country" label="دولة الصفوف بدون عمود دولة" placeholder="EG" dir="ltr" maxLength={60} hint="تُستخدم أيضًا لقراءة أرقام الهاتف المحلية." />
        </FormSection>
        <FormSection title="الترخيص">
          <TextField name="license_name" label="اسم الترخيص أو العقد" maxLength={200} placeholder="مثال: ODbL، عقد المورد رقم 12" span={2} />
          <CheckboxField name="customer_facing" label="مسموح عرضها وتسليمها للعملاء" hint="بدونها تبقى البيانات داخلية: تُستخدم للمطابقة والإثراء فقط ولا تظهر في نتائج البحث." />
          <CheckboxField name="redistributable" label="مسموح استخدامها لكل العملاء (وليس لعميل واحد)" />
          <TextField name="attribution" label="نص الإسناد المطلوب" maxLength={500} placeholder="مثال: © OpenStreetMap contributors" span={2} />
          <TextField name="retention_days" label="مدة الاحتفاظ (أيام)" type="number" min={1} step={1} hint="فارغ = بدون حد. القيم تنتهي بعد المدة." />
        </FormSection>
        <FormSection title="الملف">
          <div className="bos-field span-all">
            <label htmlFor="ds-file"><Tx>ملف البيانات (CSV أو XLSX أو JSON)</Tx></label>
            <input id="ds-file" name="file" type="file" accept=".csv,.tsv,.txt,.xlsx,.json" required />
            <span className="bos-hint"><Tx>يُقرأ الملف في متصفحك ويُرسل على دفعات. حتى 150 ميجابايت ومليون صف لكل ملف.</Tx></span>
          </div>
          <CheckboxField name="enrich" label="إثراء من مواقع الشركات بعد الاستيراد" hint="الزاحف يقرأ موقع كل شركة ويضيف البريد والهاتف والحسابات المنشورة عليه." />
          <TextAreaField name="notes" label="ملاحظات" rows={2} maxLength={4000} />
        </FormSection>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="admin-btn" type="submit" disabled={busy}>{busy ? t("جارٍ قراءة الملف وربط الأعمدة…") : t("التالي: ربط الأعمدة")}</button>
      </form>
    );
  }

  if (step === "mapping" && file) {
    const okRows = preview.filter(usable).length;
    return (
      <div className="ds-mapping">
        <p className="bos-faint" style={{ marginTop: 0 }}>
          <Tx vars={{ n: file.rows.length.toLocaleString("en-US"), f: file.name }}>{"{f}: {n} صف."}</Tx>{" "}
          {mappingSource === "ai" ? <Tx>الربط مقترح بالذكاء الاصطناعي، راجعه.</Tx> : mappingSource === "rules" ? <Tx>الربط مبني على أسماء الأعمدة، راجعه.</Tx> : <Tx>ربط معدّل يدويًا.</Tx>}
        </p>
        {note && <p className="bos-hint">{note}</p>}
        <div className="bos-row" role="radiogroup" aria-label={t("نوع الصفوف")} style={{ margin: "8px 0 14px" }}>
          <span className="bos-faint"><Tx>كل صف يمثل:</Tx></span>
          {(["company", "person"] as const).map((e) => (
            <button key={e} type="button" role="radio" aria-checked={entity === e} className={`admin-btn small ${entity === e ? "" : "secondary"}`} onClick={() => { setEntity(e); setMappingSource("manual"); }}>
              {e === "company" ? t("شركة / نشاط") : t("شخص في شركة")}
            </button>
          ))}
        </div>
        <div className="bos-table-scroll">
          <table className="bos-table">
            <thead><tr><th><Tx>العمود في الملف</Tx></th><th><Tx>أمثلة</Tx></th><th><Tx>الحقل في يولياس</Tx></th></tr></thead>
            <tbody>
              {file.headers.map((h, i) => (
                <tr key={i}>
                  <td dir="auto">{h}</td>
                  <td className="bos-faint" dir="auto" style={{ maxWidth: 320 }}>{file.rows.slice(0, 3).map((r) => r[i]).filter(Boolean).join(" · ").slice(0, 120)}</td>
                  <td>
                    <select aria-label={h} value={byColumn[i] ?? ""} onChange={(e) => setColumn(i, e.target.value)}>
                      <option value="">{t("تجاهل")}</option>
                      {fields.map((f) => <option key={f.key} value={f.key}>{t(f.label)}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="ds-subtitle"><Tx>معاينة بعد التنظيف</Tx></h3>
        <div className="bos-table-scroll">
          <table className="bos-table">
            <thead><tr><th><Tx>الشركة</Tx></th>{entity === "person" && <th><Tx>الشخص</Tx></th>}<th><Tx>الدومين</Tx></th><th><Tx>البريد</Tx></th><th><Tx>الهاتف</Tx></th><th><Tx>الدولة</Tx></th><th><Tx>ملاحظات</Tx></th></tr></thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i}>
                  <td dir="auto">{r.company.name ?? "-"}</td>
                  {entity === "person" && <td dir="auto">{r.person?.full_name ?? "-"}{r.person?.title ? <div className="bos-faint">{r.person.title}</div> : null}</td>}
                  <td dir="ltr">{r.company.domain ?? "-"}</td>
                  <td dir="ltr">{(entity === "person" ? r.person?.email : r.company.email) ?? "-"}</td>
                  <td dir="ltr">{(entity === "person" ? r.person?.phone : r.company.phone) ?? "-"}</td>
                  <td>{r.company.country ?? "-"}</td>
                  <td>{!usable(r) ? <StatusBadge tone="danger" label="سيُستبعد" /> : r.problems.map((p) => t(problemLabels[p] ?? p)).join("، ") || "✓"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="bos-hint"><Tx vars={{ ok: okRows, n: preview.length }}>{"{ok} من {n} صفوف المعاينة صالحة."}</Tx></p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="bos-row" style={{ marginTop: 12 }}>
          <button type="button" className="admin-btn secondary" onClick={() => setStep("details")} disabled={busy}><Tx>رجوع</Tx></button>
          <button type="button" className="admin-btn" onClick={onStart} disabled={busy}>{busy ? t("جارٍ البدء…") : t("ابدأ الاستيراد")}</button>
        </div>
      </div>
    );
  }

  const total = file?.rows.length ?? 0;
  return (
    <div className="ds-progress" aria-live="polite">
      <ProgressBar value={total ? Math.round((progress.done / total) * 100) : 0} />
      <p><Tx vars={{ done: progress.done.toLocaleString("en-US"), total: total.toLocaleString("en-US") }}>{"أُرسل {done} من {total} صف."}</Tx></p>
      <p className="bos-faint"><Tx vars={{ m: progress.merged.toLocaleString("en-US"), i: progress.invalid.toLocaleString("en-US") }}>{"دُمج {m} · مستبعد {i}"}</Tx></p>
      {busy && <p className="bos-hint"><Tx>لا تغلق هذه الصفحة حتى ينتهي الإرسال.</Tx></p>}
      {error && (
        <>
          <p className="form-error" role="alert">{error}</p>
          {datasetId && <button type="button" className="admin-btn" onClick={() => upload(datasetId)}><Tx>متابعة الاستيراد</Tx></button>}
        </>
      )}
    </div>
  );
}
