"use client";
import { BosTable } from "@/components/bos/BosTable";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ModalButton } from "@/components/bos/Dialog";
import { Tx, useT } from "@/components/bos/I18n";
import { createClient } from "@/lib/supabase/client";
import type { ActionState } from "@/lib/bos/action";
import { analyzeImportAction, executeImportAction, rollbackImportAction, startImportAction, validateImportAction } from "./actions";

type O = { value: string; label: string };

export function NewImport({ types }: { types: O[] }) {
  const t = useT();
  const router = useRouter();
  const [type, setType] = useState(types[0]?.value ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const onFile = (file: File | undefined) => {
    if (!file || !type) return;
    start(async () => {
      setErr(null);
      const s = await startImportAction({ dataType: type, fileName: file.name, size: file.size });
      if (!s.ok || !s.data) return setErr(s.ok ? "تعذر البدء" : s.error);
      const { error } = await createClient().storage.from("bos-files").uploadToSignedUrl(s.data.path, s.data.token, file, { contentType: file.type || "application/octet-stream" });
      if (error) return setErr("تعذر رفع الملف");
      const a = await analyzeImportAction(s.data.jobId);
      if (!a.ok) return setErr(a.error);
      router.push(`/admin/imports/${s.data.jobId}`);
    });
  };
  return (
    <div className="bos-stack" style={{ gap: 8 }}>
      <div className="bos-form-grid">
        {types.length > 1 ? <div className="bos-field"><label><Tx>نوع البيانات</Tx></label><select value={type} onChange={(e) => setType(e.target.value)}>{types.map((x) => <option key={x.value} value={x.value}>{t(x.label)}</option>)}</select></div> : null}
        <div className="bos-field"><label><Tx>الملف (CSV أو XLSX أو JSON، حتى 10MB)</Tx></label><input type="file" accept=".csv,.xlsx,.json" disabled={pending} onChange={(e) => onFile(e.target.files?.[0])} /></div>
      </div>
      {pending ? <p className="bos-faint"><Tx>جارٍ الرفع والقراءة…</Tx></p> : null}
      {err ? <p className="bos-danger" style={{ fontSize: 12 }}>{t(err)}</p> : null}
    </div>
  );
}

export function MappingForm({ jobId, headers, fields, matchKeys, initial }: { jobId: string; headers: string[]; fields: { key: string; label: string; required?: boolean }[]; matchKeys: { value: string; label: string }[]; initial: { mapping: Record<string, string>; matchKey: string | null; mode: string; expected: number | null } }) {
  const t = useT();
  const router = useRouter();
  const [mapping, setMapping] = useState<Record<string, string>>(initial.mapping);
  const [matchKey, setMatchKey] = useState(initial.matchKey ?? "");
  const [mode, setMode] = useState(initial.mode);
  const [expected, setExpected] = useState(initial.expected != null ? String(initial.expected) : "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="bos-stack" style={{ gap: 8 }}>
      <BosTable className="bos-table">
        <thead><tr><th><Tx>حقل النظام</Tx></th><th><Tx>العمود في الملف</Tx></th></tr></thead>
        <tbody>{fields.map((f) => (
          <tr key={f.key}><td>{t(f.label)}{f.required ? <span className="bos-danger"> *</span> : null}</td><td><select value={mapping[f.key] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))} aria-label={t(f.label)}><option value="">{t("— لا يُستورد —")}</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></td></tr>
        ))}</tbody>
      </BosTable>
      <div className="bos-form-grid">
        {matchKeys.length ? <div className="bos-field"><label><Tx>حقل المطابقة مع السجلات الموجودة</Tx></label><select value={matchKey} onChange={(e) => setMatchKey(e.target.value)}><option value="">{t("بدون مطابقة")}</option>{matchKeys.map((m) => <option key={m.value} value={m.value}>{t(m.label)}</option>)}</select></div> : null}
        <div className="bos-field"><label><Tx>عند وجود السجل مسبقاً</Tx></label><select value={mode} onChange={(e) => setMode(e.target.value)}><option value="create_only">{t("تخطّيه (لا تعديل)")}</option><option value="update_matches">{t("تحديث الحقول المربوطة غير الفارغة فقط")}</option></select></div>
        <div className="bos-field"><label><Tx>العدد المتوقع للسجلات (اختياري)</Tx></label><input type="number" min={0} value={expected} onChange={(e) => setExpected(e.target.value)} /></div>
      </div>
      <div className="bos-row" style={{ gap: 6, alignItems: "center" }}>
        <button type="button" className="admin-btn" disabled={pending} onClick={() => start(async () => { const r = await validateImportAction(jobId, { mapping, matchKey: matchKey || null, mode: mode as "create_only", expectedCount: expected === "" ? null : Number(expected) }); setMsg(r.ok ? { ok: true, text: r.message ?? "تم" } : { ok: false, text: r.error }); router.refresh(); })}>{pending ? t("جارٍ التحقق…") : t("تحقق من البيانات")}</button>
        {msg ? <span className={msg.ok ? "bos-faint" : "bos-danger"} style={{ fontSize: 12 }}>{t(msg.text)}</span> : null}
      </div>
    </div>
  );
}

