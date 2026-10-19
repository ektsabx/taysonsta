import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { settlePayment } from "@/lib/payments";
import { loadKashier, sessionPayment } from "@/lib/payments/kashier";
import { toMinor } from "@/lib/payments/paymob";
import type { PaymentRow } from "@/types/database";

/**
 * Asks Kashier where a checkout's payment stands and settles it (D-235). Used
 * when the customer comes back (redirect) or the embedded page reports
 * success: the browser's word is never proof, Kashier's API is. Idempotent.
 */
export async function confirmKashierPayment(paymentId: string, workspaceId?: string): Promise<PaymentRow | null> {
  const db = createAdminClient();
  let q = db.from("payments").select("*").eq("id", paymentId).eq("provider", "kashier");
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  const { data: p } = await q.maybeSingle();
  if (!p?.provider_ref) return p ?? null;
  if (p.status !== "pending" && !(p.status === "succeeded" && !p.fulfilled_at)) return p;
  const k = await loadKashier();
  if (!k) return p;
  const s = await sessionPayment(k, p.provider_ref).catch(() => null);
  if (!s) return p;
  if (s.merchantOrderId && s.merchantOrderId !== p.id) return p;
  const amount = Number(s.amount);
  const status = s.status === "SUCCESS" || s.status === "CAPTURED" || s.status === "PAID" ? "succeeded" : ["FAILED", "FAILURE", "EXPIRED", "CANCELLED", "REJECTED"].includes(s.status) ? "failed" : "pending";
  if (status === "pending") return p;
  return (await settlePayment("kashier", {
    providerRef: p.provider_ref, merchantRef: p.id, providerTxn: s.transactionId ?? s.orderId ?? "",
    status, amountMinor: Number.isFinite(amount) ? toMinor(amount) : -1, currency: s.currency ?? "", reason: status === "failed" ? s.status : null,
  })) ?? p;
}
