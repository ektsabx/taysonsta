// Master upgrade Phase 10 (docs/bos/30 §12; doc 31): social accounts, posts
// with per-platform versions, review/approval, publish (Facebook, Instagram,
// Telegram adapters with provider HTTP stubbed at fetch), manual platforms,
// safe retry, scheduling via the sweep, metrics (API + manual), analytics.
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { encryptSecrets } from "@/lib/bos/secrets";
import { saveConnection } from "@/services/bos/integrations";
import {
  addTelegramChannel, createPost, getPost, markManualPublished, publishDue, publishNow, recordManualMetrics, retryTarget, reviewPost,
  saveManualAccount, schedulePost, socialAnalytics, submitForReview, syncTargetMetrics, updatePost, type PostInput,
} from "@/services/bos/social";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
const realFetch = globalThis.fetch;
after(async () => {
  globalThis.fetch = realFetch;
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

const calls: { url: string; body: string }[] = [];
let fail: RegExp | null = null; // URLs that answer 500
const accounts: Record<string, string> = {};
const posts: string[] = [];
const tag = uniq("soc");

before(async () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (url.startsWith("https://graph.facebook.com/") || url.startsWith("https://api.telegram.org/")) {
      calls.push({ url, body: String(init?.body ?? "") });
      if (fail?.test(url)) return json({ error: { message: "Service temporarily unavailable" } }, 500);
      if (url.includes("/getChat?")) return json({ ok: true, result: { id: -100123, title: "Taysonsta News", username: `tnews_${tag.slice(-4)}` } });
      if (url.includes("/sendMessage") || url.includes("/sendPhoto")) return json({ ok: true, result: { message_id: 42, chat: { username: `tnews_${tag.slice(-4)}` } } });
      if (url.endsWith("/feed")) return json({ id: `PAGE1_${uniq("p")}` });
      if (url.endsWith("/photos")) return json({ id: uniq("photo"), post_id: `PAGE1_${uniq("p")}` });
      if (url.endsWith("/media")) return json({ id: `CONT_${uniq("c")}` });
      if (url.endsWith("/media_publish")) return json({ id: `IGM_${uniq("m")}` });
      if (url.includes("fields=permalink")) return json({ permalink: "https://www.instagram.com/p/abc/" });
      if (url.includes("fields=likes.summary")) return json({ likes: { summary: { total_count: 120 } }, comments: { summary: { total_count: 8 } }, shares: { count: 5 } });
      if (url.includes("/insights?metric=post_impressions")) return json({ data: [{ name: "post_impressions", values: [{ value: 3000 }] }, { name: "post_impressions_unique", values: [{ value: 2000 }] }] });
      return json({});
    }
    return realFetch(input, init);
  }) as typeof fetch;

  const admin = await bosUserFor("admin@taysonsta.local");
  const tg = await saveConnection(admin, null, { provider: "telegram", label: uniq("TG"), config: {}, secrets: { bot_token: "123:ABC" } });
  cleanup.push(async () => {
    const c = db();
    if (posts.length) await c.from("social_posts").delete().in("id", posts);
    await c.from("social_accounts").delete().in("id", Object.values(accounts));
    await c.from("integration_logs").delete().eq("connection_id", tg);
    await c.from("integration_connections").delete().eq("id", tg);
  });
  accounts.telegram = await addTelegramChannel(admin, "@tnews_chan");
  const token_enc = await encryptSecrets({ token: "PAGE_TOKEN" });
  const ins = async (platform: string, external_id: string) => (await db().from("social_accounts").insert({ platform, mode: "api", status: "connected", name: `${platform} ${tag}`, external_id: `${external_id}_${tag}`, token_enc }).select("id").single()).data!.id;
  accounts.facebook = await ins("facebook", "PAGE1");
  accounts.instagram = await ins("instagram", "IG1");
  accounts.linkedin = await saveManualAccount(admin, { platform: "linkedin", name: `LinkedIn ${tag}` });
});

const input = (o: Partial<PostInput> = {}): PostInput => ({ title: `Launch ${tag}`, base_text: "We launched our new site! #Taysonsta", hashtags: ["design"], media: [], link_url: null, scheduled_at: null, campaign: null, targets: [], ...o });

test("access, validation per platform, review cycle", async () => {
  const [admin, designer, dev] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("nour@taysonsta.local"), bosUserFor("youssef.dev@taysonsta.local")]);
  await assert.rejects(createPost(dev, input()), ForbiddenError);
  const p = await createPost(designer, input({ targets: [{ account_id: accounts.facebook, text_override: null }, { account_id: accounts.instagram, text_override: "IG version" }] }));
  posts.push(p.id);
  await assert.rejects(submitForReview(designer, p.id, admin.userId), (e: unknown) => e instanceof ValidationError && /إنستجرام/.test(e.message), "Instagram needs media");
  await updatePost(designer, p.id, input({ media: [{ url: "https://cdn.example.com/launch.jpg", type: "image" }], targets: [{ account_id: accounts.facebook, text_override: null }, { account_id: accounts.instagram, text_override: "IG version" }] }));
  await submitForReview(designer, p.id, admin.userId);
  await assert.rejects(reviewPost(designer, p.id, "approve", null), ForbiddenError, "designers can't approve");
  await assert.rejects(reviewPost(admin, p.id, "changes", " "), ValidationError, "notes required");
  await reviewPost(admin, p.id, "changes", "Shorter caption");
  assert.equal((await getPost(admin, p.id)).post.status, "changes_requested");
  await submitForReview(designer, p.id, admin.userId);
  await reviewPost(admin, p.id, "approve", null);
  // Editing approved content sends it back to draft.
  await updatePost(designer, p.id, input({ base_text: "Edited text", media: [{ url: "https://cdn.example.com/launch.jpg", type: "image" }], targets: [{ account_id: accounts.facebook, text_override: null }, { account_id: accounts.instagram, text_override: null }] }));
  assert.equal((await getPost(admin, p.id)).post.status, "draft");
  await assert.rejects(publishNow(designer, p.id), ValidationError, "must be approved first");
});

