import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { campaignOfLead } from "@/lib/campaigns/activity";
import type { PixelRow } from "@/types/database";

// The Yolias pixel (owner, 2026-11-02, D-274), like Facebook's: a snippet the
// member puts on their website (yolias.com/px.js), events sent to /api/px,
// and Events Manager in the app. A visit from a link Yolias sent carries
// ?yc=<lead>; the pixel keeps it on that site for 90 days and adds it to
// every event, so a checkout, purchase or form is credited to the campaign
// and audience that reached the person. Events without it are counted in
// Events Manager but not credited to a campaign. Nothing about the visitor
// is collected beyond the page address, the referrer and a random id.

type Db = ReturnType<typeof createAdminClient>;
const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yolias.com").replace(/\/$/, "");

/** Standard events, like an ads platform's; any other name made of letters, digits and _ is a custom event. */
export const STANDARD_EVENTS = ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase", "Lead", "CompleteRegistration", "Contact"] as const;
const EVENT = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The workspace's pixel, made the first time it is asked for. */
export async function ensurePixel(workspaceId: string): Promise<PixelRow> {
  const db = createAdminClient();
  const { data: have } = await db.from("pixels").select("*").eq("workspace_id", workspaceId).maybeSingle();
  if (have) return have as PixelRow;
  const { data, error } = await db.from("pixels").insert({ workspace_id: workspaceId, public_id: randomBytes(8).toString("hex") }).select("*").single();
  if (data) return data as PixelRow;
  const { data: again } = await db.from("pixels").select("*").eq("workspace_id", workspaceId).maybeSingle();
  if (again) return again as PixelRow;
  throw error ?? new Error("pixel not created");
}

/** The snippet for the website's <head>, like Facebook's base code. */
export function pixelSnippet(publicId: string): string {
  return `<!-- Yolias Pixel -->
<script>
!function(w,d,s){if(w.yolias)return;var y=w.yolias=function(){(y.q=y.q||[]).push(arguments)};var t=d.createElement(s);t.async=1;t.src="${site()}/px.js";var f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(t,f)}(window,document,"script");
yolias("init","${publicId}");
yolias("track","PageView");
</script>
<!-- End Yolias Pixel -->`;
}

export interface IncomingEvent { pixel?: unknown; event?: unknown; value?: unknown; currency?: unknown; url?: unknown; ref?: unknown; yc?: unknown; vid?: unknown; event_id?: unknown }

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Pure: an incoming event cleaned, or null when it isn't one (unit-tested). */
export function cleanEvent(e: IncomingEvent): { pixel: string; event: string; value: number | null; currency: string | null; url: string | null; ref: string | null; yc: string | null; vid: string | null; eventId: string | null } | null {
  const pixel = typeof e.pixel === "string" && /^[0-9a-f]{16}$/.test(e.pixel) ? e.pixel : null;
  const event = typeof e.event === "string" && EVENT.test(e.event) ? e.event : null;
  if (!pixel || !event) return null;
  const n = typeof e.value === "number" ? e.value : typeof e.value === "string" && e.value.trim() !== "" ? Number(e.value) : NaN;
  const value = Number.isFinite(n) && n >= 0 && n <= 1e9 ? Math.round(n * 100) / 100 : null;
  const cur = typeof e.currency === "string" ? e.currency.trim().toUpperCase() : "";
  return {
    pixel, event, value, currency: /^[A-Z]{3}$/.test(cur) ? cur : value != null ? "USD" : null,
    url: str(e.url, 1000), ref: str(e.ref, 1000), yc: typeof e.yc === "string" && UUID.test(e.yc) ? e.yc : null,
    vid: str(e.vid, 64), eventId: str(e.event_id, 100),
  };
}

/** Pure: whether a page address is on one of the pixel's allowed domains (none set = any). */
export function domainAllowed(url: string | null, allowed: string[]): boolean {
  if (!allowed.length) return true;
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return allowed.some((d) => { const x = d.toLowerCase().replace(/^\*?\./, ""); return host === x || host.endsWith(`.${x}`); });
  } catch {
    return false;
  }
}

