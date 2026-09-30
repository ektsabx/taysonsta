"use client";

import { Tx, Opt, useT } from "@/components/bos/I18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeLeadStageAction, bulkAssignLeadsAction, convertLeadAction, archiveLeadAction } from "../actions";
import { searchEntitiesAction } from "@/app/admin/_actions/common";
import { Modal, ConfirmButton } from "@/components/bos/Dialog";
import { ActionForm, Field, MoneyField, SelectField, SubmitButton, TextField } from "@/components/bos/Form";
import { EntitySelector, type EntityOption } from "@/components/bos/EntitySelector";

interface Stage {
  id: string;
  name: string;
  category: string;
}

export function LeadStageControl({ leadId, currentStageId, stages, disabled }: { leadId: string; currentStageId: string; stages: Stage[]; disabled?: boolean }) {
  const t = useT();
  const [value, setValue] = useState(currentStageId);
  const [lostOpen, setLostOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function apply(stageId: string, lostReason?: string) {
    startTransition(async () => {
      const r = await changeLeadStageAction(leadId, stageId, lostReason);
      if (!r.ok) {
        setError(r.error);
        setValue(currentStageId);
      } else {
        setError(null);
        setLostOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="bos-stack" style={{ gap: 4 }}>
      <select
        aria-label={t("المرحلة")}
        value={value}
        disabled={disabled || pending}
        onChange={(e) => {
          const stage = stages.find((s) => s.id === e.target.value);
          setValue(e.target.value);
          if (stage?.category === "lost") setLostOpen(true);
          else apply(e.target.value);
        }}
        style={{ height: 34, background: "var(--bos-input)", color: "var(--bos-strong)", border: "1px solid rgba(var(--bos-fg-rgb), 0.14)", borderRadius: 7, padding: "0 8px" }}
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {error ? <span className="bos-field-error"><Tx>{error}</Tx></span> : null}
      <Modal
        open={lostOpen}
        onClose={() => {
          setLostOpen(false);
          setValue(currentStageId);
        }}
        title="تسجيل خسارة العميل المحتمل"
        footer={
          <button type="button" className="admin-btn danger" disabled={!reason.trim() || pending} onClick={() => apply(value, reason)}>
            <Tx>تأكيد الخسارة</Tx>
          </button>
        }
      >
        <div className="bos-field">
          <label htmlFor="lost-reason">
            <Tx>سبب الخسارة</Tx><span className="req">*</span>
          </label>
          <textarea id="lost-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: الميزانية غير متوفرة، اختار منافساً..." />
        </div>
      </Modal>
    </div>
  );
}

export function LeadAssignControl({ leadId, current, staff }: { leadId: string; current: string | null; staff: { value: string; label: string }[] }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="bos-stack" style={{ gap: 4 }}>
      <select
        aria-label={t("المسؤول")}
        defaultValue={current ?? "none"}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            const r = await bulkAssignLeadsAction([leadId], e.target.value);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
        style={{ height: 34, background: "var(--bos-input)", color: "var(--bos-strong)", border: "1px solid rgba(var(--bos-fg-rgb), 0.14)", borderRadius: 7, padding: "0 8px" }}
      >
        <Opt value="none">غير معيّن</Opt>
        {staff.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {error ? <span className="bos-field-error"><Tx>{error}</Tx></span> : null}
    </div>
  );
}

export function ConvertLeadButton({
  leadId,
  defaults,
  currencies,
  products,
  initialClient,
}: {
  leadId: string;
  defaults: { dealName: string; value: string; currency: string; newClientName: string; newClientEmail: string };
  currencies: string[];
  products: { value: string; label: string }[];
  initialClient: EntityOption | null;
}) {
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState<EntityOption | null>(initialClient);
  const router = useRouter();
  const action = convertLeadAction.bind(null, leadId);

  return (
    <>
      <button type="button" className="admin-btn small" onClick={() => setOpen(true)}>
        <Tx>تحويل إلى صفقة</Tx>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="تحويل العميل المحتمل إلى صفقة" wide>
        <ActionForm
          action={action}
          guardUnsaved={false}
          onSuccess={(state) => {
            const dealId = (state as { data?: { dealId?: string } }).data?.dealId;
            if (dealId) router.push(`/admin/sales/deals/${dealId}`);
          }}
        >
          <p className="bos-muted" style={{ fontSize: 13 }}>
            <Tx>اختر الحساب الموجود إن وُجد — لا تنشئ حساباً مكرراً لعميل موجود. إذا لم يوجد، سيُنشأ حساب جديد تلقائياً (مع التحقق من البريد).</Tx>
          </p>
          <div className="bos-form-grid">
            <Field label="الحساب (عميل موجود)" name="clientId" span={2}>
              <EntitySelector name="clientId" search={(q) => searchEntitiesAction("client", q)} initial={initialClient} onChange={setClient} placeholder="ابحث بالاسم أو الشركة أو البريد..." />
            </Field>
            {!client ? (
              <>
                <TextField name="newClientName" label="اسم الحساب الجديد" defaultValue={defaults.newClientName} />
                <TextField name="newClientEmail" label="بريد الحساب الجديد" type="email" defaultValue={defaults.newClientEmail} />
              </>
            ) : (
              <Field label="جهة الاتصال" name="contactId" span={2}>
                <EntitySelector name="contactId" search={(q) => searchEntitiesAction("contact", q, { client_id: client.id })} placeholder="اختر جهة اتصال من الحساب (اختياري)" />
              </Field>
            )}
            <TextField name="dealName" label="اسم الصفقة" required defaultValue={defaults.dealName} span={2} />
            <MoneyField name="value" currencyName="currency" label="قيمة الصفقة" required currencies={currencies} defaultValue={defaults.value} defaultCurrency={defaults.currency} />
            <TextField name="expectedCloseDate" label="تاريخ الإغلاق المتوقع" type="date" />
            <SelectField name="productId" label="المنتج/الخدمة" options={products} placeholder="—" />
          </div>
          <div className="bos-form-actions">
            <SubmitButton label="إنشاء الصفقة" />
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}

export function ArchiveLeadButton({ leadId, archived }: { leadId: string; archived: boolean }) {
  return archived ? (
    <ConfirmButton label="استعادة" className="admin-btn small secondary" message="استعادة هذا العميل المحتمل من الأرشيف؟" confirmLabel="استعادة" action={() => archiveLeadAction(leadId, false)} />
  ) : (
    <ConfirmButton label="أرشفة" className="admin-btn small danger" message="سيتم إخفاء العميل المحتمل من القوائم مع الاحتفاظ بكل سجلاته. يمكن استعادته لاحقاً." confirmLabel="أرشفة" action={() => archiveLeadAction(leadId, true)} />
  );
}
