// Payment numbers for Yolias Admin → Latest payments (owner, 2026-11-05). Pure.

export interface PaymentRow { workspace_id: string; kind: string; plan: string | null; amount: number; status: string; provider: string | null; created_at: string; paid_at: string | null; failure_reason: string | null }

export interface PaymentStats {
  revenue: number; paid: number; customers: number; average: number | null; successRate: number | null;
  failed: number; pending: number; refunded: number; refundedAmount: number; firstTime: number; returning: number;
}

/** A period's numbers. `before` is who had paid before the period, to tell first-time customers from returning ones. */
export function paymentStats(rows: PaymentRow[], before: Set<string>): PaymentStats {
  const ok = rows.filter((r) => r.status === "succeeded");
  const failed = rows.filter((r) => r.status === "failed").length;
  const refunds = rows.filter((r) => r.status === "refunded");
  const revenue = ok.reduce((a, r) => a + Number(r.amount), 0);
  const customers = new Set(ok.map((r) => r.workspace_id));
  const tried = ok.length + failed;
  return {
    revenue, paid: ok.length, customers: customers.size, average: ok.length ? revenue / ok.length : null, successRate: tried ? ok.length / tried : null,
    failed, pending: rows.filter((r) => r.status === "pending").length, refunded: refunds.length, refundedAmount: refunds.reduce((a, r) => a + Number(r.amount), 0),
    firstTime: [...customers].filter((w) => !before.has(w)).length, returning: [...customers].filter((w) => before.has(w)).length,
  };
}

/** Repeat Rate: of everyone who ever paid, the share who paid more than once. */
export function repeatRate(rows: Pick<PaymentRow, "workspace_id" | "status">[]): number | null {
  const n = new Map<string, number>();
  for (const r of rows) if (r.status === "succeeded") n.set(r.workspace_id, (n.get(r.workspace_id) ?? 0) + 1);
  return n.size ? [...n.values()].filter((x) => x > 1).length / n.size : null;
}
