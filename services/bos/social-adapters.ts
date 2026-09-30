import "server-only";
import { providerFetch } from "@/services/bos/integrations";
import type { MediaItem, MetricKey } from "@/lib/bos/social/platforms";

// Official-API adapters for social publishing (docs/bos/30 §12.3–12.4):
// Facebook Pages + Instagram (Meta Graph API) and Telegram (Bot API).
// Tokens arrive already decrypted and are redacted from logs by providerFetch.

const GRAPH = "https://graph.facebook.com/v21.0";

export type PublishResult = { ok: true; externalId: string; url: string | null } | { ok: false; error: string; retryable: boolean };
const fail = (r: { status: number; error: string | null }): PublishResult => ({ ok: false, error: r.error ?? `HTTP ${r.status}`, retryable: r.status === 0 || r.status === 429 || r.status >= 500 });

interface Ctx { connectionId: string | null; actorId?: string | null }

export async function publishFacebook(ctx: Ctx, pageToken: string, pageId: string, text: string, media: MediaItem[], link: string | null): Promise<PublishResult> {
  const img = media.find((m) => m.type === "image");
  const url = img ? `${GRAPH}/${encodeURIComponent(pageId)}/photos` : `${GRAPH}/${encodeURIComponent(pageId)}/feed`;
  const body = img ? { url: img.url, caption: text } : { message: text, ...(link ? { link } : {}) };
  const r = await providerFetch({ provider: "meta", connectionId: ctx.connectionId, operation: "social.facebook.publish", url, init: { method: "POST", headers: { Authorization: `Bearer ${pageToken}`, "content-type": "application/json" }, body: JSON.stringify(body) }, secrets: { t: pageToken }, retries: 0, actorId: ctx.actorId ?? null });
  const b = r.body as { id?: string; post_id?: string } | null;
  const id = b?.post_id ?? b?.id;
  if (!r.ok || !id) return fail(r);
  return { ok: true, externalId: id, url: `https://www.facebook.com/${id}` };
}

export async function publishInstagram(ctx: Ctx, token: string, igUserId: string, caption: string, media: MediaItem[]): Promise<PublishResult> {
  const img = media.find((m) => m.type === "image");
  if (!img) return { ok: false, error: "Instagram needs an image", retryable: false };
  const base = { provider: "meta", connectionId: ctx.connectionId, secrets: { t: token }, retries: 0, actorId: ctx.actorId ?? null } as const;
  const headers = { Authorization: `Bearer ${token}`, "content-type": "application/json" };
  const c = await providerFetch({ ...base, operation: "social.instagram.container", url: `${GRAPH}/${encodeURIComponent(igUserId)}/media`, init: { method: "POST", headers, body: JSON.stringify({ image_url: img.url, caption }) } });
  const creation = (c.body as { id?: string } | null)?.id;
  if (!c.ok || !creation) return fail(c);
  const p = await providerFetch({ ...base, operation: "social.instagram.publish", url: `${GRAPH}/${encodeURIComponent(igUserId)}/media_publish`, init: { method: "POST", headers, body: JSON.stringify({ creation_id: creation }) } });
  const id = (p.body as { id?: string } | null)?.id;
  if (!p.ok || !id) return fail(p);
  const link = await providerFetch({ ...base, operation: "social.instagram.permalink", url: `${GRAPH}/${encodeURIComponent(id)}?fields=permalink`, init: { headers } });
  return { ok: true, externalId: id, url: (link.body as { permalink?: string } | null)?.permalink ?? null };
}

export async function publishTelegram(ctx: Ctx, botToken: string, chat: string, text: string, media: MediaItem[]): Promise<PublishResult> {
  const img = media.find((m) => m.type === "image");
  const vid = media.find((m) => m.type === "video");
  const method = img ? "sendPhoto" : vid ? "sendVideo" : "sendMessage";
  const payload = img ? { chat_id: chat, photo: img.url, caption: text } : vid ? { chat_id: chat, video: vid.url, caption: text } : { chat_id: chat, text };
  const r = await providerFetch({ provider: "telegram", connectionId: ctx.connectionId, operation: `social.telegram.${method}`, url: `https://api.telegram.org/bot${botToken}/${method}`, init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }, secrets: { t: botToken }, retries: 0, actorId: ctx.actorId ?? null });
  const b = r.body as { ok?: boolean; result?: { message_id?: number; chat?: { username?: string } }; description?: string } | null;
  if (!r.ok || !b?.ok || !b.result?.message_id) return { ...(fail(r) as { ok: false; retryable: boolean }), ok: false, error: b?.description ?? r.error ?? "Telegram error" };
  const username = b.result.chat?.username ?? (chat.startsWith("@") ? chat.slice(1) : null);
  return { ok: true, externalId: String(b.result.message_id), url: username ? `https://t.me/${username}/${b.result.message_id}` : null };
}

