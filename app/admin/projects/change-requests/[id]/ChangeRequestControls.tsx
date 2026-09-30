"use client";

import { ActionButton, ConfirmButton } from "@/components/bos/Dialog";
import { ActionForm, MoneyField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { advanceChangeRequestAction, assessChangeRequestAction } from "../../actions";

export function ChangeRequestControls({ id, status, canApply }: { id: string; status: string; canApply: boolean }) {
  return (
    <>
      {status === "requested" ? <ActionButton label="بدء التقييم" className="admin-btn small secondary" action={() => advanceChangeRequestAction(id, "assessment")} /> : null}
      {status === "assessment" ? <ActionButton label="إعداد عرض" className="admin-btn small secondary" action={() => advanceChangeRequestAction(id, "proposal")} /> : null}
      {["assessment", "proposal"].includes(status) ? <ActionButton label="طلب موافقة العميل" className="admin-btn small" action={() => advanceChangeRequestAction(id, "client_approval")} /> : null}
      {status === "approved" && canApply ? (
        <ConfirmButton label="إضافة للمشروع" className="admin-btn small success" message="سيتم تحديث ميزانية المشروع وموعده النهائي ونطاقه، وإنشاء فاتورة مسودة للتكلفة الإضافية." confirmLabel="تأكيد" action={() => advanceChangeRequestAction(id, "added_to_project")} />
      ) : null}
      {["requested", "assessment", "proposal", "client_approval"].includes(status) ? (
        <ConfirmButton label="رفض" className="admin-btn small danger" message="رفض طلب التغيير؟" requireReason action={(reason) => advanceChangeRequestAction(id, "rejected", reason)} />
      ) : null}
    </>
  );
}

export function AssessmentForm({ id, currencies, initial }: { id: string; currencies: string[]; initial: { impact: string | null; additional_cost: string; currency: string; additional_days: string } }) {
  return (
    <ActionForm action={assessChangeRequestAction.bind(null, id)} successMessage="تم حفظ التقييم">
      <div className="bos-form-grid">
        <MoneyField name="additional_cost" currencyName="currency" label="التكلفة الإضافية" currencies={currencies} defaultValue={initial.additional_cost} defaultCurrency={initial.currency} />
        <TextField name="additional_days" label="أيام إضافية" type="number" min={0} defaultValue={initial.additional_days} />
        <TextAreaField name="impact" label="الأثر على المشروع" defaultValue={initial.impact ?? ""} />
      </div>
      <SubmitButton label="حفظ التقييم" className="admin-btn small" />
    </ActionForm>
  );
}
