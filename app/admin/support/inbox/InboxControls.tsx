"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, Opt, useT } from "@/components/bos/I18n";
import { ModalButton, ConfirmButton } from "@/components/bos/Dialog";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { assignAction, escalateAction, metaAction, myAvailabilityAction, newConversationAction, replyAction, statusAction, ticketFromConversationAction } from "./actions";

type O = { value: string; label: string };

// Keeps the inbox fresh (new customer messages) without a manual reload.
export function LiveRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

export function Composer({ id, channel, disabled }: { id: string; channel: string; disabled: boolean }) {
  const t = useT();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const send = () => {
    if (!body.trim()) return;
    start(async () => {
      const r = await replyAction(id, body, internal);
      setMsg(r.ok ? { ok: true, text: r.message ?? "" } : { ok: false, text: r.error });
      if (r.ok) {
        setBody("");
        router.refresh();
      }
    });
  };
  const hint = channel === "email" ? "يُرسل بالبريد للعميل عبر مزود البريد" : channel === "phone" || channel === "manual" ? "يُحفظ كملاحظة لما قيل للعميل" : channel === "whatsapp" || channel === "sms" ? "القناة غير متصلة بعد — يُحفظ الرد فقط" : "يظهر للعميل في قناته";
  return (
    <div className={`bos-composer${internal ? " internal" : ""}`}>
      <div className="bos-seg" role="tablist">
        <button type="button" className={!internal ? "on" : ""} onClick={() => setInternal(false)}><Tx>رد للعميل</Tx></button>
        <button type="button" className={internal ? "on" : ""} onClick={() => setInternal(true)}><Tx>ملاحظة داخلية</Tx></button>
      </div>
      <textarea
        value={body}
        disabled={disabled || pending}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
        }}
        placeholder={t(internal ? "ملاحظة لا يراها العميل..." : "اكتب ردك... (Ctrl+Enter للإرسال)")}
        rows={4}
        dir="auto"
      />
      <div className="bos-row" style={{ justifyContent: "space-between" }}>
        <span className="bos-faint" style={{ fontSize: 11.5 }}><Tx>{internal ? "لا تُرسل للعميل" : hint}</Tx></span>
        <button type="button" className="admin-btn small" disabled={disabled || pending || !body.trim()} onClick={send}><Tx>{pending ? "جارٍ الإرسال..." : internal ? "حفظ الملاحظة" : "إرسال"}</Tx></button>
      </div>
      {msg ? <div className={msg.ok ? "bos-form-success" : "bos-form-error"}><Tx>{msg.text}</Tx></div> : null}
    </div>
  );
}

