import { NextResponse, type NextRequest } from "next/server";
import { settlePayment } from "@/lib/payments";
import { loadKashier, verifyWebhook } from "@/lib/payments/kashier";
import { toMinor } from "@/lib/payments/paymob";
import type { PaymentOutcome } from "@/lib/payments/types";

// Kashier webhooks (server to server, D-235). Signed with x-kashier-signature
// (lib/payments/kashier.ts); unsigned or mismatched calls change nothing.
// Events: pay (success / failure), refund. Settlement is idempotent, so
// Kashier's retries and replays ("idempotency" / ORDER_PAID_BEFORE) are harmless.
export async function POST(request: NextRequest) {
  const k = await loadKashier();
  if (!k) return NextResponse.json({ ok: false }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { event?: string; data?: Record<string, unknown> } | null;
  const data = body?.data;
  if (!data || typeof data !== "object") return NextResponse.json({ ok: true, ignored: true });
  if (!(await verifyWebhook(k, data, request.headers.get("x-kashier-signature")))) {
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
  }
  const event = String(body?.event ?? "").toLowerCase();
  if (event !== "pay" && event !== "refund" && event !== "partial_refund") return NextResponse.json({ ok: true, ignored: event || "none" });
  const status = String(data.status ?? "").toUpperCase();
  const amount = Number(data.amount);
  const outcome: PaymentOutcome = {
    providerRef: data.kashierOrderId != null ? String(data.kashierOrderId) : null,
    merchantRef: data.merchantOrderId != null ? String(data.merchantOrderId) : null,
    providerTxn: String(data.transactionId ?? ""),
    status: event === "refund" ? (status === "SUCCESS" ? "refunded" : "pending") : status === "SUCCESS" ? "succeeded" : status === "PENDING" ? "pending" : "failed",
    amountMinor: Number.isFinite(amount) ? toMinor(amount) : -1,
    currency: String(data.currency ?? ""),
    reason: status === "SUCCESS" ? null : String(data.transactionResponseMessage ?? data.transactionResponseCode ?? status).slice(0, 200),
  };
  // A partial refund isn't a full refund: recorded by Kashier, the plan stays.
  if (event === "partial_refund") return NextResponse.json({ ok: true, ignored: "partial_refund" });
  try {
    await settlePayment("kashier", outcome);
  } catch {
    // Fulfilment failed after a verified payment: an error makes Kashier retry it.
    return NextResponse.json({ ok: false, error: "retry" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
