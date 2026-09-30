// Authenticated smoke test: signs in as a seeded user through Supabase Auth,
// builds the @supabase/ssr session cookie, and requests BOS pages, failing
// on non-2xx responses or rendered error boundaries.
//
// Usage: node tests/e2e/smoke.mjs [email] [baseUrl]
// Requires the local stack (supabase start), seed data (npm run seed:bos)
// and a running app (npm run dev).
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!/127\.0\.0\.1|localhost/.test(SUPABASE_URL)) {
  console.error("Smoke tests only run against a local Supabase.");
  process.exit(1);
}

const email = process.argv[2] ?? "admin@taysonsta.local";
const base = process.argv[3] ?? "http://localhost:3100";
const pages = (process.env.SMOKE_PAGES ?? "").split(",").filter(Boolean);
// SMOKE_ALLOW_DENIED=1: permission denials (⊘) are expected, not failures.
const allowDenied = process.env.SMOKE_ALLOW_DENIED === "1";

async function session(userEmail) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: userEmail, password: "Taysonsta!2026" }),
  });
  if (!res.ok) throw new Error(`login failed for ${userEmail}: ${res.status} ${await res.text()}`);
  return res.json();
}

function cookieFor(sess) {
  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const value = "base64-" + Buffer.from(JSON.stringify(sess)).toString("base64url");
  const CHUNK = 3180;
  if (value.length <= CHUNK) return `${name}=${value}`;
  const parts = [];
  for (let i = 0; i * CHUNK < value.length; i++) parts.push(`${name}.${i}=${value.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  return parts.join("; ");
}

export async function fetchAs(userEmail, path) {
  const sess = await session(userEmail);
  return fetch(`${base}${path}`, { headers: { cookie: cookieFor(sess) }, redirect: "manual" });
}

const defaultPages = [
  "/admin/dashboard",
  "/admin/sales/leads",
  "/admin/sales/leads/new",
];

const targets = pages.length ? pages : defaultPages;
const sess = await session(email);
const cookie = cookieFor(sess);
let failed = 0;
for (const path of targets) {
  const started = Date.now();
  const res = await fetch(`${base}${path}`, { headers: { cookie }, redirect: "manual" });
  const html = await res.text();
  // Streaming responses keep status 200 even when notFound()/error boundaries
  // render, so the rendered UI is checked as well. (not-found.tsx markup is
  // part of every RSC payload, so its *text* can't be used as a marker.)
  const errorMarkers = [
    "Application error",
    "Unhandled Runtime Error",
    "تعذر تحميل هذا العنصر",
    "تعذر تحميل هذه الصفحة",
    "NEXT_HTTP_ERROR_FALLBACK;404",
    "Internal Server Error",
    // Server errors caught by error.tsx appear in the RSC stream as E{"digest"…}
    ':E{"digest"',
  ];
  // redirect() during streaming keeps status 200 and leaves the target in
  // a NEXT_REDIRECT digest; report it instead of counting it as a render.
  const redirect = html.match(/NEXT_REDIRECT;[a-z]+;([^;"]+);/)?.[1] ?? null;
  const marker = errorMarkers.find((m) => html.includes(m));
  const ok = res.status >= 200 && res.status < 300 && !marker && !redirect;
  const denied = redirect === "/admin/forbidden";
  if (!ok && !(denied && allowDenied)) failed++;
  const symbol = ok ? "✓" : denied ? "⊘" : "✗";
  console.log(`${symbol} ${res.status} ${path} (${Date.now() - started}ms)${marker ? ` — ${marker}` : ""}${redirect ? ` ↪ ${redirect}` : ""}${res.status >= 300 && res.status < 400 ? ` → ${res.headers.get("location")}` : ""}`);
}
process.exit(failed ? 1 : 0);
