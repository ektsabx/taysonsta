import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, locales } from "@/lib/i18n";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin: pass the path to server components (page-level restrictions,
  // docs/bos/30 §6) as a request header — never trusted from the client.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const headers = new Headers(request.headers);
    headers.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers } });
  }

  // yol.yolias.com serves Yolias Admin only (D-135): the old public website
  // pages don't exist there, and "/" goes to the Admin sign-in.
  if (process.env.ADMIN_NOINDEX === "true") {
    if (pathname === "/") return NextResponse.redirect(new URL("/admin", request.url));
    return new NextResponse("Not found", { status: 404, headers: { "content-type": "text/plain", "x-robots-tag": "noindex, nofollow" } });
  }

  const pathnameHasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (pathnameHasLocale) {
    const response = NextResponse.next();
    response.headers.set("x-pathname", pathname);
    return response;
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  const response = NextResponse.rewrite(url);
  response.headers.set("x-pathname", url.pathname);
  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/((?!_next|api|admin|portal|proposal|proposal-preview|favicon.ico|assets|videos|robots.txt|sitemap.xml).*)",
  ],
};
