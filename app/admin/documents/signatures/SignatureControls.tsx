"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, useT } from "@/components/bos/I18n";
import type { ActionState } from "@/lib/bos/action";
import { sendForSignatureAction, signatureAction } from "./actions";

type Signer = { name: string; email: string; role: "client" | "company" | "employee" | "witness" | "other" };

export function SendForSignature({ documentId, defaults, docusignReady }: { documentId: string; defaults: Signer[]; docusignReady: boolean }) {
  const t = useT();
  const router = useRouter();
  const [provider, setProvider] = useState<"docusign" | "offline">(docusignReady ? "docusign" : "offline");
  const [order, setOrder] = useState<"sequential" | "parallel">("sequential");
  const [signers, setSigners] = useState<Signer[]>(defaults.length ? defaults : [{ name: "", email: "", role: "client" }]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [days, setDays] = useState("30");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (i: number, k: keyof Signer, v: string) => setSigners((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div className="bos-stack" style={{ gap: 8 }}>
      <div className="bos-row" style={{ gap: 8, flexWrap: "wrap" }}>
        <label className="bos-check"><input type="radio" checked={provider === "docusign"} disabled={!docusignReady} onChange={() => setProvider("docusign")} /> DocuSign{!docusignReady ? <span className="bos-faint"> (<Tx>غير متصل</Tx>)</span> : null}</label>
        <label className="bos-check"><input type="radio" checked={provider === "offline"} onChange={() => setProvider("offline")} /> <Tx>توقيع خارج النظام (ورقي أو أداة أخرى)</Tx></label>
        <span style={{ flex: 1 }} />
        <select value={order} onChange={(e) => setOrder(e.target.value as "sequential")} className="bos-select-small" aria-label={t("ترتيب التوقيع")}><option value="sequential">{t("بالترتيب")}</option><option value="parallel">{t("بالتوازي")}</option></select>
      </div>
      {signers.map((s, i) => (
        <div key={i} className="bos-row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {order === "sequential" ? <span className="bos-faint" style={{ width: 18 }}>{i + 1}.</span> : null}
          <input value={s.name} onChange={(e) => set(i, "name", e.target.value)} placeholder={t("الاسم")} style={{ minWidth: 160 }} />
          <input value={s.email} onChange={(e) => set(i, "email", e.target.value)} placeholder={t("البريد الإلكتروني")} dir="ltr" style={{ minWidth: 200 }} />
          <select value={s.role} onChange={(e) => set(i, "role", e.target.value)} className="bos-select-small" aria-label={t("الصفة")}><option value="client">{t("العميل")}</option><option value="company">{t("الشركة")}</option><option value="employee">{t("الموظف")}</option><option value="witness">{t("شاهد")}</option><option value="other">{t("أخرى")}</option></select>
          {signers.length > 1 ? <button type="button" className="admin-btn small ghost" onClick={() => setSigners((x) => x.filter((_, j) => j !== i))} aria-label={t("حذف")}>×</button> : null}
        </div>
      ))}
      {signers.length < 10 ? <div><button type="button" className="admin-btn small ghost" onClick={() => setSigners((x) => [...x, { name: "", email: "", role: "company" }])}><Tx>+ موقّع</Tx></button></div> : null}
      {provider === "docusign" ? (
        <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("عنوان البريد (اختياري)")} style={{ flex: 1, minWidth: 200 }} maxLength={100} />
          <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("رسالة للموقّعين (اختياري)")} style={{ flex: 2, minWidth: 240 }} maxLength={2000} />
          <label className="bos-row" style={{ gap: 4, alignItems: "center" }}><Tx>المهلة (أيام)</Tx> <input type="number" min={1} max={120} value={days} onChange={(e) => setDays(e.target.value)} style={{ width: 70 }} /></label>
        </div>
      ) : null}
      <p className="bos-hint" style={{ margin: 0 }}>{provider === "docusign" ? <Tx>تُضاف صفحة توقيعات بخانة لكل موقّع. يستلم الموقّعون بريداً من DocuSign، وتصل حالة كل توقيع تلقائياً، وتُحفظ النسخة الموقعة (مع شهادة الإتمام) في ملفات السجل.</Tx> : <Tx>سجّل توقيع كل طرف يدوياً ثم أرفق النسخة الموقعة من ملفات السجل لإغلاق الطلب.</Tx>} <Tx>تأكد من المتطلبات القانونية للتوقيع الإلكتروني في بلد التعاقد ونوع المستند.</Tx></p>
      <div className="bos-row" style={{ gap: 6, alignItems: "center" }}>
        <button type="button" className="admin-btn small" disabled={pending} onClick={() => start(async () => { setMsg(null); const r = await sendForSignatureAction({ document_id: documentId, provider, signing_order: order, subject, message, expires_days: Number(days), signers }); if (r.ok) { setMsg({ ok: true, text: r.message ?? "تم" }); if (r.data?.id) router.push(`/admin/documents/signatures/${r.data.id}`); } else setMsg({ ok: false, text: r.error }); })}>{pending ? t("جارٍ الإرسال...") : t("إرسال للتوقيع")}</button>
        {msg ? <span className={msg.ok ? "bos-faint" : "bos-danger"} style={{ fontSize: 12 }}>{t(msg.text)}</span> : null}
      </div>
    </div>
  );
}

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return { pending, msg, run: (fn: () => Promise<ActionState>) => start(async () => { const r = await fn(); setMsg(r.ok ? { ok: true, text: r.message ?? "تم" } : { ok: false, text: r.error }); router.refresh(); }) };
}

