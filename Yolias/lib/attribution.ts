import type { AttributionChannel } from "@/types/database";

// Where a sign-up came from (D-257). The site's front door (proxy.ts) keeps
// the first public page of a visit in the yolias_ft cookie: the path, the
// referring site's host (never the full URL) and the UTM tags, with no
// identifier. It is set for every visitor (owner, 2026-10-28): it is first
// party, holds no identifier and is never used for advertising, so it is
// listed as a necessary cookie in the cookie policy. When the account is
// created, /auth/confirm classifies it into a channel and stores it in
// signup_attribution; payments then tie each page to paying customers.

export const FIRST_TOUCH_COOKIE = "yolias_ft";
export const FIRST_TOUCH_MAX_AGE = 60 * 60 * 24 * 30;

export interface FirstTouch {
  /** The landing path, without its query string. */
  l: string;
  /** The referring host, or "" when there was none. */
  r: string;
  us?: string;
  um?: string;
  uc?: string;
  /** Paid click id present (gclid, msclkid, fbclid…): which kind only. */
  ck?: "google" | "microsoft" | "meta";
  /** Unix seconds. */
  t: number;
}

const tag = (v: string | null) => (v ? v.toLowerCase().replace(/[^a-z0-9._\-+ ]/g, "").slice(0, 60) || undefined : undefined);

/** The first touch of a visit from its request URL and Referer header. */
export function firstTouch(url: URL, referer: string | null, now = Date.now()): FirstTouch {
  let r = "";
  try {
    if (referer) r = new URL(referer).hostname.toLowerCase().slice(0, 120);
  } catch { /* not a URL */ }
  const q = url.searchParams;
  const ck = q.has("gclid") || q.has("gbraid") || q.has("wbraid") ? "google" : q.has("msclkid") ? "microsoft" : q.has("fbclid") ? "meta" : undefined;
  return { l: url.pathname.slice(0, 200), r, us: tag(q.get("utm_source")), um: tag(q.get("utm_medium")), uc: tag(q.get("utm_campaign")), ck, t: Math.floor(now / 1000) };
}

// base64url without Buffer: the same code runs in the browser and on the server.
function toB64url(text: string): string {
  let bin = "";
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(v: string): string {
  const bin = atob(v.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

export function encodeFirstTouch(ft: FirstTouch): string {
  return toB64url(JSON.stringify(ft));
}

export function decodeFirstTouch(v: string | undefined | null): FirstTouch | null {
  if (!v || v.length > 1200) return null;
  try {
    const o = JSON.parse(fromB64url(v)) as Partial<FirstTouch>;
    if (typeof o.l !== "string" || !o.l.startsWith("/") || typeof o.r !== "string" || typeof o.t !== "number") return null;
    const s = (x: unknown) => (typeof x === "string" ? tag(x) : undefined);
    return { l: o.l.slice(0, 200), r: o.r.toLowerCase().slice(0, 120), us: s(o.us), um: s(o.um), uc: s(o.uc), ck: o.ck === "google" || o.ck === "microsoft" || o.ck === "meta" ? o.ck : undefined, t: o.t };
  } catch {
    return null;
  }
}

const engines: [RegExp, string][] = [
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)search\.yahoo\.[a-z.]+$|(^|\.)yahoo\.com$/, "yahoo"],
  [/(^|\.)yandex\.[a-z.]+$/, "yandex"],
  [/(^|\.)baidu\.com$/, "baidu"],
  [/(^|\.)ecosia\.org$/, "ecosia"],
  [/^search\.brave\.com$/, "brave"],
  [/(^|\.)naver\.com$/, "naver"],
];
const assistants: [RegExp, string][] = [
  [/(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/, "chatgpt"],
  [/(^|\.)perplexity\.ai$/, "perplexity"],
  [/(^|\.)claude\.ai$/, "claude"],
  [/^gemini\.google\.com$/, "gemini"],
  [/^copilot\.microsoft\.com$/, "copilot"],
];
const social = /(^|\.)(facebook\.com|fb\.com|instagram\.com|linkedin\.com|lnkd\.in|x\.com|t\.co|twitter\.com|youtube\.com|youtu\.be|reddit\.com|tiktok\.com|whatsapp\.com|wa\.me|threads\.net|pinterest\.[a-z.]+|telegram\.org|t\.me)$/;
const webmail = /^(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|outlook\.office365\.com|mail\.yahoo\.com)$/;

/** The channel of a first touch. `selfHosts` are Yolias's own hosts (an internal referrer is direct). */
export function classify(ft: FirstTouch | null, selfHosts: string[]): { channel: AttributionChannel; engine: string | null } {
  if (!ft) return { channel: "unknown", engine: null };
  const medium = ft.um ?? "";
  const source = ft.us ?? "";
  const r = selfHosts.includes(ft.r) ? "" : ft.r;
  const engine = engines.find(([re]) => re.test(r))?.[1] ?? null;
  // An AI assistant answered first (gemini.google.com would otherwise match Google).
  const assistant = assistants.find(([re]) => re.test(r))?.[1] ?? null;
  if (ft.l === "/r" || ft.l.startsWith("/r/") || medium === "affiliate") return { channel: "affiliate", engine: null };
  if (/^(cpc|ppc|paid[-_ ]?search|sem|paid)$/.test(medium) || ft.ck === "google" || ft.ck === "microsoft") return { channel: "paid_search", engine: engine ?? (/google/.test(source) ? "google" : /bing|microsoft/.test(source) ? "bing" : null) };
  if (/^(email|e-mail|newsletter)$/.test(medium) || webmail.test(r)) return { channel: "email", engine: null };
  if (/^(social|social[-_ ]?paid|paid[-_ ]?social)$/.test(medium) || ft.ck === "meta") return { channel: "social", engine: null };
  if (assistant) return { channel: "ai_assistant", engine: assistant };
  if (engine) return { channel: "organic_search", engine };
  if (/^organic$/.test(medium)) return { channel: "organic_search", engine: /google/.test(source) ? "google" : /bing/.test(source) ? "bing" : null };
  if (social.test(r)) return { channel: "social", engine: null };
  if (r) return { channel: "referral", engine: null };
  return { channel: "direct", engine: null };
}

/** Pages whose first touch is worth keeping: the public website, not the app, auth flows or APIs. */
export function isLandingPath(path: string): boolean {
  return !/^\/(api|auth|_next|login|signup|recover|two-factor|onboarding|checkout|billing|invoices|search|prospects|analytics|outreach|inbox|crm|ai|settings|conversations|notifications|preview|start|dev|support-widget|unsubscribe)(\/|$)/.test(path)
    && !/\.[a-z0-9]{2,5}$/i.test(path);
}
