import { NextResponse, type NextRequest } from "next/server";
import { canManageTeam, getSession } from "@/lib/session";
import { loadPolar, polarPortalUrl } from "@/lib/payments/polar";
import { createPolarCheckout } from "@/lib/payments/polar-checkout";

// Polar checkout as a plain link (D-185): GET /checkout/polar?products=<id>
// sends the browser to Polar's hosted checkout. /checkout opens the same
// session embedded in the page instead; this route is the fallback (no
// JavaScript, or a direct link). No custom success page: Polar shows its own,
// and its "back" link returns to /checkout.

function site() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/$/, "");
}

export async function GET(request: NextRequest) {
  const back = (error?: string) => NextResponse.redirect(new URL(`/checkout${error ? `?error=${error}` : ""}`, site()), 303);
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", site()), 303);
  if (!canManageTeam(session)) return back("admins");

  const products = request.nextUrl.searchParams.getAll("products");
  const polar = await loadPolar();
  if (!polar) return back("not_connected");
  if (products.length !== 1) return back("plan");
  // Already subscribed on Polar: plan changes, cards and cancellation are in Polar's portal.
  if (session.workspace.polar_subscription_id) return NextResponse.redirect(polarPortalUrl(polar.environment), 303);

  const r = await createPolarCheckout(polar, session.workspace, { userId: session.userId, email: session.email, name: session.profile.full_name }, products[0]);
  return r.ok ? NextResponse.redirect(r.url, 303) : back(r.error === "plan" ? "plan" : "payment");
}
