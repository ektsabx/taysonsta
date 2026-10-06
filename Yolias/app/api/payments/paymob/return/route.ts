import { NextResponse, type NextRequest } from "next/server";
import { loadPaymob, settlePayment } from "@/lib/payments";
import { hmacMatches, hmacStringFromQuery, outcomeFromQuery } from "@/lib/payments/paymob";

// Paymob sends the customer back here (GET, signed query). A valid signature
// settles the payment too, so a missed webhook can't leave it pending; the
// webhook remains the source of truth. Then → the result page.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const paymob = await loadPaymob();
  let paymentId: string | null = null;
  if (paymob && hmacMatches(hmacStringFromQuery(q), paymob.hmacSecret, q.get("hmac"))) {
    paymentId = (await settlePayment("paymob", outcomeFromQuery(q)))?.id ?? null;
  }
  const url = new URL("/billing/result", request.nextUrl.origin);
  if (paymentId) url.searchParams.set("payment", paymentId);
  return NextResponse.redirect(url);
}