/** Records one event; "ignored" for a bad, unknown, duplicate or too-frequent one. Never throws. */
export async function recordPixelEvent(raw: IncomingEvent): Promise<"ok" | "ignored"> {
  const e = cleanEvent(raw);
  if (!e) return "ignored";
  try {
    const db = createAdminClient();
    const { data: px } = await db.from("pixels").select("id, workspace_id, allowed_domains").eq("public_id", e.pixel).maybeSingle();
    if (!px || !domainAllowed(e.url, px.allowed_domains ?? [])) return "ignored";
    // A visitor sends at most 120 events a minute.
    if (e.vid) {
      const { count } = await db.from("pixel_events").select("id", { count: "exact", head: true }).eq("pixel_id", px.id).eq("visitor", e.vid).gte("created_at", new Date(Date.now() - 60_000).toISOString());
      if ((count ?? 0) >= 120) return "ignored";
    }
    const credit = e.yc ? await creditFor(db, px.workspace_id, e.yc) : null;
    const { error } = await db.from("pixel_events").insert({
      pixel_id: px.id, workspace_id: px.workspace_id, event: e.event, value: e.value, currency: e.currency, url: e.url, referrer: e.ref, visitor: e.vid, event_id: e.eventId,
      lead_id: credit?.lead ?? null, campaign_id: credit?.campaign ?? null, group_id: credit?.group ?? null,
    });
    if (error) return "ignored";
    await db.from("pixels").update({ last_event_at: new Date().toISOString() }).eq("id", px.id);
    return "ok";
  } catch (err) {
    console.error("[pixel]", err instanceof Error ? err.message : err);
    return "ignored";
  }
}

/** The campaign and audience that reached this person (only within the pixel's own workspace). */
async function creditFor(db: Db, workspaceId: string, leadId: string): Promise<{ lead: string; campaign: string | null; group: string | null } | null> {
  const { data: lead } = await db.from("sales_leads").select("id").eq("id", leadId).eq("workspace_id", workspaceId).maybeSingle();
  if (!lead) return null;
  const campaign = await campaignOfLead(db, lead.id);
  const { data: enr } = campaign ? await db.from("outreach_enrollments").select("audience_group_id").eq("campaign_id", campaign).eq("lead_id", lead.id).limit(1).maybeSingle() : { data: null };
  return { lead: lead.id, campaign, group: enr?.audience_group_id ?? null };
}

/** The browser script (served at /px.js). */
export function pixelScript(): string {
  return `/* Yolias Pixel (yolias.com) */
(function(w,d){
var S=d.currentScript,E=(function(){try{return new URL(S.src).origin}catch(e){return "${site()}"}})()+"/api/px",K="_yolias_yc",V="_yolias_v",pid=null,Q=(w.yolias&&w.yolias.q)||[];
function put(k,v,days){try{localStorage.setItem(k,JSON.stringify({v:v,e:Date.now()+days*864e5}))}catch(e){}try{d.cookie=k+"="+encodeURIComponent(v)+";path=/;max-age="+days*86400+";SameSite=Lax"}catch(e){}}
function get(k){try{var o=JSON.parse(localStorage.getItem(k)||"null");if(o&&o.e>Date.now())return o.v}catch(e){}var m=d.cookie.match(new RegExp("(?:^|; )"+k+"=([^;]*)"));return m?decodeURIComponent(m[1]):null}
try{var yc=new URLSearchParams(location.search).get("yc");if(yc&&/^[0-9a-f-]{36}$/i.test(yc))put(K,yc,90)}catch(e){}
var vid=get(V);if(!vid){vid=Math.random().toString(36).slice(2)+Date.now().toString(36);put(V,vid,365)}
function send(ev,p){if(!pid)return;p=p||{};var b=JSON.stringify({pixel:pid,event:ev,value:p.value,currency:p.currency,event_id:p.event_id,url:location.href,ref:d.referrer,yc:get(K),vid:vid});
try{if(navigator.sendBeacon&&navigator.sendBeacon(E,new Blob([b],{type:"text/plain"})))return}catch(e){}
try{fetch(E,{method:"POST",body:b,keepalive:true,mode:"no-cors",headers:{"Content-Type":"text/plain"}})}catch(e){}}
function api(c,a,b){if(c==="init")pid=String(a);else if(c==="track"||c==="trackCustom")send(String(a),b)}
w.yolias=function(){api.apply(null,arguments)};for(var i=0;i<Q.length;i++)api.apply(null,Q[i]);
})(window,document);
`;
}
