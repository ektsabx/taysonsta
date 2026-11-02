import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { campaignOfLead } from "@/lib/campaigns/activity";
import type { PixelRow } from "@/types/database";

// The Yolias pixel (owner, 2026-11-02, D-274), after Facebook's pixel:
//  - A workspace has one or more pixels, each with its own id and code.
//  - The base code (yolias.com/px.js) goes on the member's website; standard
//    and custom events, with value and currency, go to /api/px.
//  - Attribution, like an ads platform's 7-day window (per campaign: 1, 7 or
//    28 days):
//      click: the visitor came from a link a Yolias campaign sent (?yc=<lead>,
//             kept in that browser) and the event happens within the window
//             after that click;
//      view:  no click, but the site sent the customer's email (advanced
//             matching, hashed with SHA-256 in the browser) and Yolias wrote
//             to that person within the window.
//    Anything else is counted in Events Manager but credited to no campaign.
//  - Test events (?yolias_test=<code> on the website) are shown live in Test
//    events and kept out of every result.
//  - Allowed and blocked domains decide which websites may send events.
// Nothing is collected beyond what the site sends, the page address, the
// referrer and a random visitor id.

type Db = ReturnType<typeof createAdminClient>;
const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yolias.com").replace(/\/$/, "");
const DAY = 86_400_000;

/** Facebook's standard events, grouped by the objective they serve (D-274), plus PageView. */
import { LEAD_EVENTS, PURCHASE_EVENTS } from "@/lib/pixel-events";
export { LEAD_EVENTS, PURCHASE_EVENTS };
export const STANDARD_EVENTS = ["PageView", ...new Set([...PURCHASE_EVENTS, ...LEAD_EVENTS])] as string[];
const EVENT = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A workspace's pixels (the first one is made when there is none). */
export async function workspacePixels(workspaceId: string): Promise<PixelRow[]> {
  const db = createAdminClient();
  const { data } = await db.from("pixels").select("*").eq("workspace_id", workspaceId).order("created_at");
  if (data?.length) return data as PixelRow[];
  return [await createPixel(workspaceId, "Yolias pixel", null)];
}

export async function createPixel(workspaceId: string, name: string, userId: string | null): Promise<PixelRow> {
  const { data, error } = await createAdminClient().from("pixels").insert({ workspace_id: workspaceId, public_id: randomBytes(8).toString("hex"), name: name.slice(0, 80) || "Yolias pixel", created_by: userId }).select("*").single();
  if (error || !data) throw error ?? new Error("pixel not created");
  return data as PixelRow;
}

/** The base code for the website's <head>, like Facebook's. */
export function pixelSnippet(publicId: string): string {
  return `<!-- Yolias Pixel Code -->
<script>
!function(w,d,s){if(w.yolias)return;var y=w.yolias=function(){(y.q=y.q||[]).push(arguments)};var t=d.createElement(s);t.async=1;t.src="${site()}/px.js";var f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(t,f)}(window,document,"script");
yolias("init","${publicId}");
yolias("track","PageView");
</script>
<!-- End Yolias Pixel Code -->`;
}

export interface IncomingEvent { pixel?: unknown; event?: unknown; value?: unknown; currency?: unknown; url?: unknown; ref?: unknown; yc?: unknown; yct?: unknown; em?: unknown; test?: unknown; vid?: unknown; event_id?: unknown }
export interface CleanEvent { pixel: string; event: string; value: number | null; currency: string | null; url: string | null; ref: string | null; yc: string | null; yct: number | null; em: string | null; test: string | null; vid: string | null; eventId: string | null }

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Pure: an incoming event cleaned, or null when it isn't one (unit-tested). */
export function cleanEvent(e: IncomingEvent): CleanEvent | null {
  const pixel = typeof e.pixel === "string" && /^[0-9a-f]{16}$/.test(e.pixel) ? e.pixel : null;
  const event = typeof e.event === "string" && EVENT.test(e.event) ? e.event : null;
  if (!pixel || !event) return null;
  const n = typeof e.value === "number" ? e.value : typeof e.value === "string" && e.value.trim() !== "" ? Number(e.value) : NaN;
  const value = Number.isFinite(n) && n >= 0 && n <= 1e9 ? Math.round(n * 100) / 100 : null;
  const cur = typeof e.currency === "string" ? e.currency.trim().toUpperCase() : "";
  const yct = typeof e.yct === "number" && Number.isFinite(e.yct) ? e.yct : null;
  return {
    pixel, event, value, currency: /^[A-Z]{3}$/.test(cur) ? cur : value != null ? "USD" : null,
    url: str(e.url, 1000), ref: str(e.ref, 1000), yc: typeof e.yc === "string" && UUID.test(e.yc) ? e.yc : null, yct,
    em: typeof e.em === "string" && /^[0-9a-f]{64}$/.test(e.em) ? e.em : null,
    test: typeof e.test === "string" && /^[A-Z0-9]{4,12}$/.test(e.test) ? e.test : null,
    vid: str(e.vid, 64), eventId: str(e.event_id, 100),
  };
}

