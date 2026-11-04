import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classify, firstTouch } from "@/lib/attribution";
import { deviceOf } from "@/lib/funnel";

// Page views on yolias.com and in the app (owner, 2026-11-03, D-276), for
// Yolias Admin: visitors, visits, views, channels, countries, cities,
// devices and live users. The page sends its path and referrer (/api/v);
// the server adds where the request came from (Cloudflare), the device and
// the channel. A visitor is the yolias_vid cookie when analytics cookies are
// accepted, else a daily hash of the address and the browser (no cookie). A
// visit ends after 30 minutes without a page view. IP addresses are cleared
// after 30 days. Bots are not counted.

const VISIT_GAP_MS = 30 * 60_000;
export const IP_DAYS = 30;
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|axios|node-fetch|facebookexternalhit|whatsapp|telegram/i;
// Paths of the app (signed-in); everything else is the website.
const APP = /^\/(dashboard|campaigns|outreach|prospects|audiences|inbox|meetings|ai|integrations|events|search|settings|notifications|checkout|onboarding|billing|invoices|start)(\/|$)|^\/$/;

export interface Geo { country: string | null; region: string | null; city: string | null; ip: string | null }

/** Where a request came from: Cloudflare's request data, then its headers. */
export async function geoOf(request: NextRequest): Promise<Geo> {
  let cf: { country?: string; region?: string; city?: string } | undefined;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    cf = (getCloudflareContext().cf ?? undefined) as typeof cf;
  } catch {
    cf = undefined;
  }
  const h = (k: string) => request.headers.get(k);
  const country = (cf?.country ?? h("cf-ipcountry") ?? "").toUpperCase();
  const clean = (v: string | null | undefined) => (v ? v.slice(0, 100) : null);
  const ip = h("cf-connecting-ip") ?? h("x-real-ip") ?? h("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return {
    country: /^[A-Z]{2}$/.test(country) && country !== "XX" && country !== "T1" ? country : null,
    region: clean(cf?.region ?? h("cf-region")),
    city: clean(cf?.city ?? h("cf-ipcity")),
    ip: ip && /^[0-9a-f.:]{3,45}$/i.test(ip) ? ip : null,
  };
}

/** The daily visitor id without a cookie: the same address and browser on the same day. */
function dailyVisitor(ip: string | null, ua: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "yolias";
  return `d_${createHash("sha256").update(`${day}|${salt}|${ip ?? ""}|${ua}`).digest("hex").slice(0, 32)}`;
}

export interface VisitInput { path: string; referrer: string | null; vid: string | null; locale: string | null; userId: string | null; workspaceId: string | null }

/** Records one page view. Never throws: tracking never breaks a page. */
export async function recordVisit(request: NextRequest, input: VisitInput): Promise<void> {
  try {
    const ua = request.headers.get("user-agent") ?? "";
    if (!ua || BOT.test(ua)) return;
    const geo = await geoOf(request);
    const url = new URL(input.path, "https://www.yolias.com");
    // Arabic pages live under /ar; the area is decided on the path without it.
    const bare = url.pathname.replace(/^\/ar(?=\/|$)/, "") || "/";
    const area: "site" | "app" = input.userId && APP.test(bare) ? "app" : "site";
    const visitor = input.vid && /^v_[a-z0-9]{16,40}$/.test(input.vid) ? input.vid : dailyVisitor(geo.ip, ua);
    const db = createAdminClient();
    const { data: last } = await db.from("site_visits").select("session, created_at").eq("visitor", visitor).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const continues = last && Date.now() - Date.parse(last.created_at) < VISIT_GAP_MS;
    let referrerHost: string | null = null;
    try { referrerHost = input.referrer ? new URL(input.referrer).hostname.toLowerCase().replace(/^www\./, "") : null; } catch { referrerHost = null; }
    const self = ["yolias.com", "localhost"];
    if (referrerHost && self.some((s) => referrerHost === s || referrerHost!.endsWith(`.${s}`))) referrerHost = null;
    const utm = (k: string) => url.searchParams.get(k)?.slice(0, 100) ?? null;
    // The same classification as sign-up attribution (lib/attribution.ts).
    const channel = continues ? null : classify(firstTouch(url, referrerHost ? `https://${referrerHost}/` : null), self);
    const d = deviceOf(ua);
    await db.from("site_visits").insert({
      visitor, session: continues ? last!.session : randomUUID(), user_id: input.userId, workspace_id: input.workspaceId,
      area, path: `${url.pathname}`.slice(0, 300), landing: !continues,
      referrer_host: referrerHost, channel: channel?.channel ?? null, engine: channel?.engine ?? null,
      utm_source: utm("utm_source"), utm_medium: utm("utm_medium"), utm_campaign: utm("utm_campaign"),
      country: geo.country, region: geo.region, city: geo.city, ip: geo.ip,
      device: d.device, os: d.os, browser: d.browser, locale: input.locale === "ar" || input.locale === "en" ? input.locale : null,
    });
  } catch (err) {
    console.error("[visits]", err instanceof Error ? err.message : err);
  }
}

/** Signed-in sessions: where the latest one comes from (Admin → live users). */
export async function tagAppSession(request: NextRequest, userId: string): Promise<void> {
  try {
    const geo = await geoOf(request);
    const db = createAdminClient();
    const { data } = await db.from("app_sessions").select("id").eq("user_id", userId).order("last_seen_at", { ascending: false }).limit(1).maybeSingle();
    if (data) await db.from("app_sessions").update({ ip: geo.ip, country: geo.country, city: geo.city }).eq("id", data.id);
  } catch {
    // never blocks the app
  }
}

/** Worker, once a day: IP addresses older than IP_DAYS are cleared. */
export async function clearOldIps(): Promise<void> {
  const db = createAdminClient();
  const before = new Date(Date.now() - IP_DAYS * 86_400_000).toISOString();
  await db.from("site_visits").update({ ip: null }).lt("created_at", before).not("ip", "is", null);
  await db.from("app_sessions").update({ ip: null }).lt("last_seen_at", before).not("ip", "is", null);
}
