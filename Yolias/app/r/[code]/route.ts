import { NextResponse, type NextRequest } from "next/server";
import { affiliateByCode, currentProgram, recordVisit, visitAffiliate } from "@/lib/affiliates";
import { AFFILIATE_COOKIE } from "@/lib/affiliates/program";

// Referral link: www.yolias.com/r/<code>[?c=<campaign>&to=/pricing]. Records
// the visit and keeps it in a first-party cookie for the attribution window,
// then sends the visitor on. Attribution happens at signup, on the server
// (lib/affiliates attributeSignup). An unknown or inactive code just lands on
// the site: a link never errors for the visitor.
//  - first touch: an earlier, still valid referral cookie is kept;
//  - last touch: the newest link replaces it.
// No cookie (blocked, private window, other device) means no attribution;
// cross-device tracking isn't supported.

const SAFE_TO = new Set(["/", "/pricing", "/product", "/solutions", "/help-center", "/blog", "/signup"]);

function destination(req: NextRequest): string {
  const to = req.nextUrl.searchParams.get("to") ?? "/";
  if (SAFE_TO.has(to) || /^\/(solutions|blog|help-center|use-cases)\/[a-z0-9-]{1,80}$/.test(to)) return to;
  return "/";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const to = destination(req);
  const res = NextResponse.redirect(new URL(to, req.nextUrl.origin), 302);
  res.headers.set("x-robots-tag", "noindex");
  res.headers.set("cache-control", "no-store");
  const [affiliate, program] = await Promise.all([affiliateByCode(code.toLowerCase()), currentProgram()]);
  if (!affiliate || affiliate.status !== "approved" || !program?.settings.enabled) return res;

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const visitId = await recordVisit(affiliate.id, { ip, path: to, campaign: req.nextUrl.searchParams.get("c"), referrer: req.headers.get("referer") });
  if (!visitId) return res;

  const days = program.settings.attribution.days;
  const existing = req.cookies.get(AFFILIATE_COOKIE)?.value;
  if (existing && existing !== visitId && program.settings.attribution.model === "first_touch") {
    const prev = await visitAffiliate(existing);
    if (prev && Date.parse(prev.at) > Date.now() - days * 86_400_000) return res;
  }
  res.cookies.set(AFFILIATE_COOKIE, visitId, {
    httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/", maxAge: days * 86_400,
  });
  return res;
}
