import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isScanner } from "@/lib/email-links";

// A link from a campaign email (owner, 2026-11-05): count the click, then on to
// the page. An unknown code lands on the site: a link never errors for a person.
const CODE = /^[A-Za-z0-9_-]{6,16}$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const home = new URL("/", req.nextUrl.origin);
  if (!CODE.test(code)) return NextResponse.redirect(home, 302);
  const db = createAdminClient();
  let url: string | null = null;
  if (isScanner(req.headers.get("user-agent"))) {
    url = (await db.from("email_links").select("url").eq("code", code).maybeSingle()).data?.url ?? null;
  } else {
    const { data, error } = await db.rpc("email_link_click", { p_code: code });
    if (error) console.error("[links] click", error.message);
    url = (data as string | null) ?? null;
  }
  const target = (() => { try { return url ? new URL(url) : null; } catch { return null; } })();
  const res = NextResponse.redirect(target && /^https?:$/.test(target.protocol) ? target : home, 302);
  res.headers.set("x-robots-tag", "noindex");
  res.headers.set("cache-control", "no-store");
  // Yolias's own campaigns: signup and checkout on this site credit the campaign, as the pixel's click does.
  const yc = target?.searchParams.get("yc");
  if (yc && target?.origin === req.nextUrl.origin) res.cookies.set("_yolias_yc", JSON.stringify({ id: yc, t: Date.now() }), { path: "/", maxAge: 90 * 86_400, sameSite: "lax", secure: req.nextUrl.protocol === "https:" });
  return res;
}
