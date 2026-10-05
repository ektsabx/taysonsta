"use client";

import { Tx, Opt, useT } from "@/components/bos/I18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/bos/action";
import { ActionButton, ConfirmButton, ModalButton } from "@/components/bos/Dialog";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { EntitySelector, type EntityOption } from "@/components/bos/EntitySelector";
import { searchEntitiesAction } from "@/app/admin/_actions/common";
import {
  assignTicketAction, mergeTicketAction, replyTicketAction, ticketStatusAction, updateTicketAction,
} from "./actions";

type Opt = { value: string; label: string };

export const priorities: Opt[] = [
  { value: "low", label: "منخفضة" },
  { value: "medium", label: "متوسطة" },
  { value: "high", label: "عالية" },
  { value: "urgent", label: "عاجلة" },
];
export const ticketCategories: Opt[] = [
  { value: "general", label: "عام" },
  { value: "technical", label: "تقني" },
  { value: "billing", label: "مالي" },
  { value: "access", label: "وصول / حساب" },
  { value: "content", label: "محتوى" },
  { value: "bug", label: "خطأ" },
];

const ticketStatusLabels: Record<string, string> = { open: "مفتوحة", in_progress: "قيد المعالجة", waiting_for_client: "بانتظار العميل", resolved: "تم الحل", closed: "مغلقة" };
const ticketNext: Record<string, string[]> = {
  open: ["in_progress", "waiting_for_client", "resolved", "closed"],
  in_progress: ["waiting_for_client", "resolved", "closed"],
  waiting_for_client: ["in_progress", "resolved", "closed"],
  resolved: ["in_progress", "closed"],
  closed: [],
};

export function TicketForm({ action, clientInit, staff, canAssign }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; clientInit?: EntityOption | null; staff: Opt[]; canAssign: boolean }) {
  const [client, setClient] = useState<EntityOption | null>(clientInit ?? null);
  return (
    <ActionForm action={action}>
      <div className="bos-form-grid">
        <div className="bos-field" style={{ gridColumn: "1 / -1" }}>
          <label><Tx>الحساب *</Tx></label>
          <EntitySelector name="client_id" required search={(q) => searchEntitiesAction("client", q)} initial={client} onChange={setClient} placeholder="ابحث عن الحساب..." />
        </div>
        {client ? (
          <>
            <div className="bos-field">
              <label><Tx>جهة الاتصال</Tx></label>
              <EntitySelector key={`c-${client.id}`} name="contact_id" search={(q) => searchEntitiesAction("contact", q, { client_id: client.id })} placeholder="اختياري" />
            </div>
            <div className="bos-field">
              <label><Tx>المشروع</Tx></label>
              <EntitySelector key={`p-${client.id}`} name="project_id" search={(q) => searchEntitiesAction("project", q, { client_id: client.id })} placeholder="اختياري" />
            </div>
          </>
        ) : null}
        <SelectField name="category" label="التصنيف" options={ticketCategories} defaultValue="general" />
        <SelectField name="priority" label="الأولوية" options={priorities} defaultValue="medium" />
        {canAssign ? <SelectField name="assigned_to" label="المسؤول" placeholder="تعيين تلقائي" options={staff} /> : null}
        <TextField name="subject" label="الموضوع" required span="all" maxLength={300} />
        <TextAreaField name="description" label="الوصف" required rows={6} />
      </div>
      <p className="bos-faint" style={{ fontSize: 12 }}><Tx>مواعيد SLA تُحسب تلقائياً من الأولوية. بدون تعيين: مدير المشروع خلال فترة الدعم، وإلا توزيع دوري على فريق الدعم.</Tx></p>
      <div className="bos-form-actions"><SubmitButton label="إنشاء التذكرة" /></div>
    </ActionForm>
  );
}

