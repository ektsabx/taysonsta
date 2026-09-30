"use client";

import { Tx } from "@/components/bos/I18n";

import { ActionButton, ConfirmButton, ModalButton } from "@/components/bos/Dialog";
import { ActionForm, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { refundPaymentAction, setPaymentStatusAction } from "../../actions";

export function PaymentControls({ paymentId, status, refundable, currency }: { paymentId: string; status: string; refundable: number; currency: string }) {
  return (
    <>
      {status === "pending" ? <ActionButton label="قيد المعالجة" className="admin-btn small secondary" action={() => setPaymentStatusAction(paymentId, "processing")} /> : null}
      {["pending", "processing"].includes(status) ? (
        <>
          <ActionButton label="تأكيد الاستلام" className="admin-btn small success" action={() => setPaymentStatusAction(paymentId, "completed")} />
          <ConfirmButton label="فشل الدفع" className="admin-btn small danger" message="تسجيل الدفعة كفاشلة؟" requireReason action={(reason) => setPaymentStatusAction(paymentId, "failed", reason)} />
        </>
      ) : null}
      {["completed", "refunded"].includes(status) && refundable > 0 ? (
        <ModalButton label="استرداد" title="تسجيل استرداد" className="admin-btn small danger">
          {(close) => (
            <ActionForm action={refundPaymentAction.bind(null, paymentId)} onSuccess={close} guardUnsaved={false}>
              <div className="bos-form-grid">
                <TextField name="amount" label={`المبلغ (حتى ${refundable} ${currency})`} required inputMode="decimal" defaultValue={String(refundable)} />
                <TextAreaField name="reason" label="السبب" required />
              </div>
              <p className="bos-hint"><Tx>يعكس الاسترداد أثر الدفعة على الفاتورة والصفقة والعمولة تلقائياً.</Tx></p>
              <div className="bos-form-actions">
                <SubmitButton label="تأكيد الاسترداد" className="admin-btn danger" />
              </div>
            </ActionForm>
          )}
        </ModalButton>
      ) : null}
    </>
  );
}
