"use client";

import { useState } from "react";
import { Tx, useT } from "@/components/bos/I18n";
import { ACCOUNT_ACTIONS, AccountActionDialog } from "./AccountActionDialog";

// Actions for one account (User 360 header), through the same dialog and
// server action as the bulk bar.
export function AccountActions({ id, email, status, smsConnected = false }: { id: string; email: string; status: string; smsConnected?: boolean }) {
  const t = useT();
  const [action, setAction] = useState("");
  const [open, setOpen] = useState(false);
  const fits = (k: string) =>
    status === "deleted" ? false
      : k === "restore" ? status === "suspended" || status === "paused"
      : k === "unban" ? status === "banned"
      : k === "suspend" || k === "pause" || k === "ban" ? status === "active" || (k === "ban" && status !== "banned")
      : true;
  return (
    <div className="bos-row" style={{ gap: 6 }}>
      <select aria-label={t("الإجراء")} value={action} onChange={(e) => setAction(e.target.value)} disabled={status === "deleted"}>
        <option value="">{t("إجراء على الحساب…")}</option>
        {ACCOUNT_ACTIONS.filter((a) => fits(a.key)).map((a) => <option key={a.key} value={a.key} disabled={a.key === "sms" && !smsConnected}>{t(a.label)}</option>)}
      </select>
      <button type="button" className="admin-btn small" disabled={!action} onClick={() => setOpen(true)}><Tx>متابعة</Tx></button>
      <AccountActionDialog open={open} onClose={() => setOpen(false)} action={action} count={1} ids={[id]} all={null} emailOf={new Map([[id, email]])} />
    </div>
  );
}
