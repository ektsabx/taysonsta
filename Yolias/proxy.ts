import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Refreshes the Supabase session cookie on every request and keeps signed-out
// visitors on the auth pages. Onboarding and workspace checks happen in the
// (app) layout, which has database access.
// Pages that need a signed-in user. Everything else is public (website,
// auth, legal, resources) and unknown paths fall through to the 404 page.
const appPaths = ["/analytics", "/campaigns", "/prospects", "/search", "/checkout", "/onboarding", "/invoices"];

// admin.* belongs to Yolias Admin. If such a request reaches Yolias, the
// local front door (scripts/dev-proxy.mjs) isn't the one serving :3200 —
// say so instead of quietly showing the customer app (docs/02 "Local development").
function misroutedAdmin(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").toLowerCase();
  if (!host.startsWith("admin.")) return null;
  const html = `<!doctype html><meta charset="utf-8"><title>Yolias Admin isn't running</title>
<body style="font-family:system-ui;max-width:640px;margin:60px auto;padding:0 16px;line-height:1.6;color:#141413">
<h1 style="font-size:22px">Yolias Admin isn't running on this port</h1>
<p>This address belongs to <b>Yolias Admin</b>, but the request reached the Yolias customer app.
Port 3200 is being served by Yolias alone instead of the local front door.</p>
<p>Stop the running dev servers, then from the <b>repository root</b> run:</p>
<pre style="background:#f4f4f1;padding:12px;border-radius:8px">npm run local</pre>
<p>Yolias → <a href="http://localhost:3200">http://localhost:3200</a><br>Yolias Admin → http://admin.localhost:3200</p></body>`;
  return new NextResponse(html, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "x-yolias-app": "yolias" } });
}

export async function proxy(request: NextRequest) {
  const misrouted = misroutedAdmin(request);
  if (misrouted) return misrouted;
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
  // Server actions check access themselves and must get an action response,
  // never a redirect (a redirected action fails with "unexpected response").
  if (request.headers.has("next-action")) {
    if (!signedIn && pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/home";
      return NextResponse.rewrite(url, { request });
    }
    return response;
  }
  const isApp = appPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Accounts with two-factor authentication finish the code step first.
  if (signedIn && (isApp || pathname === "/")) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const url = request.nextUrl.clone();
      url.pathname = "/two-factor";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  if (!signedIn && pathname === "/two-factor") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

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
