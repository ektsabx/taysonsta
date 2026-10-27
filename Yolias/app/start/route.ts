import { NextResponse, type NextRequest } from "next/server";
import { seoPage } from "@/lib/content/seo-store";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_COOKIE } from "@/lib/content/seo-pages";

// "Open this template in Yolias" (D-257): remembers which published template
// the visitor picked, then goes to Yolias AI (signed in) or sign-up. Yolias AI
// opens with the template's request in the composer; nothing runs until the
// member sends it.
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("template") ?? "";
  const page = /^[a-z0-9][a-z0-9-]{0,79}$/.test(slug) ? await seoPage("template", slug) : null;
  const { data } = await (await createClient()).auth.getClaims();
  const url = request.nextUrl.clone();
  url.pathname = data?.claims?.sub ? "/" : "/signup";
  url.search = "";
  const res = NextResponse.redirect(url);
  if (page) res.cookies.set(TEMPLATE_COOKIE, slug, { path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax", httpOnly: true, secure: url.protocol === "https:" });
  return res;
}