function Run({ label, run, confirmText, className = "admin-btn" }: { label: string; run: () => Promise<ActionState>; confirmText?: string; className?: string }) {
  const t = useT();
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="bos-row" style={{ gap: 6, alignItems: "center" }}>
      <button type="button" className={className} disabled={pending} onClick={() => { if (confirmText && !window.confirm(t(confirmText))) return; start(async () => { const r = await run(); setMsg(r.ok ? { ok: true, text: r.message ?? "تم" } : { ok: false, text: r.error }); router.refresh(); }); }}>{pending ? "…" : t(label)}</button>
      {msg ? <span className={msg.ok ? "bos-faint" : "bos-danger"} style={{ fontSize: 12 }}>{t(msg.text)}</span> : null}
    </span>
  );
}

export function ExecuteButton({ jobId, mismatch }: { jobId: string; mismatch: boolean }) {
  const [ack, setAck] = useState(false);
  return (
    <div className="bos-stack" style={{ gap: 6 }}>
      {mismatch ? <label className="bos-check"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> <Tx>أفهم أن العدد لا يطابق العدد المتوقع وأريد المتابعة</Tx></label> : null}
      <Run label="تنفيذ الاستيراد" confirmText="سيتم إنشاء/تحديث السجلات الآن. متابعة؟" run={() => executeImportAction(jobId, ack)} />
    </div>
  );
}

export function RollbackButton({ jobId }: { jobId: string }) {
  return <Run label="التراجع عن الاستيراد" className="admin-btn ghost" confirmText="سيُحذف ما أُنشئ ويُستعاد ما عُدّل. متابعة؟" run={() => rollbackImportAction(jobId)} />;
}

// Section import dialog (docs/bos/39 §4).
export function ImportDialog({ type, label, after, recent }: { type: string; label: string; after: { key: string; label: string; href: string }[]; recent: { id: string; number: string; file_name: string; status: string; created_count: number; updated_count: number; failed_count: number; when: string }[] }) {
  return (
    <ModalButton label="استيراد" title={`استيراد — ${label}`} className="admin-btn small ghost">
      {() => (
        <div className="bos-stack" style={{ gap: 12 }}>
          {after.length ? (
            <p className="bos-hint" style={{ margin: 0 }}>
              <Tx>ترتيب الاستيراد: تأكد أن هذه البيانات موجودة أولاً حتى لا تنكسر العلاقات —</Tx>{" "}
              {after.map((a, i) => <span key={a.key}>{i ? "، " : ""}<Link className="bos-link" href={a.href}><Tx>{a.label}</Tx></Link></span>)}
              <Tx>. الصفوف التي تشير إلى سجل غير موجود تظهر كأخطاء ولا تُكتب.</Tx>
            </p>
          ) : null}
          <NewImport types={[{ value: type, label }]} />
          <ul className="bos-steps-list" style={{ fontSize: 12.5 }}>
            <li><Tx>ارفع الملف، ثم اربط الأعمدة بحقول النظام.</Tx></li>
            <li><Tx>راجع الصفوف التي فيها أخطاء أو تكرار قبل التنفيذ — يمكنك تنزيل تقرير بها لتصحيحها.</Tx></li>
            <li><Tx>لا يُحذف أي سجل موجود، ولا يُعدَّل إلا إذا اخترت «تحديث السجلات المطابقة» صراحة.</Tx></li>
          </ul>
          {recent.length ? (
            <div>
              <div className="bos-kv-label" style={{ marginBottom: 4 }}><Tx>آخر عمليات الاستيراد</Tx></div>
              {recent.map((r) => (
                <Link key={r.id} href={`/admin/imports/${r.id}`} className="cx-other">
                  <span className="bos-ellipsis">{r.number} · {r.file_name}</span>
                  <span className="bos-faint" style={{ fontSize: 11.5 }}>{r.status === "completed" || r.status === "rolled_back" ? `+${r.created_count} · ~${r.updated_count} · ✖${r.failed_count}` : ""} {r.when}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </ModalButton>
  );
}
