import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

// Resend delivery webhooks (D-243). Resend signs with Svix: HMAC-SHA256 over
// "<svix-id>.<svix-timestamp>.<body>" with the endpoint's signing secret
// (whsec_…, entered in Yolias Admin → Messaging → Settings and kept in
// Vault). Web Crypto only, so it runs on Cloudflare Workers.

const TOLERANCE_S = 5 * 60;

function b64(bytes: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s);
}

export async function verifySvix(secret: string, headers: { id: string; timestamp: string; signature: string }, body: string, nowS = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowS - ts) > TOLERANCE_S) return false;
  let key: Uint8Array<ArrayBuffer>;
  try {
    key = new Uint8Array(Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0)));
  } catch {
    return false;
  }
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = b64(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${headers.id}.${headers.timestamp}.${body}`)));
  return headers.signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig || sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

export interface ResendEvent { type: string; created_at?: string; data?: { email_id?: string; to?: string[]; bounce?: { message?: string; type?: string }; click?: { link?: string } } }

/**
 * Applies one verified event. Stored once by its Svix id (a redelivery is a
 * no-op); updates the send log row Resend's email id points to. Bounces and
 * complaints suppress the address for lifecycle and marketing email.
 */
export async function applyResendEvent(eventId: string, ev: ResendEvent): Promise<"applied" | "duplicate" | "unknown_email"> {
  const db = createAdminClient();
  const emailId = ev.data?.email_id ?? null;
  const { data: row } = emailId ? await db.from("email_log").select("id, to_email").eq("provider_id", emailId).maybeSingle() : { data: null };
  const { data: stored } = await db.from("msg_provider_events").upsert({ event_id: eventId, type: ev.type.slice(0, 60), email_id: emailId, email_log_id: row?.id ?? null, payload: ev as unknown as Json }, { onConflict: "event_id", ignoreDuplicates: true }).select("id");
  if (!stored?.length) return "duplicate";
  if (!row) return "unknown_email";
  const at = ev.created_at && !Number.isNaN(Date.parse(ev.created_at)) ? new Date(ev.created_at).toISOString() : new Date().toISOString();
  const patch: Record<string, unknown> = {};
  switch (ev.type) {
    case "email.delivered": patch.delivery_status = "delivered"; patch.delivered_at = at; break;
    case "email.delivery_delayed": patch.delivery_status = "delayed"; break;
    case "email.bounced": patch.delivery_status = "bounced"; patch.bounced_at = at; patch.error = (ev.data?.bounce?.message ?? "bounced").slice(0, 500); break;
    case "email.complained": patch.delivery_status = "complained"; patch.complained_at = at; break;
    case "email.opened": patch.opened_at = at; break;
    case "email.clicked": patch.clicked_at = at; break;
    case "email.failed": patch.status = "failed"; patch.error = "Resend could not send it"; break;
  }
  if (Object.keys(patch).length) {
    // First open / click only; a delivered status never overrides a bounce or complaint.
    let q = db.from("email_log").update(patch as never).eq("id", row.id);
    if (ev.type === "email.opened") q = q.is("opened_at", null);
    if (ev.type === "email.clicked") q = q.is("clicked_at", null);
    if (ev.type === "email.delivered" || ev.type === "email.delivery_delayed") q = q.or("delivery_status.is.null,delivery_status.in.(delivered,delayed)");
    await q;
  }
  if (ev.type === "email.bounced" && ev.data?.bounce?.type !== "Transient" || ev.type === "email.complained") {
    await db.from("msg_suppressions").upsert({ email: row.to_email.toLowerCase(), reason: ev.type === "email.complained" ? "complained" : "bounced", source: `resend:${eventId}` }, { onConflict: "email", ignoreDuplicates: true });
  }
  return "applied";
}