const hostOf = (url: string | null) => { try { return url ? new URL(url).hostname.toLowerCase() : null; } catch { return null; } };
const matches = (host: string, d: string) => { const x = d.toLowerCase().replace(/^\*?\./, ""); return host === x || host.endsWith(`.${x}`); };

/** Pure: whether a page may send events: not on a blocked domain, and on an allowed one when any are set. */
export function domainAllowed(url: string | null, allowed: string[], blocked: string[] = []): boolean {
  const host = hostOf(url);
  if (host && blocked.some((d) => matches(host, d))) return false;
  if (!allowed.length) return true;
  return Boolean(host && allowed.some((d) => matches(host, d)));
}

/** Pure: whether a click at `clickedAt` still credits an event at `at` within `days` (unit-tested). */
export const withinWindow = (clickedAt: number | null, at: number, days: number) => clickedAt != null && at >= clickedAt - 60_000 && at - clickedAt <= days * DAY;

/** SHA-256 of a normalized email, as the browser sends it (advanced matching). */
export const emailHash = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

/** Records one event; "ignored" for a bad, unknown, blocked, duplicate or too-frequent one. Never throws. */
export async function recordPixelEvent(raw: IncomingEvent, now = Date.now()): Promise<"ok" | "ignored"> {
  const e = cleanEvent(raw);
  if (!e) return "ignored";
  try {
    const db = createAdminClient();
    const { data: px } = await db.from("pixels").select("id, workspace_id, allowed_domains, blocked_domains").eq("public_id", e.pixel).maybeSingle();
    if (!px || !domainAllowed(e.url, px.allowed_domains ?? [], px.blocked_domains ?? [])) return "ignored";
    // A visitor sends at most 120 events a minute.
    if (e.vid) {
      const { count } = await db.from("pixel_events").select("id", { count: "exact", head: true }).eq("pixel_id", px.id).eq("visitor", e.vid).gte("created_at", new Date(now - 60_000).toISOString());
      if ((count ?? 0) >= 120) return "ignored";
    }
    // Test events are shown in Test events only, never credited.
    const credit = e.test ? null : await creditFor(db, px.workspace_id, e, now);
    const { error } = await db.from("pixel_events").insert({
      pixel_id: px.id, workspace_id: px.workspace_id, event: e.event, value: e.value, currency: e.currency, url: e.url, referrer: e.ref, visitor: e.vid, event_id: e.eventId,
      lead_id: credit?.lead ?? null, campaign_id: credit?.campaign ?? null, group_id: credit?.group ?? null, attribution: credit?.how ?? null, test_code: e.test,
    });
    if (error) return "ignored";
    await db.from("pixels").update({ last_event_at: new Date(now).toISOString() }).eq("id", px.id);
    return "ok";
  } catch (err) {
    console.error("[pixel]", err instanceof Error ? err.message : err);
    return "ignored";
  }
}

/** Which campaign and audience reached this person, within the campaign's attribution window (click first, then view). */
async function creditFor(db: Db, workspaceId: string, e: CleanEvent, now: number): Promise<{ lead: string; campaign: string; group: string | null; how: "click" | "view" } | null> {
  if (e.yc) {
    const { data: lead } = await db.from("sales_leads").select("id").eq("id", e.yc).eq("workspace_id", workspaceId).maybeSingle();
    const campaign = lead ? await campaignOfLead(db, lead.id) : null;
    if (lead && campaign) {
      const { data: c } = await db.from("outreach_campaigns").select("attribution_days").eq("id", campaign).maybeSingle();
      // The click is when the browser first came with this link (kept by px.js); without it, now.
      if (withinWindow(e.yct ?? now, now, c?.attribution_days ?? 7)) return { lead: lead.id, campaign, group: await groupOf(db, campaign, lead.id), how: "click" };
    }
  }
  if (e.em) {
    // View-through: the person Yolias wrote to most recently with this email, within the window (up to 28 days).
    const since = new Date(now - 28 * DAY).toISOString();
    const { data: sent } = await db.from("outreach_messages").select("lead_id, to_email, sent_at, outreach_campaign_id").eq("workspace_id", workspaceId).eq("direction", "outbound").eq("status", "sent")
      .not("outreach_campaign_id", "is", null).gte("sent_at", since).order("sent_at", { ascending: false }).limit(5000);
    for (const m of sent ?? []) {
      if (!m.to_email || !m.lead_id || emailHash(m.to_email) !== e.em) continue;
      const { data: c } = await db.from("outreach_campaigns").select("attribution_days").eq("id", m.outreach_campaign_id!).maybeSingle();
      if (!withinWindow(Date.parse(m.sent_at!), now, c?.attribution_days ?? 7)) return null;
      return { lead: m.lead_id, campaign: m.outreach_campaign_id!, group: await groupOf(db, m.outreach_campaign_id!, m.lead_id), how: "view" };
    }
  }
  return null;
}

async function groupOf(db: Db, campaign: string, lead: string): Promise<string | null> {
  const { data } = await db.from("outreach_enrollments").select("audience_group_id").eq("campaign_id", campaign).eq("lead_id", lead).limit(1).maybeSingle();
  return data?.audience_group_id ?? null;
}