export function TicketStatusButtons({ id, status }: { id: string; status: string }) {
  return (
    <>
      {(ticketNext[status] ?? []).map((to) =>
        to === "closed" ? (
          <ConfirmButton key={to} label="إغلاق" className="admin-btn small ghost" message="إغلاق التذكرة؟ لن يتمكن العميل من الرد عليها." action={(r) => ticketStatusAction(id, to, r)} />
        ) : (
          <ActionButton key={to} label={ticketStatusLabels[to]} className={`admin-btn small ${to === "resolved" ? "success" : "secondary"}`} action={() => ticketStatusAction(id, to)} />
        ),
      )}
    </>
  );
}

export function AssignSelect({ id, current, staff }: { id: string; current: string | null; staff: Opt[] }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <select aria-label={t("المسؤول")} value={current ?? "none"} disabled={pending} onChange={(e) => start(async () => { await assignTicketAction(id, e.target.value); router.refresh(); })}>
      <Opt value="none">— غير معيّن —</Opt>
      {staff.map((s) => <Opt key={s.value} value={s.value}>{s.label}</Opt>)}
    </select>
  );
}

export function TicketMetaForm({ id, category, priority, projectInit, clientId }: { id: string; category: string; priority: string; projectInit: EntityOption | null; clientId: string }) {
  return (
    <ActionForm action={updateTicketAction.bind(null, id)} successMessage="تم الحفظ">
      <SelectField name="category" label="التصنيف" options={ticketCategories} defaultValue={category} />
      <SelectField name="priority" label="الأولوية" options={priorities} defaultValue={priority} hint="تغيير الأولوية يعيد حساب مواعيد SLA" />
      <div className="bos-field">
        <label><Tx>المشروع</Tx></label>
        <EntitySelector name="project_id" search={(q) => searchEntitiesAction("project", q, clientId ? { client_id: clientId } : {})} initial={projectInit} placeholder="ربط بمشروع" />
      </div>
      <SubmitButton label="حفظ" className="admin-btn small" />
    </ActionForm>
  );
}

export function ReplyForm({ id, disabled }: { id: string; disabled?: boolean }) {
  const [internal, setInternal] = useState(false);
  if (disabled) return <div className="bos-faint" style={{ fontSize: 13 }}><Tx>التذكرة مغلقة.</Tx></div>;
  return (
    <ActionForm action={replyTicketAction.bind(null, id)} resetOnSuccess>
      <div className="bos-row" style={{ gap: 6, marginBottom: 6 }}>
        <button type="button" className={`admin-btn small ${internal ? "ghost" : "secondary"}`} onClick={() => setInternal(false)}><Tx>رد للعميل</Tx></button>
        <button type="button" className={`admin-btn small ${internal ? "secondary" : "ghost"}`} onClick={() => setInternal(true)}><Tx>ملاحظة داخلية</Tx></button>
      </div>
      {internal ? <input type="hidden" name="internal" value="on" /> : null}
      <TextAreaField name="body" label={internal ? "ملاحظة داخلية (لا تظهر للعميل)" : "الرد (يظهر للعميل في البوابة)"} required rows={4} />
      <div className="bos-form-actions"><SubmitButton label={internal ? "إضافة ملاحظة" : "إرسال الرد"} /></div>
    </ActionForm>
  );
}

export function MergeTicketButton({ id, clientId }: { id: string; clientId: string }) {
  return (
    <ModalButton label="دمج" title="دمج هذه التذكرة في تذكرة أخرى" className="admin-btn small ghost">
      {() => (
        <ActionForm action={mergeTicketAction.bind(null, id)}>
          <p className="bos-faint" style={{ fontSize: 13 }}><Tx>ستُنقل المحادثة والمرفقات للتذكرة الهدف وتُغلق هذه التذكرة.</Tx></p>
          <div className="bos-field">
            <label><Tx>التذكرة الهدف (نفس الحساب)</Tx></label>
            <EntitySelector name="target" required search={async (q) => (await searchEntitiesAction("ticket", q, { client_id: clientId })).filter((o) => o.id !== id)} placeholder="رقم أو موضوع التذكرة..." />
          </div>
          <div className="bos-form-actions"><SubmitButton label="دمج" className="admin-btn danger" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}