export function RequestActions({ id, provider, active, files }: { id: string; provider: string; active: boolean; files: { value: string; label: string }[] }) {
  const t = useT();
  const { pending, msg, run } = useRun();
  const [reason, setReason] = useState("");
  const [file, setFile] = useState("");
  if (!active) return null;
  return (
    <div className="bos-stack" style={{ gap: 6 }}>
      <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
        {provider === "docusign" ? <button type="button" className="admin-btn small secondary" disabled={pending} onClick={() => run(() => signatureAction("resend", id))}><Tx>إعادة إرسال التذكير</Tx></button> : null}
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("سبب الإلغاء")} style={{ minWidth: 200 }} />
        <button type="button" className="admin-btn small ghost" disabled={pending || !reason.trim()} onClick={() => { if (window.confirm(t("إلغاء طلب التوقيع؟"))) run(() => signatureAction("void", id, reason)); }}><Tx>إلغاء الطلب</Tx></button>
      </div>
      {provider === "offline" ? (
        <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
          <select value={file} onChange={(e) => setFile(e.target.value)} className="bos-select-small" aria-label={t("النسخة الموقعة")}><option value="">{t("اختر ملف النسخة الموقعة…")}</option>{files.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
          <button type="button" className="admin-btn small" disabled={pending || !file} onClick={() => run(() => signatureAction("complete_offline", id, file))}><Tx>إغلاق الطلب كموقّع</Tx></button>
        </div>
      ) : null}
      {msg ? <span className={msg.ok ? "bos-faint" : "bos-danger"} style={{ fontSize: 12 }}>{t(msg.text)}</span> : null}
    </div>
  );
}

export function OfflineSignerButton({ signerId }: { signerId: string }) {
  const t = useT();
  const { pending, msg, run } = useRun();
  const [at, setAt] = useState("");
  return (
    <span className="bos-row" style={{ gap: 4, alignItems: "center" }}>
      <input type="date" value={at} onChange={(e) => setAt(e.target.value)} aria-label={t("تاريخ التوقيع")} />
      <button type="button" className="admin-btn small secondary" disabled={pending} onClick={() => run(() => signatureAction("offline_signed", signerId, at || undefined))}><Tx>تسجيل التوقيع</Tx></button>
      {msg && !msg.ok ? <span className="bos-danger" style={{ fontSize: 11 }}>{t(msg.text)}</span> : null}
    </span>
  );
}
