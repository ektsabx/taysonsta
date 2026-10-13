"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { guessKind, guessMapping, importFields, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, parseCsv, toImportRow, type ImportField, type ImportKind } from "@/lib/csv-import";
import { importContacts } from "@/app/(app)/prospects/import-actions";

// Import CSV next to Export CSV (owner brief 2026-10-12): pick a file, check
// the column mapping and the type, see how many rows will be imported and how
// many uploaded contacts the plan has left, then import. The server checks
// everything again; the database enforces the limit.
export function ImportCsvButton({ available }: { available: number }) {
  const { t, locale } = useI18n();
  const im = t.prospects.import;
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; header: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<Record<ImportField, number> | null>(null);
  const [kind, setKind] = useState<ImportKind>("company");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const n = (v: number) => formatNumber(v, locale);

  const valid = useMemo(() => (file && mapping ? file.rows.filter((r) => toImportRow(r, mapping, kind)).length : 0), [file, mapping, kind]);
  const skipped = file ? file.rows.length - valid : 0;

  const close = () => {
    if (pending) return;
    setOpen(false);
    setFile(null);
    setMapping(null);
    setError(null);
  };

  const pick = async (f: File | undefined) => {
    setError(null);
    if (!f || f.size > MAX_IMPORT_BYTES || !/\.(csv|txt)$/i.test(f.name)) return setError(im.errors.file);
    const cells = parseCsv(await f.text());
    if (cells.length < 2) return setError(im.errors.empty);
    if (cells.length - 1 > MAX_IMPORT_ROWS) return setError(im.errors.tooMany);
    const m = guessMapping(cells[0]);
    setFile({ name: f.name, header: cells[0], rows: cells.slice(1) });
    setMapping(m);
    setKind(guessKind(m));
  };

  const submit = () => {
    if (!file || !mapping) return;
    if (mapping.name < 0) return setError(im.errors.name);
    if (!valid) return setError(im.errors.empty);
    if (valid > available) return setError(fmt(im.errors.limit, { count: n(available) }));
    start(async () => {
      setError(null);
      const r = await callAction(() => importContacts({ fileName: file.name, kind, mapping, rows: file.rows }));
      if (isNetworkFailure(r)) return setError(im.errors.failed);
      if (!r.ok) return setError(r.error);
      toast(r.message);
      setOpen(false);
      setFile(null);
      setMapping(null);
      router.refresh();
    });
  };

  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}><Upload /> {t.prospects.importCsv}</button>
      {open && (
        <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="drawer import-drawer" role="dialog" aria-modal="true" aria-labelledby="import-title">
            <div className="drawer-head">
              <h3 id="import-title">{im.title}</h3>
              <button className="modal-close-btn" type="button" aria-label={t.common.close} onClick={close} disabled={pending}><X /></button>
            </div>
            <div className="drawer-body">
              <p className="field-note">{im.lead}</p>
              <div className="field">
                <label htmlFor="import-file">{im.choose}</label>
                <input id="import-file" type="file" accept=".csv,text/csv" className="form-input" onChange={(e) => void pick(e.target.files?.[0])} disabled={pending} />
                <p className="field-note">{im.drop}</p>
              </div>

              {file && mapping && (
                <>
                  <div className="field">
                    <label htmlFor="import-kind">{im.type}</label>
                    <select id="import-kind" className="form-input" value={kind} onChange={(e) => setKind(e.target.value as ImportKind)} disabled={pending}>
                      {(["person", "company", "local_business"] as const).map((k) => <option key={k} value={k}>{im.types[k]}</option>)}
                    </select>
                  </div>
                  <fieldset className="import-mapping">
                    <legend>{im.mapping}</legend>
                    {importFields.filter((f) => kind === "person" || (f !== "title" && f !== "company")).map((f) => (
                      <label key={f} className="import-map-row">
                        <span>{im.fields[f]}</span>
                        <select className="form-input" value={mapping[f]} onChange={(e) => setMapping({ ...mapping, [f]: Number(e.target.value) })} disabled={pending}>
                          <option value={-1}>{im.ignore}</option>
                          {file.header.map((h, i) => <option key={i} value={i}>{h || `#${i + 1}`}</option>)}
                        </select>
                      </label>
                    ))}
                  </fieldset>
                  <p className="import-summary" role="status">
                    <strong>{fmt(im.preview, { count: n(valid) })}</strong>
                    {skipped > 0 && <span className="cell-sub">{fmt(im.skipped, { count: n(skipped) })}</span>}
                    <span className="cell-sub">{fmt(im.available, { count: n(available) })}</span>
                  </p>
                </>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="feedback-actions">
                <button className="btn-secondary" type="button" onClick={close} disabled={pending}>{t.common.cancel}</button>
                <button className="btn-primary" type="button" onClick={submit} disabled={pending || !file || !valid} aria-busy={pending}>
                  <span>{pending ? im.importing : fmt(im.submit, { count: n(valid) })}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
