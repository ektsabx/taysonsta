"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, useT } from "@/components/bos/I18n";
import { ModalButton, ActionButton } from "@/components/bos/Dialog";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/bos/Form";
import { accountAction, addManualAccountAction, addTelegramAction, manualMetricsAction, postAction, targetAction } from "./actions";
import type { ActionState } from "@/lib/bos/action";

function Run({ label, run, className = "admin-btn small secondary", confirm }: { label: string; run: () => Promise<ActionState>; className?: string; confirm?: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span className="bos-stack" style={{ gap: 2, display: "inline-flex" }}>
      <button type="button" className={className} disabled={pending} onClick={() => { if (confirm && !window.confirm(t(confirm))) return; start(async () => { const r = await run(); setMsg(r.ok ? { ok: true, text: r.message ?? "تم" } : { ok: false, text: r.error }); router.refresh(); }); }}>{pending ? "…" : t(label)}</button>
      {msg ? <span className={msg.ok ? "bos-faint" : "bos-danger"} style={{ fontSize: 11.5 }}>{t(msg.text)}</span> : null}
    </span>
  );
}

export function PostWorkflow({ id, status, canApprove, reviewers }: { id: string; status: string; canApprove: boolean; reviewers: { value: string; label: string }[] }) {
  const t = useT();
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [at, setAt] = useState("");
  return (
    <div className="bos-row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      {["draft", "changes_requested"].includes(status) ? (
        <>
          <select value={reviewer} onChange={(e) => setReviewer(e.target.value)} className="bos-select-small" aria-label={t("المراجع")}><option value="">{t("المراجع (اختياري)")}</option>{reviewers.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
          <Run label="إرسال للمراجعة" run={() => postAction(id, "submit", reviewer || null)} />
        </>
      ) : null}
      {canApprove && ["in_review", "draft"].includes(status) ? <Run label="اعتماد" className="admin-btn small" run={() => postAction(id, "approve", note || null)} /> : null}
      {canApprove && status === "in_review" ? (
        <>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("ملاحظات المراجعة")} style={{ minWidth: 200 }} />
          <Run label="طلب تعديلات" className="admin-btn small ghost" run={() => postAction(id, "changes", note)} />
        </>
      ) : null}
      {["approved", "scheduled"].includes(status) ? (
        <>
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} aria-label={t("موعد النشر")} />
          <Run label="جدولة" run={() => postAction(id, "schedule", at ? new Date(at).toISOString() : "")} />
        </>
      ) : null}
      {["approved", "scheduled", "partially_published", "failed"].includes(status) ? <Run label="نشر الآن" className="admin-btn small" confirm="سيُنشر على كل المنصات المختارة الآن. متابعة؟" run={() => postAction(id, "publish")} /> : null}
      {!["published", "publishing", "cancelled"].includes(status) ? <Run label="إلغاء المنشور" className="admin-btn small ghost" confirm="إلغاء المنشور؟" run={() => postAction(id, "cancel")} /> : null}
    </div>
  );
}

export function TargetControls({ targetId, status, mode, platform }: { targetId: string; status: string; mode: string; platform: string }) {
  const t = useT();
  const [url, setUrl] = useState("");
  return (
    <div className="bos-row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {status === "failed" ? <Run label="إعادة المحاولة" run={() => targetAction(targetId, "retry")} /> : null}
      {["manual_pending", "failed"].includes(status) && (mode === "manual" || status === "manual_pending") ? (
        <>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("رابط المنشور بعد نشره")} dir="ltr" style={{ minWidth: 220 }} />
          <Run label="تم النشر يدوياً" run={() => targetAction(targetId, "manual", url)} />
        </>
      ) : null}
      {status === "published" && ["facebook", "instagram"].includes(platform) && mode === "api" ? <Run label="تحديث الأرقام" className="admin-btn small ghost" run={() => targetAction(targetId, "sync")} /> : null}
    </div>
  );
}

const metricFields: { key: string; label: string }[] = [
  { key: "views", label: "المشاهدات" }, { key: "reach", label: "الوصول" }, { key: "impressions", label: "مرات الظهور" }, { key: "likes", label: "الإعجابات" },
  { key: "comments", label: "التعليقات" }, { key: "shares", label: "المشاركات" }, { key: "saves", label: "الحفظ" }, { key: "clicks", label: "النقرات" },
];

export function ManualMetricsButton({ targetId, current }: { targetId: string; current: Record<string, number> }) {
  return (
    <ModalButton label="إدخال الأرقام يدوياً" title="أرقام المنشور (من لوحة المنصة)" className="admin-btn small ghost">
      {(close) => (
        <ActionForm action={manualMetricsAction} onSuccess={close} successMessage="تم الحفظ">
          <input type="hidden" name="target_id" value={targetId} />
          <p className="bos-hint"><Tx>اترك الخانة فارغة إن لم تكن المنصة توفر الرقم — لا تُقدّر.</Tx></p>
          <div className="bos-form-grid">
            {metricFields.map((m) => <TextField key={m.key} name={m.key} label={m.label} type="number" min={0} defaultValue={current[m.key] != null ? String(current[m.key]) : ""} />)}
          </div>
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function AddAccountButtons({ platforms }: { platforms: { value: string; label: string }[] }) {
  return (
    <span className="bos-row" style={{ gap: 6 }}>
      <ActionButton label="استيراد صفحات فيسبوك وإنستجرام" className="admin-btn small secondary" action={() => accountAction("import_meta")} />
      <ModalButton label="+ قناة تيليجرام" title="إضافة قناة تيليجرام" className="admin-btn small secondary">
        {(close) => (
          <ActionForm action={addTelegramAction} onSuccess={close} successMessage="تم">
            <TextField name="chat" label="معرّف القناة" dir="ltr" placeholder="@mychannel" required hint="أضف البوت مشرفاً في القناة بصلاحية النشر أولاً." />
            <div className="bos-form-actions"><SubmitButton label="إضافة" /></div>
          </ActionForm>
        )}
      </ModalButton>
      <ModalButton label="+ حساب يدوي" title="حساب يُنشر عليه يدوياً" className="admin-btn small">
        {(close) => (
          <ActionForm action={addManualAccountAction} onSuccess={close} successMessage="تم">
            <div className="bos-form-grid">
              <SelectField name="platform" label="المنصة" options={platforms} required />
              <TextField name="name" label="اسم الحساب" required />
              <TextField name="handle" label="المعرّف" dir="ltr" placeholder="@taysonsta" />
              <TextField name="profile_url" label="رابط الحساب" dir="ltr" />
            </div>
            <div className="bos-form-actions"><SubmitButton label="إضافة" /></div>
          </ActionForm>
        )}
      </ModalButton>
    </span>
  );
}

export function AccountRowControls({ id, active, api }: { id: string; active: boolean; api: boolean }) {
  return (
    <span className="bos-row" style={{ gap: 6 }}>
      {api && active ? <Run label="مزامنة" className="admin-btn small ghost" run={() => accountAction("sync", id)} /> : null}
      <Run label={active ? "فصل" : "تفعيل"} className="admin-btn small ghost" confirm={active ? "فصل الحساب؟ لن يُنشر عليه حتى يُفعّل." : undefined} run={() => accountAction(active ? "disable" : "enable", id)} />
    </span>
  );
}