test("publish: Facebook + Telegram via API, LinkedIn manual, Instagram retry, safe retry, metrics, analytics", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const p = await createPost(admin, input({ media: [{ url: "https://cdn.example.com/launch.jpg", type: "image" }], targets: [
    { account_id: accounts.facebook, text_override: null },
    { account_id: accounts.instagram, text_override: null },
    { account_id: accounts.telegram, text_override: "Telegram version" },
    { account_id: accounts.linkedin, text_override: null },
  ] }));
  posts.push(p.id);
  await reviewPost(admin, p.id, "approve", null); // approvers may self-approve a draft
  fail = /\/media$/; // Instagram container creation fails (5xx)
  const r = await publishNow(admin, p.id);
  fail = null;
  assert.equal(r!.status, "partially_published");
  const photo = calls.find((c) => c.url.endsWith(`/PAGE1_${tag}/photos`));
  assert.ok(photo, "Facebook photo endpoint used for image posts");
  assert.equal(JSON.parse(photo!.body).caption, "We launched our new site! #Taysonsta\n\n#design");
  const tgCall = calls.find((c) => c.url.includes("/sendPhoto"))!;
  assert.equal(JSON.parse(tgCall.body).caption, "Telegram version\n\n#design");

  let d = await getPost(admin, p.id);
  const byPlatform = (pl: string) => d.targets.find((t) => (t.social_accounts as unknown as { platform: string }).platform === pl)!;
  assert.equal(byPlatform("facebook").status, "published");
  assert.equal(byPlatform("telegram").post_url, `https://t.me/tnews_${tag.slice(-4)}/42`);
  assert.equal(byPlatform("linkedin").status, "manual_pending");
  assert.equal(byPlatform("instagram").status, "failed");
  assert.ok(byPlatform("instagram").next_attempt_at, "5xx → automatic retry scheduled");

  // Safe retry: a published target is never published again.
  const fbCalls = calls.filter((c) => c.url.includes("/photos")).length;
  await assert.rejects(retryTarget(admin, byPlatform("facebook").id), ValidationError);
  // Sweep retries the Instagram target when due.
  await db().from("social_post_targets").update({ next_attempt_at: new Date(Date.now() - 1000).toISOString() }).eq("id", byPlatform("instagram").id);
  assert.ok((await publishDue(10)) >= 1);
  assert.equal(calls.filter((c) => c.url.includes("/photos")).length, fbCalls, "Facebook not re-posted");
  d = await getPost(admin, p.id);
  assert.equal(byPlatform("instagram").status, "published");
  assert.equal(byPlatform("instagram").post_url, "https://www.instagram.com/p/abc/");

  // Manual platform: staff publish and log the URL.
  await assert.rejects(markManualPublished(admin, byPlatform("linkedin").id, "not-a-url"), ValidationError);
  const done = await markManualPublished(admin, byPlatform("linkedin").id, "https://www.linkedin.com/feed/update/urn:li:activity:1");
  assert.equal(done.status, "published");

  // Metrics: API sync for Facebook, manual for LinkedIn; unavailable stays missing.
  assert.ok((await syncTargetMetrics(byPlatform("facebook").id)) >= 4);
  await recordManualMetrics(admin, byPlatform("linkedin").id, { impressions: 900, likes: 30, comments: 2 });
  await assert.rejects(recordManualMetrics(admin, byPlatform("linkedin").id, {}), ValidationError);
  const a = await socialAnalytics(admin, { from: new Date(Date.now() - 3600_000).toISOString(), to: new Date(Date.now() + 60_000).toISOString() });
  const fb = a.platforms.find((x) => x.platform === "facebook")!;
  assert.equal(fb.metrics.likes, 120);
  assert.equal(fb.metrics.reach, 2000);
  assert.ok(!fb.available.includes("saves"), "Facebook saves not provided → not available");
  const tgRow = a.platforms.find((x) => x.platform === "telegram")!;
  assert.deepEqual(tgRow.available, [], "Telegram: nothing invented");
  const li = a.posts.find((x) => x.platform === "linkedin")!;
  assert.deepEqual(li.sources, ["manual"]);
  assert.equal(li.engagement, Math.round((32 / 900) * 10000) / 100);
});

test("scheduling: only approved posts, future times; the sweep publishes when due", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const p = await createPost(admin, input({ targets: [{ account_id: accounts.telegram, text_override: null }] }));
  posts.push(p.id);
  await assert.rejects(schedulePost(admin, p.id, new Date(Date.now() + 3600_000).toISOString()), ValidationError, "approve first");
  await reviewPost(admin, p.id, "approve", null);
  await assert.rejects(schedulePost(admin, p.id, new Date(Date.now() - 1000).toISOString()), ValidationError, "past time");
  await schedulePost(admin, p.id, new Date(Date.now() + 3600_000).toISOString());
  assert.equal(await publishDue(10).then(async () => (await getPost(admin, p.id)).post.status), "scheduled", "not due yet");
  await db().from("social_posts").update({ scheduled_at: new Date(Date.now() - 1000).toISOString() }).eq("id", p.id);
  await publishDue(10);
  assert.equal((await getPost(admin, p.id)).post.status, "published");
});
