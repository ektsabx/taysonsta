"use client";

import { ActionButton, ConfirmButton } from "@/components/bos/Dialog";
import { setCommissionStatusAction } from "../actions";

export function CommissionRowActions({ id, status, canApprove, canPay }: { id: string; status: string; canApprove: boolean; canPay: boolean }) {
  return (
    <span className="bos-row" style={{ gap: 4, justifyContent: "flex-end" }}>
      {canApprove && status === "eligible" ? <ActionButton label="اعتماد" className="admin-btn small success" action={() => setCommissionStatusAction(id, "approved")} /> : null}
      {canPay && status === "approved" ? (
        <ConfirmButton label="تم الدفع" className="admin-btn small" message="تسجيل دفع العمولة للموظف؟" requireReason reasonLabel="مرجع الدفع" confirmLabel="تأكيد" action={(ref) => setCommissionStatusAction(id, "paid", ref)} />
      ) : null}
      {canApprove && ["pending", "eligible", "approved"].includes(status) ? (
        <ConfirmButton label="إلغاء" className="admin-btn small ghost" message="إلغاء هذه العمولة؟" requireReason action={(reason) => setCommissionStatusAction(id, "cancelled", reason)} />
      ) : null}
    </span>
  );
}