/** For the Pixel Helper and the browser script's debug mode: whether a pixel id exists, and its name. */
export async function pixelInfo(publicId: string): Promise<{ ok: boolean; name?: string }> {
  if (!/^[0-9a-f]{16}$/.test(publicId)) return { ok: false };
  const { data } = await createAdminClient().from("pixels").select("name").eq("public_id", publicId).maybeSingle();
  return data ? { ok: true, name: data.name } : { ok: false };
}

/**
 * The browser script (served at /px.js), like fbq: init(id[, {em}]) (several
 * pixels may be initialised), track(event[, {value, currency, event_id, em}])
 * and trackCustom(name[, …]) send to every initialised pixel. Every event is
 * also announced on the page (a "yolias:pixel" DOM event and
 * window.__yoliasPixel) for the Yolias Pixel Helper extension.
 */
export function pixelScript(): string {
  return `/* Yolias Pixel (yolias.com) */
(function(w,d){
if(w.__yoliasPixel&&w.__yoliasPixel.loaded)return;
var S=d.currentScript,O=(function(){try{return new URL(S.src).origin}catch(e){return "${site()}"}})(),E=O+"/api/px",K="_yolias_yc",V="_yolias_v",T="_yolias_test";
var ids=[],em=null,Q=(w.yolias&&w.yolias.q)||[],dbg=w.__yoliasPixel={loaded:true,origin:O,pixels:ids,events:[]};
function put(k,v,days){try{localStorage.setItem(k,JSON.stringify({v:v,e:Date.now()+days*864e5}))}catch(e){}try{d.cookie=k+"="+encodeURIComponent(typeof v==="string"?v:JSON.stringify(v))+";path=/;max-age="+days*86400+";SameSite=Lax"}catch(e){}}
function get(k){try{var o=JSON.parse(localStorage.getItem(k)||"null");if(o&&o.e>Date.now())return o.v}catch(e){}var m=d.cookie.match(new RegExp("(?:^|; )"+k+"=([^;]*)"));if(!m)return null;var r=decodeURIComponent(m[1]);try{return JSON.parse(r)}catch(e){return r}}
var q;try{q=new URLSearchParams(location.search)}catch(e){q=null}
var yc=q&&q.get("yc");if(yc&&/^[0-9a-f-]{36}$/i.test(yc)){var had=get(K);if(!had||had.id!==yc)put(K,{id:yc,t:Date.now()},90)}
var tc=q&&q.get("yolias_test");if(tc&&/^[A-Z0-9]{4,12}$/.test(tc)){try{sessionStorage.setItem(T,tc)}catch(e){}}
function test(){try{return sessionStorage.getItem(T)}catch(e){return null}}
var vid=get(V);if(!vid||typeof vid!=="string"){vid=Math.random().toString(36).slice(2)+Date.now().toString(36);put(V,vid,365)}
function hash(s){try{if(!s||!w.crypto||!w.crypto.subtle)return Promise.resolve(null);s=String(s).trim().toLowerCase();if(/^[0-9a-f]{64}$/.test(s))return Promise.resolve(s);return w.crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)).then(function(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return("0"+x.toString(16)).slice(-2)}).join("")})}catch(e){return Promise.resolve(null)}}
function announce(x){x.origin=O;dbg.events.push(x);if(dbg.events.length>200)dbg.events.shift();try{d.dispatchEvent(new CustomEvent("yolias:pixel",{detail:JSON.stringify(x)}))}catch(e){}}
function send(ev,p,custom){p=p||{};if(!ids.length){announce({event:ev,params:p,error:"no_init",at:Date.now()});return}
var c=get(K);Promise.resolve(p.em?hash(p.em):em).then(function(h){ids.forEach(function(id){
var body={pixel:id,event:ev,value:p.value,currency:p.currency,event_id:p.event_id,url:location.href,ref:d.referrer,yc:c&&c.id||null,yct:c&&c.t||null,em:h||null,test:test(),vid:vid};
var b=JSON.stringify(body),ok=false;try{if(navigator.sendBeacon)ok=navigator.sendBeacon(E,new Blob([b],{type:"text/plain"}))}catch(e){}
if(!ok){try{fetch(E,{method:"POST",body:b,keepalive:true,mode:"no-cors",headers:{"Content-Type":"text/plain"}})}catch(e){}}
announce({pixel:id,event:ev,custom:!!custom,params:{value:p.value,currency:p.currency,event_id:p.event_id},matched:!!h,fromYolias:!!(c&&c.id),test:test(),url:location.href,at:Date.now()})})})}
function api(c,a,b){if(c==="init"){a=String(a);if(ids.indexOf(a)<0)ids.push(a);announce({type:"init",pixel:a,matching:!!(b&&b.em),at:Date.now()});if(b&&b.em)hash(b.em).then(function(h){em=h});try{d.documentElement.setAttribute("data-yolias-pixel",ids.join(","))}catch(e){}}
else if(c==="track")send(String(a),b,false);else if(c==="trackCustom")send(String(a),b,true)}
w.yolias=function(){api.apply(null,arguments)};for(var i=0;i<Q.length;i++)api.apply(null,Q[i]);
})(window,document);
`;
}
