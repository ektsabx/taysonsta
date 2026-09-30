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
