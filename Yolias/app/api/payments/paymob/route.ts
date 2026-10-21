import { NextResponse, type NextRequest } from "next/server";
import { loadPaymob, rememberPaymobCard, settlePayment } from "@/lib/payments";
import { cardFromToken, hmacMatches, hmacStringFromToken, hmacStringFromTransaction, outcomeFromTransaction } from "@/lib/payments/paymob";

// Paymob callbacks (server to server): "TOKEN" (a saved card, D-254) and
// "transaction processed". The body is
// {type: "TRANSACTION", obj}; the signature is the `hmac` query parameter
// (HMAC-SHA512 over 20 fields of obj). Unsigned or mismatched callbacks are
// rejected and change nothing. Always answers quickly; settlement is idempotent.
export async function POST(request: NextRequest) {
  const paymob = await loadPaymob();
  if (!paymob) return NextResponse.json({ ok: false }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { type?: string; obj?: Record<string, unknown> } | null;
  if (!body?.obj) return NextResponse.json({ ok: true, ignored: true });
  // A card the customer saved (D-254): kept to charge the renewals.
  if (body.type === "TOKEN") {
    if (!hmacMatches(hmacStringFromToken(body.obj), paymob.hmacSecret, request.nextUrl.searchParams.get("hmac"))) {
      return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
    }
    const card = cardFromToken(body.obj);
    if (card) await rememberPaymobCard(card).catch((e) => console.error("[payments] save card", e instanceof Error ? e.message : e));
    return NextResponse.json({ ok: true });
  }
  if (body.type && body.type !== "TRANSACTION") return NextResponse.json({ ok: true, ignored: true });
  if (!hmacMatches(hmacStringFromTransaction(body.obj), paymob.hmacSecret, request.nextUrl.searchParams.get("hmac"))) {
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
  }
  try {
    await settlePayment("paymob", outcomeFromTransaction(body.obj));
  } catch {
    // Fulfilment failed after a verified payment (already reported): an error
    // answer makes the provider send the callback again, which retries it.
    return NextResponse.json({ ok: false, error: "retry" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
