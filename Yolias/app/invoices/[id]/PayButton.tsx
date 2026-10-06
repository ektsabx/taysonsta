"use client";

import { useState, useTransition } from "react";
import { payInvoice } from "@/app/checkout/actions";

export function PayButton({ invoiceId, label, pendingLabel }: { invoiceId: string; label: string; pendingLabel: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="invoice-pay">
      <button className="btn-primary" type="button" disabled={pending} onClick={() => start(async () => {
        setError(null);
        const r = await payInvoice(invoiceId);
        if (r && !r.ok) setError(r.error);
      })}>
        {pending ? pendingLabel : label}
      </button>
      {error && <span className="form-error" role="alert">{error}</span>}
    </span>
  );
}
