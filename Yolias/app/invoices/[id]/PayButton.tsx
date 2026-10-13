"use client";

import { useState, useTransition } from "react";
import { payInvoice } from "@/app/checkout/actions";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { useI18n } from "@/lib/i18n/client";

export function PayButton({ invoiceId, label, pendingLabel }: { invoiceId: string; label: string; pendingLabel: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="invoice-pay">
      <button className="btn-primary" type="button" disabled={pending} onClick={() => start(async () => {
        setError(null);
        const r = await callAction(() => payInvoice(invoiceId));
        if (isNetworkFailure(r)) setError(t.checkout.errors.network);
        else if (r && !r.ok) setError(r.error);
      })}>
        <span>{pending ? pendingLabel : label}</span>
      </button>
      {error && <span className="form-error" role="alert">{error}</span>}
    </span>
  );
}
