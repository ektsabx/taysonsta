import { NextResponse, type NextRequest } from "next/server";
import { checkoutStep } from "@/lib/funnel";
import { confirmKashierPayment } from "@/lib/payments/kashier-confirm";

// Where Kashier sends the customer after paying (merchantRedirect). The query
// string is never trusted: the payment is confirmed with Kashier's API, then
// the result page shows it.
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("payment") ?? "";
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(`${site}/checkout?error=payment`);
  const p = await confirmKashierPayment(id).catch(() => null);
  // Confirmed with Kashier's API above, so the return counts as signed.
  if (p?.checkout_id && p.status !== "pending") await checkoutStep(p.checkout_id, "returned", { result: p.status, paymentId: p.id, provider: "kashier", signed: true, key: `gateway_returned:${p.id}` }).catch(() => {});
  // The page is inside the checkout's frame: break out to the top window.
  const target = `${site}/billing/result?payment=${id}${p?.status === "failed" ? "&failed=1" : ""}`;
  return new NextResponse(`<!doctype html><meta charset="utf-8"><script>window.top.location.href=${JSON.stringify(target)}</script><a href="${target}">Continue</a>`, { headers: { "content-type": "text/html; charset=utf-8" } });
}
