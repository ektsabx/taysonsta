import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Refreshes the Supabase session cookie on every request and keeps signed-out
// visitors on the auth pages. Onboarding and workspace checks happen in the
// (app) layout, which has database access.
// Pages that need a signed-in user. Everything else is public (website,
// auth, legal, resources) and unknown paths fall through to the 404 page.
const appPaths = ["/analytics", "/campaigns", "/prospects", "/strategies", "/checkout", "/onboarding", "/invoices"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;
  const isApp = appPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!signedIn && pathname === "/") {
    // Visitors see the public home page at "/"; signed-in users get Yolias AI.
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.rewrite(url, { request });
  }
  if (!signedIn && pathname === "/checkout") {
    // Picked a plan while signed out: create the account first, keep the plan.
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    return NextResponse.redirect(url);
  }
  if (!signedIn && isApp) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (signedIn && (pathname === "/login" || pathname === "/signup" || pathname === "/recover")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
