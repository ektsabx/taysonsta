import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import { can, type BosUser } from "@/lib/bos/auth";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { nowIso, nowMs } from "@/lib/bos/clock";
import { decryptSecrets, encryptSecrets } from "@/lib/bos/secrets";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";
import { resolveConnection } from "@/services/bos/integrations";
import { accountFollowers, facebookPostMetrics, instagramPostMetrics, listMetaPages, publishFacebook, publishInstagram, publishTelegram, telegramChat, type PublishResult } from "@/services/bos/social-adapters";
import { composeText, engagementRate, platforms, validateTarget, type MediaItem, type MetricKey, type Platform } from "@/lib/bos/social/platforms";

// Social media management (docs/bos/30 §12, doc 31 Phase 10): accounts
// (API or manual), posts with per-platform versions, review/approval,
// publish now or on schedule (sweep), safe retry (a target that has a
// platform post id is never published again), manual publishing for
// platforms without an approved API, metrics with source and sync time.

export type SocialAccount = Tables<"social_accounts">;
export type SocialPost = Tables<"social_posts">;
export type SocialTarget = Tables<"social_post_targets">;

const MAX_ATTEMPTS = 3;
const EDITABLE = ["draft", "changes_requested", "approved", "scheduled", "failed"];

function need(bos: BosUser, perm: "social.read" | "social.create" | "social.update" | "social.approve" | "social.manage") {
  if (!can(bos, perm)) throw new ForbiddenError();
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export async function listAccounts(opts: { activeOnly?: boolean } = {}) {
  let q = db().from("social_accounts").select("id, platform, mode, name, handle, avatar_url, profile_url, status, scopes, last_sync_at, last_error, connected_at, is_active, external_id, connection_id").order("platform").order("name");
  if (opts.activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return data ?? [];
}

export async function saveManualAccount(bos: BosUser, input: { platform: Platform; name: string; handle?: string | null; profile_url?: string | null }) {
  need(bos, "social.manage");
  if (!platforms[input.platform]) throw new ValidationError("منصة غير معروفة.");
  if (!input.name.trim()) throw new ValidationError("اسم الحساب مطلوب.", { name: "مطلوب" });
  if (input.profile_url && !/^https:\/\//.test(input.profile_url)) throw new ValidationError("رابط الحساب يجب أن يبدأ بـ https://", { profile_url: "غير صالح" });
  const { data, error } = await db().from("social_accounts").insert({ platform: input.platform, mode: "manual", status: "manual", name: input.name.trim(), handle: input.handle?.trim() || null, profile_url: input.profile_url || null, connected_by: bos.userId }).select("id").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "social.account_added", entityType: "social_account", entityId: data.id, newValue: { platform: input.platform, mode: "manual", name: input.name } });
  return data.id;
}

// Imports the Facebook Pages (and linked Instagram business accounts) the
// Meta token can manage; page tokens are stored encrypted.
export async function importMetaAccounts(bos: BosUser) {
  need(bos, "social.manage");
  const conn = await resolveConnection("meta").catch(() => null);
  if (!conn) throw new ValidationError("اربط Meta في مركز التكاملات أولاً.");
  const res = await listMetaPages({ connectionId: conn.connection.id, actorId: bos.userId }, conn.secrets.access_token);
  if (!res.ok) throw new ValidationError(`تعذر جلب الصفحات: ${res.error}`);
  let n = 0;
  for (const p of res.pages) {
    const token_enc = await encryptSecrets({ token: p.access_token });
    const rows = [
      { platform: "facebook", external_id: p.id, name: p.name, handle: null, avatar_url: p.picture?.data?.url ?? null, profile_url: p.link ?? `https://www.facebook.com/${p.id}` },
      ...(p.instagram_business_account ? [{ platform: "instagram", external_id: p.instagram_business_account.id, name: p.instagram_business_account.username ?? p.name, handle: p.instagram_business_account.username ? `@${p.instagram_business_account.username}` : null, avatar_url: p.instagram_business_account.profile_picture_url ?? null, profile_url: p.instagram_business_account.username ? `https://www.instagram.com/${p.instagram_business_account.username}` : null }] : []),
    ];
    for (const r of rows) {
      const { data: existing } = await db().from("social_accounts").select("id").eq("platform", r.platform).eq("external_id", r.external_id).maybeSingle();
      const patch = { ...r, mode: "api", status: "connected", connection_id: conn.connection.id, token_enc, last_error: null, is_active: true };
      if (existing) await db().from("social_accounts").update(patch).eq("id", existing.id);
      else await db().from("social_accounts").insert({ ...patch, connected_by: bos.userId });
      n++;
    }
  }
  await audit({ actorId: bos.userId, action: "social.accounts_imported", entityType: "social_account", entityId: null, newValue: { provider: "meta", count: n } });
  return n;
}

export async function addTelegramChannel(bos: BosUser, chat: string) {
  need(bos, "social.manage");
  const id = chat.trim();
  if (!/^(@[A-Za-z0-9_]{5,32}|-?\d{5,20})$/.test(id)) throw new ValidationError("اكتب معرّف القناة مثل ‎@mychannel أو رقمها.", { chat: "غير صالح" });
  const conn = await resolveConnection("telegram").catch(() => null);
  if (!conn) throw new ValidationError("اربط بوت تيليجرام في مركز التكاملات أولاً.");
  const r = await telegramChat({ connectionId: conn.connection.id, actorId: bos.userId }, conn.secrets.bot_token, id);
  if (!r.ok) throw new ValidationError(`تعذر الوصول للقناة: ${r.error}. تأكد أن البوت مشرف فيها.`);
  const external = r.chat.username ? `@${r.chat.username}` : String(r.chat.id);
  const row = { platform: "telegram", mode: "api", status: "connected", connection_id: conn.connection.id, external_id: external, name: r.chat.title ?? external, handle: r.chat.username ? `@${r.chat.username}` : null, profile_url: r.chat.username ? `https://t.me/${r.chat.username}` : null, is_active: true, last_error: null };
  const { data: existing } = await db().from("social_accounts").select("id").eq("platform", "telegram").eq("external_id", external).maybeSingle();
  const accId = existing ? (await db().from("social_accounts").update(row).eq("id", existing.id), existing.id) : (await db().from("social_accounts").insert({ ...row, connected_by: bos.userId }).select("id").single()).data!.id;
  await audit({ actorId: bos.userId, action: "social.account_added", entityType: "social_account", entityId: accId, newValue: { platform: "telegram", external } });
  return accId;
}

export async function setAccountActive(bos: BosUser, id: string, active: boolean) {
  need(bos, "social.manage");
  await db().from("social_accounts").update({ is_active: active, ...(active ? {} : { status: "disconnected" }) }).eq("id", id);
  await audit({ actorId: bos.userId, action: active ? "social.account_enabled" : "social.account_disconnected", entityType: "social_account", entityId: id });
}

async function accountToken(a: Pick<SocialAccount, "platform" | "token_enc" | "connection_id">): Promise<string | null> {
  if (a.platform === "telegram") {
    const conn = await resolveConnection("telegram", a.connection_id).catch(() => null);
    return conn?.secrets.bot_token ?? null;
  }
  if (!a.token_enc) return null;
  return (await decryptSecrets(a.token_enc)).token ?? null;
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export interface PostInput {
  title: string;
  base_text: string;
  hashtags: string[];
  media: MediaItem[];
  link_url: string | null;
  scheduled_at: string | null;
  campaign: string | null;
  targets: { account_id: string; text_override: string | null }[];
}

function cleanInput(i: PostInput): PostInput {
  if (!i.title.trim()) throw new ValidationError("عنوان المنشور مطلوب.", { title: "مطلوب" });
  if (i.base_text.length > 63206) throw new ValidationError("النص طويل جداً.");
  if (i.media.length > 10) throw new ValidationError("الحد الأقصى 10 وسائط.");
  for (const m of i.media) if (!/^https:\/\/\S+$/.test(m.url)) throw new ValidationError("روابط الوسائط يجب أن تكون https.", { media: "غير صالح" });
  if (i.link_url && !/^https?:\/\/\S+$/.test(i.link_url)) throw new ValidationError("الرابط غير صالح.", { link_url: "غير صالح" });
  if (i.scheduled_at && Number.isNaN(Date.parse(i.scheduled_at))) throw new ValidationError("موعد غير صالح.");
  const hashtags = [...new Set(i.hashtags.map((h) => h.trim().replace(/^#/, "").toLowerCase()).filter((h) => /^[\p{L}\p{N}_]{1,80}$/u.test(h)))].slice(0, 30);
  const seen = new Set<string>();
  const targets = i.targets.filter((t) => !seen.has(t.account_id) && seen.add(t.account_id));
  return { ...i, title: i.title.trim().slice(0, 200), hashtags, targets };
}

async function assertOwnerOrScope(bos: BosUser, post: Pick<SocialPost, "owner_id" | "created_by">, perm: "social.update" | "social.read") {
  need(bos, perm);
  if (bos.permissions.get(perm) !== "all" && post.owner_id !== bos.userId && post.created_by !== bos.userId) throw new ForbiddenError();
}

export async function getPost(bos: BosUser, id: string) {
  const { data: post } = await db().from("social_posts").select("*").eq("id", id).maybeSingle();
  if (!post) throw new NotFoundError();
  await assertOwnerOrScope(bos, post, "social.read");
  const { data: targets } = await db().from("social_post_targets").select("*, social_accounts(id, platform, mode, name, handle, avatar_url, status), social_post_metrics(metric, value, source, fetched_at)").eq("post_id", id).order("created_at");
  return { post, targets: targets ?? [] };
}

export function previewTargets(input: Pick<PostInput, "base_text" | "hashtags" | "media">, targets: { platform: Platform; text_override: string | null }[]) {
  return targets.map((t) => {
    const text = composeText(input.base_text, t.text_override, input.hashtags);
    return { platform: t.platform, text, ...validateTarget(t.platform, text, input.media) };
  });
}

async function writeTargets(postId: string, targets: PostInput["targets"]) {
  const c = db();
  const { data: accounts } = await c.from("social_accounts").select("id, is_active").in("id", targets.map((t) => t.account_id).concat(["00000000-0000-0000-0000-000000000000"]));
  const active = new Set((accounts ?? []).filter((a) => a.is_active).map((a) => a.id));
  if (targets.some((t) => !active.has(t.account_id))) throw new ValidationError("أحد الحسابات المختارة غير متاح.");
  const { data: existing } = await c.from("social_post_targets").select("id, account_id, external_post_id").eq("post_id", postId);
  const keep = new Set(targets.map((t) => t.account_id));
  for (const e of existing ?? []) if (!keep.has(e.account_id)) {
    if (e.external_post_id) throw new ValidationError("لا يمكن إزالة حساب نُشر عليه المنشور بالفعل.");
    await c.from("social_post_targets").delete().eq("id", e.id);
  }
  for (const t of targets) {
    const ex = (existing ?? []).find((e) => e.account_id === t.account_id);
    if (ex) {
      if (!ex.external_post_id) await c.from("social_post_targets").update({ text_override: t.text_override?.trim() || null }).eq("id", ex.id);
    } else await c.from("social_post_targets").insert({ post_id: postId, account_id: t.account_id, text_override: t.text_override?.trim() || null });
  }
}

export async function createPost(bos: BosUser, raw: PostInput) {
  need(bos, "social.create");
  const i = cleanInput(raw);
  const { data, error } = await db().from("social_posts").insert({ title: i.title, base_text: i.base_text, hashtags: i.hashtags, media: i.media as never, link_url: i.link_url, scheduled_at: i.scheduled_at, campaign: i.campaign, owner_id: bos.userId, created_by: bos.userId }).select("*").single();
  if (error) throw error;
  await writeTargets(data.id, i.targets);
  await audit({ actorId: bos.userId, action: "social.post_created", entityType: "social_post", entityId: data.id, newValue: { title: i.title, targets: i.targets.length } });
  return data;
}

export async function updatePost(bos: BosUser, id: string, raw: PostInput) {
  const { data: before } = await db().from("social_posts").select("*").eq("id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  await assertOwnerOrScope(bos, before, "social.update");
  if (!EDITABLE.includes(before.status)) throw new ValidationError("لا يمكن تعديل المنشور في حالته الحالية.");
  const i = cleanInput(raw);
  const contentChanged = before.base_text !== i.base_text || JSON.stringify(before.media) !== JSON.stringify(i.media) || before.hashtags.join(",") !== i.hashtags.join(",");
  // Editing approved content sends it back for review (approvers may self-approve again).
  const status = ["approved", "scheduled"].includes(before.status) && contentChanged ? "draft" : before.status;
  await db().from("social_posts").update({ title: i.title, base_text: i.base_text, hashtags: i.hashtags, media: i.media as never, link_url: i.link_url, scheduled_at: i.scheduled_at, campaign: i.campaign, status, ...(status === "draft" ? { approved_by: null, approved_at: null } : {}) }).eq("id", id);
  await writeTargets(id, i.targets);
  if (status !== before.status) await recordStatus("social_post", id, before.status, status, bos.userId, "Content edited");
  await audit({ actorId: bos.userId, action: "social.post_updated", entityType: "social_post", entityId: id, newValue: { status, contentChanged } });
}

async function validateAll(postId: string) {
  const { data: post } = await db().from("social_posts").select("base_text, hashtags, media").eq("id", postId).single();
  const { data: targets } = await db().from("social_post_targets").select("text_override, social_accounts(platform)").eq("post_id", postId);
  if (!targets?.length) throw new ValidationError("اختر حساباً واحداً على الأقل.");
  const problems = previewTargets({ base_text: post!.base_text, hashtags: post!.hashtags, media: post!.media as unknown as MediaItem[] }, targets.map((t) => ({ platform: (t.social_accounts as unknown as { platform: Platform }).platform, text_override: t.text_override })))
    .filter((p) => p.errors.length)
    .map((p) => `${platforms[p.platform].label}: ${p.errors.join(" ")}`);
  if (problems.length) throw new ValidationError(problems.join(" | "));
}

async function setStatus(post: Pick<SocialPost, "id" | "status">, to: SocialPost["status"], actorId: string | null, reason?: string | null, patch: Partial<SocialPost> = {}) {
  await db().from("social_posts").update({ ...patch, status: to }).eq("id", post.id);
  await recordStatus("social_post", post.id, post.status, to, actorId, reason ?? null);
}

export async function submitForReview(bos: BosUser, id: string, reviewerId: string | null) {
  const { data: post } = await db().from("social_posts").select("*").eq("id", id).maybeSingle();
  if (!post) throw new NotFoundError();
  await assertOwnerOrScope(bos, post, "social.update");
  if (!["draft", "changes_requested"].includes(post.status)) throw new ValidationError("المنشور ليس مسودة.");
  await validateAll(id);
  await setStatus(post, "in_review", bos.userId, null, { reviewer_id: reviewerId });
  await emitEvent({ type: "social.post_submitted", entityType: "social_post", entityId: id, summary: `Post for review: ${post.title}`, actorId: bos.userId, payload: { title: post.title, assignee_user_id: reviewerId } });
}

export async function reviewPost(bos: BosUser, id: string, decision: "approve" | "changes", note: string | null) {
  need(bos, "social.approve");
  const { data: post } = await db().from("social_posts").select("*").eq("id", id).maybeSingle();
  if (!post) throw new NotFoundError();
  const selfApprove = post.status === "draft" && decision === "approve";
  if (post.status !== "in_review" && !selfApprove) throw new ValidationError("المنشور ليس بانتظار المراجعة.");
  if (decision === "changes" && !note?.trim()) throw new ValidationError("اكتب الملاحظات المطلوبة.", { note: "مطلوب" });
  if (decision === "approve") await validateAll(id);
  await setStatus(post, decision === "approve" ? "approved" : "changes_requested", bos.userId, note, decision === "approve" ? { approved_by: bos.userId, approved_at: nowIso(), review_note: note } : { review_note: note });
  await audit({ actorId: bos.userId, action: `social.post_${decision === "approve" ? "approved" : "changes_requested"}`, entityType: "social_post", entityId: id, reason: note ?? null });
  await emitEvent({ type: "social.post_reviewed", entityType: "social_post", entityId: id, summary: `${decision === "approve" ? "Approved" : "Changes requested"}: ${post.title}`, actorId: bos.userId, payload: { title: post.title, note: note ?? (decision === "approve" ? "✓" : ""), owner_user_id: post.owner_id } });
}

export async function schedulePost(bos: BosUser, id: string, at: string) {
  const { data: post } = await db().from("social_posts").select("*").eq("id", id).maybeSingle();
  if (!post) throw new NotFoundError();
  await assertOwnerOrScope(bos, post, "social.update");
  if (post.status !== "approved" && post.status !== "scheduled") throw new ValidationError("يجب اعتماد المنشور قبل جدولته.");
  const t = Date.parse(at);
  if (Number.isNaN(t) || t < nowMs() + 60_000) throw new ValidationError("اختر موعداً مستقبلياً.");
  await setStatus(post, "scheduled", bos.userId, null, { scheduled_at: new Date(t).toISOString() });
}

export async function cancelPost(bos: BosUser, id: string) {
  const { data: post } = await db().from("social_posts").select("*").eq("id", id).maybeSingle();
  if (!post) throw new NotFoundError();
  await assertOwnerOrScope(bos, post, "social.update");
  if (["published", "publishing", "cancelled"].includes(post.status)) throw new ValidationError("لا يمكن إلغاء المنشور في حالته الحالية.");
  await setStatus(post, "cancelled", bos.userId);
}

export async function publishNow(bos: BosUser, id: string) {
  const { data: post } = await db().from("social_posts").select("*").eq("id", id).maybeSingle();
  if (!post) throw new NotFoundError();
  await assertOwnerOrScope(bos, post, "social.update");
  if (!["approved", "scheduled", "partially_published", "failed"].includes(post.status)) throw new ValidationError("يجب اعتماد المنشور قبل النشر.");
  return runPublish(id, bos.userId);
}

// Publishes every target that isn't published yet. A target with a platform
// post id is skipped (safe retry — no duplicate posts).
export async function runPublish(postId: string, actorId: string | null) {
  const c = db();
  const { data: claimed } = await c.from("social_posts").update({ status: "publishing" }).eq("id", postId).in("status", ["approved", "scheduled", "partially_published", "failed"]).select("*").maybeSingle();
  if (!claimed) return null; // another worker has it, or not publishable
  const { data: targets } = await c.from("social_post_targets").select("*, social_accounts(*)").eq("post_id", postId);
  const media = claimed.media as unknown as MediaItem[];
  for (const t of targets ?? []) {
    if (t.external_post_id || t.status === "published" || t.status === "cancelled") continue;
    const acc = t.social_accounts as unknown as SocialAccount;
    const spec = platforms[acc.platform as Platform];
    const text = composeText(claimed.base_text, t.text_override, claimed.hashtags);
    if (acc.mode === "manual" || spec.publish === "manual") {
      await c.from("social_post_targets").update({ status: "manual_pending", error: null }).eq("id", t.id);
      continue;
    }
    const v = validateTarget(acc.platform as Platform, text, media);
    if (v.errors.length) {
      await c.from("social_post_targets").update({ status: "failed", error: v.errors.join(" "), next_attempt_at: null }).eq("id", t.id);
      continue;
    }
    await c.from("social_post_targets").update({ status: "publishing" }).eq("id", t.id);
    const token = await accountToken(acc).catch(() => null);
    let res: PublishResult;
    if (!token || !acc.external_id || !acc.is_active) res = { ok: false, error: "Blocked by provider: account not connected", retryable: false };
    else if (acc.platform === "facebook") res = await publishFacebook({ connectionId: acc.connection_id, actorId }, token, acc.external_id, text, media, claimed.link_url);
    else if (acc.platform === "instagram") res = await publishInstagram({ connectionId: acc.connection_id, actorId }, token, acc.external_id, text, media);
    else if (acc.platform === "telegram") res = await publishTelegram({ connectionId: acc.connection_id, actorId }, token, acc.external_id, text, media);
    else res = { ok: false, error: "No API adapter", retryable: false };
    const attempts = t.attempts + 1;
    if (res.ok) await c.from("social_post_targets").update({ status: "published", external_post_id: res.externalId, post_url: res.url, published_at: nowIso(), error: null, attempts, next_attempt_at: null }).eq("id", t.id);
    else {
      const retry = res.retryable && attempts < MAX_ATTEMPTS;
      await c.from("social_post_targets").update({ status: "failed", error: res.error.slice(0, 500), attempts, next_attempt_at: retry ? new Date(nowMs() + attempts * 10 * 60_000).toISOString() : null }).eq("id", t.id);
      if (!res.retryable && /token|OAuth|permission|not connected/i.test(res.error)) await c.from("social_accounts").update({ status: "error", last_error: res.error.slice(0, 300) }).eq("id", acc.id);
    }
  }
  return settlePost(postId, actorId);
}

async function settlePost(postId: string, actorId: string | null) {
  const c = db();
  const { data: post } = await c.from("social_posts").select("*").eq("id", postId).single();
  const { data: ts } = await c.from("social_post_targets").select("status, error").eq("post_id", postId);
  const s = (ts ?? []).map((t) => t.status);
  const published = s.filter((x) => x === "published").length;
  const failed = s.filter((x) => x === "failed").length;
  const pending = s.filter((x) => x === "manual_pending" || x === "pending" || x === "publishing").length;
  // Nothing published and nothing failed = only manual targets left → "publishing" (waiting for staff).
  const finalTo: SocialPost["status"] = published === s.length ? "published" : published > 0 ? "partially_published" : failed > 0 ? "failed" : pending > 0 ? "publishing" : "failed";
  await c.from("social_posts").update({ status: finalTo, ...(published && !post!.published_at ? { published_at: nowIso() } : {}) }).eq("id", postId);
  await recordStatus("social_post", postId, post!.status, finalTo, actorId);
  if (failed) {
    const err = (ts ?? []).find((t) => t.status === "failed")?.error ?? "";
    await emitEvent({ type: "social.publish_failed", entityType: "social_post", entityId: postId, summary: `Publishing failed: ${post!.title}`, actorType: "system", payload: { title: post!.title, error: err, owner_user_id: post!.owner_id } });
  }
  return { status: finalTo, published, failed, manual: s.filter((x) => x === "manual_pending").length };
}

export async function retryTarget(bos: BosUser, targetId: string) {
  const { data: t } = await db().from("social_post_targets").select("*, social_posts(*)").eq("id", targetId).maybeSingle();
  if (!t) throw new NotFoundError();
  const post = t.social_posts as unknown as SocialPost;
  await assertOwnerOrScope(bos, post, "social.update");
  if (t.external_post_id) throw new ValidationError("نُشر بالفعل على هذه المنصة — لن يُنشر مرة أخرى.");
  if (t.status !== "failed") throw new ValidationError("إعادة المحاولة للأهداف الفاشلة فقط.");
  if (!["partially_published", "failed"].includes(post.status)) throw new ValidationError("حالة المنشور لا تسمح بإعادة المحاولة.");
  await db().from("social_post_targets").update({ status: "pending", attempts: Math.min(t.attempts, MAX_ATTEMPTS - 1), next_attempt_at: null }).eq("id", targetId);
  return runPublish(post.id, bos.userId);
}

export async function markManualPublished(bos: BosUser, targetId: string, url: string) {
  const { data: t } = await db().from("social_post_targets").select("*, social_posts(*)").eq("id", targetId).maybeSingle();
  if (!t) throw new NotFoundError();
  const post = t.social_posts as unknown as SocialPost;
  await assertOwnerOrScope(bos, post, "social.update");
  if (!["manual_pending", "failed", "pending"].includes(t.status)) throw new ValidationError("الهدف ليس بانتظار النشر اليدوي.");
  if (!/^https:\/\/\S+$/.test(url.trim())) throw new ValidationError("رابط المنشور يجب أن يبدأ بـ https://", { url: "غير صالح" });
  if (!["approved", "scheduled", "publishing", "partially_published", "failed"].includes(post.status)) throw new ValidationError("يجب اعتماد المنشور أولاً.");
  await db().from("social_post_targets").update({ status: "published", post_url: url.trim(), external_post_id: `manual:${url.trim().slice(0, 300)}`, published_at: nowIso(), error: null }).eq("id", targetId);
  await audit({ actorId: bos.userId, action: "social.manual_published", entityType: "social_post", entityId: post.id, newValue: { target: targetId, url } });
  return settlePost(post.id, bos.userId);
}

// Sweep: scheduled posts that are due + failed targets whose retry time came.
export async function publishDue(limit = 20) {
  const c = db();
  const { data: due } = await c.from("social_posts").select("id").eq("status", "scheduled").lte("scheduled_at", nowIso()).order("scheduled_at").limit(limit);
  const { data: retries } = await c.from("social_post_targets").select("post_id").eq("status", "failed").is("external_post_id", null).not("next_attempt_at", "is", null).lte("next_attempt_at", nowIso()).limit(limit);
  const ids = [...new Set([...(due ?? []).map((d) => d.id), ...(retries ?? []).map((r) => r.post_id)])];
  let n = 0;
  for (const id of ids) {
    if (await runPublish(id, null)) n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export async function recordManualMetrics(bos: BosUser, targetId: string, values: Partial<Record<MetricKey, number>>) {
  const { data: t } = await db().from("social_post_targets").select("id, status, social_posts(owner_id, created_by)").eq("id", targetId).maybeSingle();
  if (!t) throw new NotFoundError();
  await assertOwnerOrScope(bos, t.social_posts as unknown as SocialPost, "social.update");
  if (t.status !== "published") throw new ValidationError("سجّل الأرقام بعد النشر.");
  const rows = Object.entries(values).filter(([, v]) => typeof v === "number" && Number.isFinite(v) && v >= 0).map(([metric, value]) => ({ target_id: targetId, metric, value: Math.round(value as number), source: "manual", recorded_by: bos.userId, fetched_at: nowIso() }));
  if (!rows.length) throw new ValidationError("أدخل رقماً واحداً على الأقل.");
  await db().from("social_post_metrics").upsert(rows, { onConflict: "target_id,metric" });
  await db().from("social_post_targets").update({ metrics_synced_at: nowIso() }).eq("id", targetId);
}

export async function syncTargetMetrics(targetId: string) {
  const c = db();
  const { data: t } = await c.from("social_post_targets").select("*, social_accounts(*)").eq("id", targetId).maybeSingle();
  if (!t?.external_post_id || t.external_post_id.startsWith("manual:")) return 0;
  const acc = t.social_accounts as unknown as SocialAccount;
  if (!["facebook", "instagram"].includes(acc.platform)) return 0;
  const token = await accountToken(acc).catch(() => null);
  if (!token) return 0;
  const m = acc.platform === "facebook" ? await facebookPostMetrics({ connectionId: acc.connection_id }, token, t.external_post_id) : await instagramPostMetrics({ connectionId: acc.connection_id }, token, t.external_post_id);
  // Manual values are kept unless the API now provides that metric.
  const rows = Object.entries(m).map(([metric, value]) => ({ target_id: targetId, metric, value: value as number, source: "api", recorded_by: null, fetched_at: nowIso() }));
  if (rows.length) await c.from("social_post_metrics").upsert(rows, { onConflict: "target_id,metric" });
  await c.from("social_post_targets").update({ metrics_synced_at: nowIso() }).eq("id", targetId);
  return rows.length;
}

export async function syncAccountFollowers(accountId: string) {
  const c = db();
  const { data: acc } = await c.from("social_accounts").select("*").eq("id", accountId).maybeSingle();
  if (!acc || acc.mode !== "api" || !acc.external_id || !acc.is_active) return false;
  const token = await accountToken(acc).catch(() => null);
  if (!token) return false;
  const n = await accountFollowers({ connectionId: acc.connection_id }, acc.platform, token, acc.external_id);
  if (n === null) {
    await c.from("social_accounts").update({ last_sync_at: nowIso(), last_error: "Followers not available from the API" }).eq("id", accountId);
    return false;
  }
  await c.from("social_account_metrics").upsert({ account_id: accountId, day: new Date().toISOString().slice(0, 10), metric: "followers", value: n, source: "api", fetched_at: nowIso() }, { onConflict: "account_id,day,metric" });
  await c.from("social_accounts").update({ last_sync_at: nowIso(), last_error: null, status: "connected" }).eq("id", accountId);
  return true;
}

// Sweep: posts published in the last 30 days not synced for 6 h; followers daily.
export async function syncSocialMetrics(limit = 40) {
  const c = db();
  const since = new Date(nowMs() - 30 * 86400_000).toISOString();
  const stale = new Date(nowMs() - 6 * 3600_000).toISOString();
  const { data: ts } = await c.from("social_post_targets").select("id").eq("status", "published").gte("published_at", since).or(`metrics_synced_at.is.null,metrics_synced_at.lt.${stale}`).limit(limit);
  let n = 0;
  for (const t of ts ?? []) n += await syncTargetMetrics(t.id).catch(() => 0);
  const today = new Date().toISOString().slice(0, 10);
  const { data: accs } = await c.from("social_accounts").select("id").eq("mode", "api").eq("is_active", true);
  const { data: done } = await c.from("social_account_metrics").select("account_id").eq("day", today).eq("metric", "followers");
  const had = new Set((done ?? []).map((d) => d.account_id));
  for (const a of accs ?? []) if (!had.has(a.id)) await syncAccountFollowers(a.id).catch(() => false);
  return n;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface AnalyticsFilter { from: string; to: string; platform?: string | null; account_id?: string | null }

export async function socialAnalytics(bos: BosUser, f: AnalyticsFilter) {
  need(bos, "social.read");
  const c = db();
  let q = c.from("social_post_targets").select("id, post_id, published_at, post_url, social_accounts!inner(id, platform, name), social_posts!inner(title, number), social_post_metrics(metric, value, source, fetched_at)").eq("status", "published").gte("published_at", f.from).lte("published_at", f.to);
  if (f.platform) q = q.eq("social_accounts.platform", f.platform);
  if (f.account_id) q = q.eq("account_id", f.account_id);
  const { data } = await q.limit(2000);
  type Row = { id: string; post_id: string; published_at: string | null; post_url: string | null; social_accounts: { id: string; platform: Platform; name: string }; social_posts: { title: string; number: string }; social_post_metrics: { metric: MetricKey; value: number; source: string; fetched_at: string }[] };
  const rows = (data ?? []) as unknown as Row[];
  const byPlatform = new Map<Platform, { posts: number; metrics: Partial<Record<MetricKey, number>>; available: Set<MetricKey> }>();
  const posts = rows.map((r) => {
    const m: Partial<Record<MetricKey, number>> = {};
    for (const x of r.social_post_metrics) m[x.metric] = Number(x.value);
    const p = byPlatform.get(r.social_accounts.platform) ?? { posts: 0, metrics: {}, available: new Set<MetricKey>() };
    p.posts++;
    for (const [k, v] of Object.entries(m) as [MetricKey, number][]) {
      p.metrics[k] = (p.metrics[k] ?? 0) + v;
      p.available.add(k);
    }
    byPlatform.set(r.social_accounts.platform, p);
    const last = r.social_post_metrics.reduce<string | null>((a, x) => (!a || x.fetched_at > a ? x.fetched_at : a), null);
    return { targetId: r.id, postId: r.post_id, title: r.social_posts.title, number: r.social_posts.number, platform: r.social_accounts.platform, account: r.social_accounts.name, url: r.post_url, publishedAt: r.published_at, metrics: m, engagement: engagementRate(m), sources: [...new Set(r.social_post_metrics.map((x) => x.source))], lastSync: last };
  });
  // Followers growth over the range (first vs last daily value per account).
  const { data: fol } = await c.from("social_account_metrics").select("account_id, day, value").eq("metric", "followers").gte("day", f.from.slice(0, 10)).lte("day", f.to.slice(0, 10)).order("day");
  const growth = new Map<string, { first: number; last: number }>();
  for (const r of fol ?? []) {
    const g = growth.get(r.account_id);
    if (!g) growth.set(r.account_id, { first: Number(r.value), last: Number(r.value) });
    else g.last = Number(r.value);
  }
  return {
    platforms: [...byPlatform.entries()].map(([platform, p]) => ({ platform, posts: p.posts, metrics: p.metrics, available: [...p.available], engagement: engagementRate(p.metrics) })),
    posts: posts.sort((a, b) => (b.engagement ?? -1) - (a.engagement ?? -1)),
    followers: [...growth.entries()].map(([account_id, g]) => ({ account_id, first: g.first, last: g.last, change: g.last - g.first })),
  };
}

export async function calendarPosts(bos: BosUser, from: string, to: string) {
  need(bos, "social.read");
  let q = db().from("social_posts").select("id, number, title, status, scheduled_at, published_at, created_at, owner_id, social_post_targets(status, social_accounts(platform))").neq("status", "cancelled").or(`and(scheduled_at.gte.${from},scheduled_at.lte.${to}),and(published_at.gte.${from},published_at.lte.${to}),and(scheduled_at.is.null,published_at.is.null,created_at.gte.${from},created_at.lte.${to})`).order("scheduled_at", { ascending: true, nullsFirst: false }).limit(500);
  const { data } = await q;
  const all = bos.permissions.get("social.read") === "all";
  return (data ?? []).filter((p) => all || p.owner_id === bos.userId);
}
