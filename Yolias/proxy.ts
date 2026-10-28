import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { encodeFirstTouch, firstTouch, FIRST_TOUCH_COOKIE, FIRST_TOUCH_MAX_AGE, isLandingPath } from "@/lib/attribution";
import { isLocalizedPath, localizedHref, LOCALE_HEADER, splitLocale } from "@/lib/i18n/paths";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { localeForCountry, normalizeCountry } from "@/lib/geo";

// Refreshes the Supabase session cookie on every request and keeps signed-out
// visitors on the auth pages. Onboarding and workspace checks happen in the
// (app) layout, which has database access.
// Pages that need a signed-in user. Everything else is public (website,
// auth, legal, resources) and unknown paths fall through to the 404 page.
const appPaths = ["/analytics", "/prospects", "/search", "/checkout", "/onboarding", "/invoices", "/billing", "/outreach", "/inbox", "/crm", "/ai"];

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

// Redirects for merged or moved pages (Admin → SEO → Indexing, D-257), read
// with the anon key and kept for five minutes per server process.
let redirectMemo: { at: number; map: Map<string, { to: string; code: number }> } | null = null;
async function seoRedirect(path: string): Promise<{ to: string; code: number } | null> {
  if (!redirectMemo || Date.now() - redirectMemo.at > 300_000) {
    const map = new Map<string, { to: string; code: number }>();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/seo_redirects?select=from_path,to_path,status_code&active=eq.true`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        signal: AbortSignal.timeout(2_000),
      });
      if (res.ok) for (const r of (await res.json()) as { from_path: string; to_path: string; status_code: number }[]) map.set(r.from_path, { to: r.to_path, code: r.status_code });
      else if (redirectMemo) return redirectMemo.map.get(path) ?? null;
    } catch {
      // Unreachable: keep the last list (or none); a redirect is never worth a failed page.
      if (redirectMemo) return redirectMemo.map.get(path) ?? null;
    }
    redirectMemo = { at: Date.now(), map };
  }
  return redirectMemo.map.get(path.length > 1 ? path.replace(/\/$/, "") : path) ?? null;
}

// The first public page of a visit, for sign-up attribution (lib/attribution.ts).
// Every visitor (owner, 2026-10-28): a first-party cookie with the landing path,
// the referring host and UTM tags only, no identifier and no advertising use,
// so a paying customer can be traced to the page that brought them.
function keepFirstTouch(request: NextRequest, response: NextResponse) {
  if (request.method !== "GET" || request.cookies.has(FIRST_TOUCH_COOKIE)) return;
  if (request.headers.has("rsc") || request.headers.has("next-router-prefetch") || !(request.headers.get("accept") ?? "").includes("text/html")) return;
  if (!isLandingPath(request.nextUrl.pathname)) return;
  response.cookies.set(FIRST_TOUCH_COOKIE, encodeFirstTouch(firstTouch(request.nextUrl, request.headers.get("referer"))), {
    path: "/", maxAge: FIRST_TOUCH_MAX_AGE, sameSite: "lax", secure: request.nextUrl.protocol === "https:",
  });
}

export async function proxy(request: NextRequest) {
  // Language URLs (D-258): /ar/… is the Arabic version of a website page.
  const { locale: urlLocale, path } = splitLocale(request.nextUrl.pathname);
  if (urlLocale && !isLocalizedPath(path)) {
    // The app, sign-in and APIs have one URL: /ar/login → /login.
    const url = request.nextUrl.clone();
    url.pathname = path;
    return NextResponse.redirect(url, 308);
  }
  if (request.method === "GET" && isLandingPath(path) && path !== "/") {
    const r = await seoRedirect(path);
    if (r) {
      const url = request.nextUrl.clone();
      const [to, query] = localizedHref(r.to, urlLocale ?? "en").split("?");
      url.pathname = to;
      if (query) url.search = `?${query}`;
      return NextResponse.redirect(url, r.code);
    }
  }
  const response = await route(request, path, urlLocale);
  keepFirstTouch(request, response);
  return response;
}

const CRAWLER = /bot\b|crawler|spider|slurp|googlebot|bingbot|duckduckbot|yandex|baiduspider|applebot|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|perplexitybot|ccbot|facebookexternalhit|linkedinbot|twitterbot|whatsapp|telegrambot/i;

/** Arabic visitors on an English website URL: chose Arabic, or (no choice yet) browsing from an Arabic-speaking country. */
function prefersArabic(request: NextRequest): boolean {
  // Search engines and AI crawlers always get the URL they asked for (hreflang links
  // the other language): a crawler in an Arabic-speaking country must still index English pages.
  if (CRAWLER.test(request.headers.get("user-agent") ?? "")) return false;
  const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
  if (chosen) return chosen === "ar";
  return localeForCountry(normalizeCountry(request.headers.get("cf-ipcountry"))) === "ar";
}

async function route(request: NextRequest, pathname: string, urlLocale: "ar" | null): Promise<NextResponse> {
  // Website pages are served in the language of their URL; the app follows
  // the cookie. lang is set once we know whether "/" is the website or the app.
  let lang: "ar" | "en" | null = null;
  let rewriteTo: URL | null = null;
  if (urlLocale) {
    rewriteTo = request.nextUrl.clone();
    rewriteTo.pathname = pathname;
  }
  const forward = () => {
    const headers = new Headers(request.headers);
    if (lang) headers.set(LOCALE_HEADER, lang);
    return { request: { headers } };
  };
  const pass = () => (rewriteTo ? NextResponse.rewrite(rewriteTo, forward()) : NextResponse.next(forward()));
  // One address for the site: yolias.com → www.yolias.com (D-135).
  if ((request.headers.get("host") ?? "").toLowerCase() === "yolias.com") {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = "www.yolias.com";
    url.port = "";
    return NextResponse.redirect(url, 301);
  }
  const misrouted = misroutedAdmin(request);
  if (misrouted) return misrouted;
  let response = pass();

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
          response = pass();
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const website = isLocalizedPath(pathname) && !(pathname === "/" && signedIn);
  if (website) {
    lang = urlLocale ?? "en";
    // The response was built before the language was known: build it again with
    // the language header (an English URL is English for everyone, crawlers
    // included), keeping any session cookies the auth refresh set.
    const set = response.cookies.getAll();
    response = pass();
    for (const c of set) response.cookies.set(c);
  }
  if (urlLocale === "ar" && pathname === "/" && signedIn) {
    // Signed in, "/" is Yolias AI (one URL).
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  // Someone reading in Arabic who follows an English website link gets the Arabic page.
  const pageLoad = request.method === "GET" && !request.headers.has("next-action");
  if (website && !urlLocale && pageLoad && prefersArabic(request)) {
    const url = request.nextUrl.clone();
    url.pathname = localizedHref(pathname, "ar");
    return NextResponse.redirect(url, 307);
  }
  // /partners/terms is a public website page (owner brief 2026-10-19), built
  // in the marketing layout under /affiliates/terms.
  if (pathname === "/partners/terms") {
    const url = request.nextUrl.clone();
    url.pathname = "/affiliates/terms";
    return withLocaleCookie(NextResponse.rewrite(url, forward()), request, urlLocale);
  }
  // Server actions check access themselves and must get an action response,
  // never a redirect (a redirected action fails with "unexpected response").
  if (request.headers.has("next-action")) {
    if (!signedIn && pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/home";
      return NextResponse.rewrite(url, forward());
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
    return withLocaleCookie(NextResponse.rewrite(url, forward()), request, urlLocale);
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
  return withLocaleCookie(response, request, urlLocale);
}

// Opening an Arabic website URL is choosing Arabic: sign-up and the app follow it.
function withLocaleCookie(response: NextResponse, request: NextRequest, urlLocale: "ar" | null): NextResponse {
  if (urlLocale && request.cookies.get(LOCALE_COOKIE)?.value !== urlLocale && request.method === "GET") {
    response.cookies.set(LOCALE_COOKIE, urlLocale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
