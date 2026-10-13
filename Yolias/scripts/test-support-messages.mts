// Contact messages and bug reports (lib/support/messages.ts) against the
// local Supabase, with a local stand-in for Resend (nothing is emailed):
//   npm run test:support-messages
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

// Resend stand-in: records what would have been sent; can be told to fail.
const sent: { to: string[]; subject: string; html: string }[] = [];
let failNext = false;
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (failNext) { failNext = false; res.writeHead(422, { "content-type": "application/json" }).end(JSON.stringify({ message: "rejected" })); return; }
    sent.push(JSON.parse(body));
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id: `em_${sent.length}` }));
  });
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
process.env.RESEND_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
process.env.RESEND_API_KEY = "re_local_test";
process.env.RESEND_FROM = "Yolias <no-reply@yolias.local>";

const { contactLimited, hashIp, notifyTeam, recentDuplicate, reportsLimited, NOTIFY_KEY } = await import("@/lib/support/messages.ts");
const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const tag = `support-test-${Date.now()}`;
const email = `${tag}@example.org`;
const { data: savedNotify } = await db.from("site_settings").select("value").eq("key", NOTIFY_KEY).maybeSingle();
const ids: string[] = [];

try {
  const ip = hashIp("203.0.113.7");
  assert.ok(ip && ip.length === 32 && !ip.includes("203"), "IP stored only as a hash");
  assert.equal(hashIp("203.0.113.7"), ip, "same address, same hash");

  // Stored with status New and kind contact.
  const insert = async (over: Partial<Database["public"]["Tables"]["contact_messages"]["Insert"]> = {}) => {
    const { data, error } = await db.from("contact_messages").insert({ name: "Test Sender", email, topic: "support", message: `Hello from ${tag} ${ids.length}`, ip_hash: ip, ...over }).select("*").single();
    if (error) throw error;
    ids.push(data.id);
    return data;
  };
  const first = await insert();
  assert.equal(first.kind, "contact"); assert.equal(first.status, "new"); assert.equal(first.notified_at, null);

  // Duplicate within minutes is found; a different text is not.
  assert.equal(await recentDuplicate(db, "contact", email, first.message), first.id);
  assert.equal(await recentDuplicate(db, "contact", email, "something else entirely"), null);

  // 5 messages an hour from one sender, then limited.
  assert.equal(await contactLimited(db, ip, email), false);
  for (let i = 0; i < 4; i++) await insert();
  assert.equal(await contactLimited(db, ip, email), true, "limited by email and IP");
  assert.equal(await contactLimited(db, hashIp("198.51.100.1"), `other-${email}`), false, "other senders are not");

  // Bug reports: per account per day.
  const { data: u } = await db.auth.admin.createUser({ email: `u-${email}`, email_confirm: true });
  const uid = u.user!.id;
  try {
    for (let i = 0; i < 10; i++) await insert({ kind: "bug_report", category: "bug", user_id: uid, email: `u-${email}`, message: `bug ${i} ${tag}` });
    assert.equal(await reportsLimited(db, uid), true);
  } finally {
    await db.from("contact_messages").update({ user_id: null }).eq("user_id", uid);
    const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", uid).maybeSingle();
    if (prof?.workspace_id) await db.from("workspaces").delete().eq("id", prof.workspace_id);
    await db.auth.admin.deleteUser(uid);
  }

  // Team email: none without an address; sent + recorded with one; a provider
  // rejection is not recorded as notified.
  await db.from("site_settings").delete().eq("key", NOTIFY_KEY);
  await notifyTeam(db, first);
  assert.equal(sent.length, 0);
  await db.from("site_settings").upsert({ key: NOTIFY_KEY, value: { email: "team@yolias.local" } });
  await notifyTeam(db, { ...first, message: `<script>alert(1)</script> ${first.message}` });
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ["team@yolias.local"]);
  assert.ok(!sent[0].html.includes("<script>"), "message text is escaped in the email");
  assert.ok((await db.from("contact_messages").select("notified_at").eq("id", first.id).single()).data!.notified_at);
  const second = await insert({ message: `second ${tag}` });
  failNext = true;
  await notifyTeam(db, second);
  assert.equal((await db.from("contact_messages").select("notified_at").eq("id", second.id).single()).data!.notified_at, null, "not marked notified when the provider refused");

  // Screenshots: private bucket that takes images only.
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const path = `test/${tag}.png`;
  assert.ifError((await db.storage.from("bug-screenshots").upload(path, png, { contentType: "image/png" })).error);
  const anon = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const pub = anon.storage.from("bug-screenshots").getPublicUrl(path).data.publicUrl;
  assert.notEqual((await fetch(pub)).status, 200, "not publicly readable");
  assert.ok((await db.storage.from("bug-screenshots").upload(`test/${tag}.html`, new TextEncoder().encode("<html>"), { contentType: "text/html" })).error, "non-images refused");
  await db.storage.from("bug-screenshots").remove([path]);

  // Visitors and members can't read messages (no public policies).
  const { data: leaked } = await anon.from("contact_messages").select("id").limit(1);
  assert.equal((leaked ?? []).length, 0);

  console.log("✓ support messages: stored as New, IP hashed, duplicates, per-sender and per-account limits, team email only when accepted and escaped, private image-only screenshots, no public reads");
} finally {
  if (ids.length) await db.from("contact_messages").delete().in("id", ids);
  if (savedNotify) await db.from("site_settings").upsert({ key: NOTIFY_KEY, value: savedNotify.value });
  else await db.from("site_settings").delete().eq("key", NOTIFY_KEY);
  server.close();
}
