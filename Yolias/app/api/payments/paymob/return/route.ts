import { NextResponse, type NextRequest } from "next/server";
import { loadPaymob, settlePayment } from "@/lib/payments";
import { hmacMatches, hmacStringFromQuery, outcomeFromQuery } from "@/lib/payments/paymob";
import { checkoutStep } from "@/lib/funnel";

// Paymob sends the customer back here (GET, signed query). A valid signature
// settles the payment too, so a missed webhook can't leave it pending; the
// webhook remains the source of truth. Then → the result page.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const paymob = await loadPaymob();
  let paymentId: string | null = null;
  if (paymob && hmacMatches(hmacStringFromQuery(q), paymob.hmacSecret, q.get("hmac"))) {
    const outcome = outcomeFromQuery(q);
    // A failed fulfilment (already reported) still shows the payment's status.
    const settled = await settlePayment("paymob", outcome).catch(() => null);
    paymentId = settled?.id ?? (outcome.merchantRef && /^[0-9a-f-]{36}$/i.test(outcome.merchantRef) ? outcome.merchantRef : null);
    // Journey (D-212): the member came back from Paymob. The signed result is
    // recorded as what Paymob reported; the payment row stays the truth.
    if (settled?.checkout_id) {
      await checkoutStep(settled.checkout_id, "returned", { result: outcome.status, paymentId: settled.id, provider: "paymob", signed: true, key: `gateway_returned:${settled.id}:${outcome.providerTxn || "x"}` });
    }
  }
  const url = new URL("/billing/result", request.nextUrl.origin);
  if (paymentId) url.searchParams.set("payment", paymentId);
  return NextResponse.redirect(url);
}
