import { NextResponse, type NextRequest } from "next/server";
import { loadPaymob, settlePayment } from "@/lib/payments";
import { hmacMatches, hmacStringFromTransaction, outcomeFromTransaction } from "@/lib/payments/paymob";

// Paymob "transaction processed" callback (server to server). The body is
// {type: "TRANSACTION", obj}; the signature is the `hmac` query parameter
// (HMAC-SHA512 over 20 fields of obj). Unsigned or mismatched callbacks are
// rejected and change nothing. Always answers quickly; settlement is idempotent.
export async function POST(request: NextRequest) {
  const paymob = await loadPaymob();
  if (!paymob) return NextResponse.json({ ok: false }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { type?: string; obj?: Record<string, unknown> } | null;
  if (!body?.obj || (body.type && body.type !== "TRANSACTION")) return NextResponse.json({ ok: true, ignored: true });
  if (!hmacMatches(hmacStringFromTransaction(body.obj), paymob.hmacSecret, request.nextUrl.searchParams.get("hmac"))) {
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
  }
  await settlePayment("paymob", outcomeFromTransaction(body.obj));
  return NextResponse.json({ ok: true });
}