// Metrics: only what the API returns; missing values stay missing.
export async function facebookPostMetrics(ctx: Ctx, token: string, postId: string): Promise<Partial<Record<MetricKey, number>>> {
  const headers = { Authorization: `Bearer ${token}` };
  const base = { provider: "meta", connectionId: ctx.connectionId, secrets: { t: token }, retries: 1 } as const;
  const out: Partial<Record<MetricKey, number>> = {};
  const f = await providerFetch({ ...base, operation: "social.facebook.fields", url: `${GRAPH}/${encodeURIComponent(postId)}?fields=likes.summary(true).limit(0),comments.summary(true).limit(0),shares`, init: { headers } });
  const fb = f.body as { likes?: { summary?: { total_count?: number } }; comments?: { summary?: { total_count?: number } }; shares?: { count?: number } } | null;
  if (f.ok) {
    if (fb?.likes?.summary?.total_count != null) out.likes = fb.likes.summary.total_count;
    if (fb?.comments?.summary?.total_count != null) out.comments = fb.comments.summary.total_count;
    out.shares = fb?.shares?.count ?? 0;
  }
  const i = await providerFetch({ ...base, operation: "social.facebook.insights", url: `${GRAPH}/${encodeURIComponent(postId)}/insights?metric=post_impressions,post_impressions_unique,post_clicks`, init: { headers } });
  const map: Record<string, MetricKey> = { post_impressions: "impressions", post_impressions_unique: "reach", post_clicks: "clicks" };
  if (i.ok) for (const m of (i.body as { data?: { name: string; values?: { value?: number }[] }[] })?.data ?? []) if (map[m.name] && typeof m.values?.[0]?.value === "number") out[map[m.name]] = m.values[0].value;
  return out;
}

export async function instagramPostMetrics(ctx: Ctx, token: string, mediaId: string): Promise<Partial<Record<MetricKey, number>>> {
  const headers = { Authorization: `Bearer ${token}` };
  const base = { provider: "meta", connectionId: ctx.connectionId, secrets: { t: token }, retries: 1 } as const;
  const out: Partial<Record<MetricKey, number>> = {};
  const f = await providerFetch({ ...base, operation: "social.instagram.fields", url: `${GRAPH}/${encodeURIComponent(mediaId)}?fields=like_count,comments_count`, init: { headers } });
  const fb = f.body as { like_count?: number; comments_count?: number } | null;
  if (f.ok) {
    if (typeof fb?.like_count === "number") out.likes = fb.like_count;
    if (typeof fb?.comments_count === "number") out.comments = fb.comments_count;
  }
  const i = await providerFetch({ ...base, operation: "social.instagram.insights", url: `${GRAPH}/${encodeURIComponent(mediaId)}/insights?metric=reach,saved,shares,views`, init: { headers } });
  const map: Record<string, MetricKey> = { reach: "reach", saved: "saves", shares: "shares", views: "views" };
  if (i.ok) for (const m of (i.body as { data?: { name: string; values?: { value?: number }[] }[] })?.data ?? []) if (map[m.name] && typeof m.values?.[0]?.value === "number") out[map[m.name]] = m.values[0].value;
  return out;
}

export async function accountFollowers(ctx: Ctx, platform: string, token: string, externalId: string): Promise<number | null> {
  if (platform === "telegram") {
    const r = await providerFetch({ provider: "telegram", connectionId: ctx.connectionId, operation: "social.telegram.members", url: `https://api.telegram.org/bot${token}/getChatMemberCount?chat_id=${encodeURIComponent(externalId)}`, secrets: { t: token }, retries: 1 });
    const b = r.body as { ok?: boolean; result?: number } | null;
    return r.ok && b?.ok && typeof b.result === "number" ? b.result : null;
  }
  const fields = platform === "instagram" ? "followers_count" : "followers_count,fan_count";
  const r = await providerFetch({ provider: "meta", connectionId: ctx.connectionId, operation: `social.${platform}.followers`, url: `${GRAPH}/${encodeURIComponent(externalId)}?fields=${fields}`, init: { headers: { Authorization: `Bearer ${token}` } }, secrets: { t: token }, retries: 1 });
  const b = r.body as { followers_count?: number; fan_count?: number } | null;
  if (!r.ok) return null;
  return b?.followers_count ?? b?.fan_count ?? null;
}

export interface MetaPage { id: string; name: string; access_token: string; picture?: { data?: { url?: string } }; link?: string; instagram_business_account?: { id: string; username?: string; profile_picture_url?: string } }

export async function listMetaPages(ctx: Ctx, userToken: string): Promise<{ ok: true; pages: MetaPage[] } | { ok: false; error: string }> {
  const r = await providerFetch({ provider: "meta", connectionId: ctx.connectionId, operation: "social.meta.pages", url: `${GRAPH}/me/accounts?fields=id,name,access_token,picture{url},link,instagram_business_account{id,username,profile_picture_url}&limit=100`, init: { headers: { Authorization: `Bearer ${userToken}` } }, secrets: { t: userToken }, retries: 1, actorId: ctx.actorId ?? null });
  if (!r.ok) return { ok: false, error: r.error ?? `HTTP ${r.status}` };
  return { ok: true, pages: (r.body as { data?: MetaPage[] })?.data ?? [] };
}

export async function telegramChat(ctx: Ctx, botToken: string, chat: string) {
  const r = await providerFetch({ provider: "telegram", connectionId: ctx.connectionId, operation: "social.telegram.getChat", url: `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(chat)}`, secrets: { t: botToken }, retries: 1, actorId: ctx.actorId ?? null });
  const b = r.body as { ok?: boolean; result?: { id: number; title?: string; username?: string }; description?: string } | null;
  if (!r.ok || !b?.ok || !b.result) return { ok: false as const, error: b?.description ?? r.error ?? "Telegram error" };
  return { ok: true as const, chat: b.result };
}
