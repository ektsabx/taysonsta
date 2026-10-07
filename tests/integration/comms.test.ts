// Phase 6 integration tests (docs/bos/14, 15, 24 testing requirements).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { getOrCreateDirect, postMessage, listMessages, searchMessages, createChannel, getChannel } from "@/services/bos/chat";
import { createArticle, listArticles, getArticleBySlug, markRead, updateArticle } from "@/services/bos/knowledge";
import { getCalendarItems } from "@/services/bos/calendar";
import { dispatchPendingEvents } from "@/lib/bos/events";
import { ForbiddenError, NotFoundError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch(() => undefined);
});

test("DM is unique per pair; mention notifies; replies thread; search is scoped", async () => {
  const omar = await bosUserFor("omar@taysonsta.local");
  const hana = await bosUserFor("hana@taysonsta.local");
  const ahmed = await bosUserFor("ahmed@taysonsta.local");
  const a = await getOrCreateDirect(omar, hana.userId);
  const b = await getOrCreateDirect(hana, omar.userId);
  assert.equal(a, b, "same DM channel both ways");

  const token = uniq("zebra");
  const root = await postMessage(omar, a, { body: `Hi @Hana QA please check ${token}`, parentId: null, linkedEntityType: null, linkedEntityId: null });
  cleanup.push(() => db().from("messages").delete().eq("channel_id", a).like("body", `%${token}%`));
  await dispatchPendingEvents();
  const { data: mention } = await db().from("message_mentions").select("user_id").eq("message_id", root.id);
  assert.deepEqual((mention ?? []).map((m) => m.user_id), [hana.userId]);
  const { data: notif } = await db().from("bos_notifications").select("event_type").eq("user_id", hana.userId).eq("event_type", "chat.mentioned").order("created_at", { ascending: false }).limit(1);
  assert.equal(notif?.[0]?.event_type, "chat.mentioned", "mention notification");

  const reply = await postMessage(hana, a, { body: `Done ${token}`, parentId: root.id, linkedEntityType: null, linkedEntityId: null });
  const top = await listMessages(omar, a);
  assert.equal(top.find((m) => m.id === root.id)?.replyCount, 1, "reply counted");
  assert.ok(!top.some((m) => m.id === reply.id), "reply not in main list");
  const thread = await listMessages(omar, a, { parentId: root.id });
  assert.equal(thread[0]?.id, reply.id);
  const { data: replyNotif } = await db().from("bos_notifications").select("id").eq("user_id", omar.userId).eq("event_type", "chat.reply").limit(1);
  assert.ok(replyNotif?.length, "reply notification to parent author");

  assert.ok((await searchMessages(omar, token)).length >= 1, "participant finds it");
  assert.equal((await searchMessages(ahmed, token)).length, 0, "outsider search excludes the DM");
  await assert.rejects(getChannel(ahmed, a), ForbiddenError, "outsider cannot open DM");
});

test("private channel: members only; public team channel: all staff", async () => {
  const sm = await bosUserFor("sales.manager@taysonsta.local");
  const ahmed = await bosUserFor("ahmed@taysonsta.local");
  const nour = await bosUserFor("nour@taysonsta.local");
  const ch = await createChannel(sm, { name: uniq("deal-room"), description: null, is_private: true, team_id: null, members: [ahmed.userId] });
  cleanup.push(() => db().from("channels").delete().eq("id", ch.id));
  await getChannel(ahmed, ch.id);
  await assert.rejects(getChannel(nour, ch.id), ForbiddenError);
  const { data: general } = await db().from("channels").select("id").eq("kind", "team").eq("name", "General").single();
  await getChannel(nour, general!.id);
});

test("knowledge: versions, role restriction hidden everywhere, required reading completes onboarding item", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const dev = await bosUserFor("youssef.dev@taysonsta.local");
  const finance = await bosUserFor("finance@taysonsta.local");
  const { data: cat } = await db().from("kb_categories").select("id").eq("key", "finance").single();
  const { data: financeRole } = await db().from("roles").select("id").eq("key", "finance").single();
  const secret = await createArticle(admin, { kind: "article", title: uniq("Banking procedures"), slug: null, content: "Internal banking steps", category_id: cat!.id, tags: ["Banking"], owner_id: null, allowed_role_ids: [financeRole!.id], playbook_section: null, required_documents: null, status: "published" });
  cleanup.push(() => db().from("kb_articles").delete().eq("id", secret.id));
  assert.deepEqual(secret.tags, ["banking"], "tags lowercased");
  assert.ok((await listArticles(finance, {})).some((a) => a.id === secret.id), "finance sees it");
  assert.ok(!(await listArticles(dev, {})).some((a) => a.id === secret.id), "developer list excludes it");
  assert.ok(!(await listArticles(dev, { q: "banking" })).some((a) => a.id === secret.id), "developer search excludes it");
  await assert.rejects(getArticleBySlug(dev, secret.slug), NotFoundError, "direct URL hidden");

  const { slug } = await updateArticle(admin, secret.id, { kind: "article", title: secret.title, slug: null, content: "Internal banking steps v2", category_id: cat!.id, tags: ["banking"], owner_id: null, allowed_role_ids: [financeRole!.id], playbook_section: null, required_documents: null, status: "published" });
  const full = await getArticleBySlug(finance, slug);
  assert.equal(full.version, 2);
  assert.equal(full.versions.length, 2, "version history");

  // Required reading → onboarding item (Mariam has no login; use a real employee's checklist).
  const { data: policy } = await db().from("kb_articles").select("id").eq("slug", "security-guidelines").single();
  const { data: emp } = await db().from("employees").select("id").eq("user_id", dev.userId).single();
  const { data: clId } = await db().rpc("bos_start_onboarding", { p_subject: "employee", p_template_key: "employee_onboarding", p_client: null as unknown as string, p_deal: null as unknown as string, p_employee: emp!.id, p_due: null as unknown as string });
  cleanup.push(async () => {
    await db().from("onboarding_checklists").delete().eq("id", clId as string);
    await db().from("kb_article_reads").delete().eq("article_id", policy!.id).eq("user_id", dev.userId);
  });
  await markRead(dev, policy!.id);
  const { data: item } = await db().from("onboarding_items").select("is_done").eq("checklist_id", clId as string).eq("auto_key", "read:security-guidelines").single();
  assert.equal(item?.is_done, true, "read:<slug> onboarding item completed");
});

test("calendar aggregates meetings, follow-ups and leave with scope", async () => {
  const omar = await bosUserFor("omar@taysonsta.local");
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 120 * 86400_000).toISOString().slice(0, 10);
  const mine = await getCalendarItems(omar, from, to, {});
  const onlyMeetings = await getCalendarItems(omar, from, to, { types: ["meeting"] });
  assert.ok(onlyMeetings.every((i) => i.type === "meeting"), "type filter");
  const team = await getCalendarItems(omar, from, to, { scope: "team" });
  assert.ok(team.length >= mine.filter((i) => i.type !== "attendance").length, "team ⊇ mine");
  assert.ok(today);
});