export function ConversationActions({ id, status, assigneeId, teamId, me, staff, teams, priority, hasTicket, canAssign }: { id: string; status: string; assigneeId: string | null; teamId: string | null; me: string; staff: O[]; teams: O[]; priority: string; hasTicket: boolean; canAssign: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [snooze, setSnooze] = useState("");
  const run = (fn: () => Promise<{ ok: true; message?: string; data?: unknown } | { ok: false; error: string }>, after?: (d: unknown) => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? "" } : { ok: false, text: r.error });
      if (r.ok) {
        after?.(r.data);
        router.refresh();
      }
    });
  const closed = status === "resolved" || status === "closed";
  return (
    <div className="bos-stack" style={{ gap: 8 }}>
      <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
        {assigneeId !== me ? <button type="button" className="admin-btn small secondary" disabled={pending} onClick={() => run(() => assignAction(id, { assignee_id: me }))}><Tx>إسناد لي</Tx></button> : null}
        {!closed ? <button type="button" className="admin-btn small success" disabled={pending} onClick={() => run(() => statusAction(id, "resolved"))}><Tx>تم الحل</Tx></button> : <button type="button" className="admin-btn small secondary" disabled={pending} onClick={() => run(() => statusAction(id, "open"))}><Tx>إعادة فتح</Tx></button>}
        {status !== "pending_internal" && !closed ? <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => run(() => statusAction(id, "pending_internal"))}><Tx>بانتظار الفريق</Tx></button> : null}
        {status === "resolved" ? <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => run(() => statusAction(id, "closed"))}><Tx>إغلاق</Tx></button> : null}
        {!hasTicket ? <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => run(() => ticketFromConversationAction(id), (d) => { const x = d as { id: string } | undefined; if (x) router.push(`/admin/support/tickets/${x.id}`); })}><Tx>إنشاء تذكرة</Tx></button> : null}
        {!closed ? <ConfirmButton label="تصعيد" className="admin-btn small danger" title="تصعيد المحادثة" message={t("ترفع الأولوية ويُبلَّغ قادة الفريق.")} requireReason reasonLabel="سبب التصعيد" confirmLabel="تصعيد" action={(reason) => escalateAction(id, reason)} /> : null}
      </div>
      <div className="bos-form-grid">
        <div className="bos-field">
          <label><Tx>المسؤول</Tx></label>
          <select value={assigneeId ?? ""} disabled={pending || !canAssign} onChange={(e) => run(() => assignAction(id, { assignee_id: e.target.value || null }))}>
            <option value="">{t("— غير معيّن —")}</option>
            {staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="bos-field">
          <label><Tx>الفريق</Tx></label>
          <select value={teamId ?? ""} disabled={pending || !canAssign} onChange={(e) => run(() => assignAction(id, { team_id: e.target.value || null }))}>
            <option value="">—</option>
            {teams.map((s) => <Opt key={s.value} value={s.value}>{s.label}</Opt>)}
          </select>
        </div>
        <div className="bos-field">
          <label><Tx>الأولوية</Tx></label>
          <select value={priority} disabled={pending} onChange={(e) => run(() => metaAction(id, { priority: e.target.value as "normal" }))}>
            {[["low", "منخفضة"], ["normal", "عادية"], ["high", "عالية"], ["urgent", "عاجلة"]].map(([v, l]) => <Opt key={v} value={v}>{l}</Opt>)}
          </select>
        </div>
        {!closed ? (
          <div className="bos-field">
            <label><Tx>تأجيل حتى</Tx></label>
            <div className="bos-row" style={{ gap: 4, flexWrap: "nowrap" }}>
              <input type="datetime-local" value={snooze} onChange={(e) => setSnooze(e.target.value)} />
              <button type="button" className="admin-btn small ghost" disabled={pending || !snooze} onClick={() => run(() => statusAction(id, "snoozed", new Date(snooze).toISOString()))}><Tx>تأجيل</Tx></button>
            </div>
          </div>
        ) : null}
      </div>
      {msg ? <div className={msg.ok ? "bos-form-success" : "bos-form-error"}><Tx>{msg.text}</Tx></div> : null}
    </div>
  );
}

export function NewConversationButton({ teams }: { teams: O[] }) {
  const router = useRouter();
  return (
    <ModalButton label="+ محادثة" title="تسجيل محادثة جديدة" className="admin-btn small">
      {(close) => (
        <ActionForm action={newConversationAction} onSuccess={(s) => { close(); const d = (s as { data?: { id: string } }).data; if (d) router.push(`/admin/support/inbox?c=${d.id}`); }} successMessage="تم الإنشاء">
          <div className="bos-form-grid">
            <SelectField name="channel" label="القناة" defaultValue="phone" options={[{ value: "phone", label: "مكالمة" }, { value: "email", label: "بريد" }, { value: "whatsapp", label: "واتساب" }, { value: "sms", label: "SMS" }, { value: "manual", label: "أخرى" }]} />
            <SelectField name="priority" label="الأولوية" defaultValue="normal" options={[{ value: "low", label: "منخفضة" }, { value: "normal", label: "عادية" }, { value: "high", label: "عالية" }, { value: "urgent", label: "عاجلة" }]} />
            <TextField name="name" label="اسم العميل" />
            <TextField name="email" label="البريد" type="email" dir="ltr" />
            <TextField name="phone" label="الهاتف" dir="ltr" />
            <TextField name="company" label="الشركة" />
            <SelectField name="team_id" label="الفريق" placeholder="الافتراضي" options={teams} />
            <TextField name="subject" label="الموضوع" />
          </div>
          <TextAreaField name="body" label="رسالة العميل / ملخص المكالمة" required />
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>يُربط العميل تلقائياً بملفه إن وُجد (نفس البريد أو الهاتف) ويُسند للفريق حسب قاعدة التوزيع.</Tx></p>
          <div className="bos-form-actions"><SubmitButton label="إنشاء" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function AvailabilityToggle({ available }: { available: boolean | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (available === null) return null;
  return (
    <button type="button" className={`admin-btn small ${available ? "success" : "ghost"}`} disabled={pending} onClick={() => start(async () => { await myAvailabilityAction(!available); router.refresh(); })}>
      <Tx>{available ? "● متاح" : "○ غير متاح"}</Tx>
    </button>
  );
}
