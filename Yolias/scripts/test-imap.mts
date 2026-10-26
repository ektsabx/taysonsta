// IMAP/SMTP mailboxes (D-238) against local stand-in mail servers — nothing
// leaves this machine:
//   npm run test:imap
// Covers: the login check (good and bad password), sending over SMTP (auth,
// envelope, dot-stuffing, Message-ID / In-Reply-To / References for
// follow-ups), reading only the replies to our threads over IMAP (UTF-8,
// quoted-printable, quoted history dropped), bounces, our own messages
// skipped, and refusing private hosts and odd ports.
import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import type { AddressInfo } from "node:net";
process.env.YOLIAS_TEST_MAILBOX = "1";
const { imapProvider, verifyAccount } = await import("@/lib/mailbox/imap.ts");
const { checkEndpoint } = await import("@/lib/mailbox/socket.ts");

const USER = "sara@acme.test", PASS = "app-pass ✓";

// ── SMTP stand-in ──
const delivered: { from: string; to: string; data: string }[] = [];
const smtp = createServer((s: Socket) => {
  let buf = "", inData = false, from = "", to = "", data = "", authStep = 0;
  const say = (l: string) => s.write(`${l}\r\n`);
  s.on("error", () => {});
  say("220 smtp.acme.test ready");
  s.on("data", (d) => {
    buf += d.toString("utf8");
    let i;
    while ((i = buf.indexOf("\r\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 2);
      if (inData) {
        if (line === ".") { inData = false; delivered.push({ from, to, data }); say("250 queued"); }
        else data += `${line.startsWith("..") ? line.slice(1) : line}\r\n`;
        continue;
      }
      if (authStep === 1) { authStep = Buffer.from(line, "base64").toString() === USER ? 2 : 9; say("334 UGFzc3dvcmQ6"); continue; }
      if (authStep === 2 || authStep === 9) { const ok = authStep === 2 && Buffer.from(line, "base64").toString() === PASS; authStep = 0; say(ok ? "235 ok" : "535 bad credentials"); continue; }
      if (/^EHLO/i.test(line)) { say("250-smtp.acme.test"); say("250 AUTH LOGIN"); }
      else if (/^AUTH LOGIN/i.test(line)) { authStep = 1; say("334 VXNlcm5hbWU6"); }
      else if (/^MAIL FROM:<(.+)>/i.test(line)) { from = line.match(/<(.+)>/)![1]; say("250 ok"); }
      else if (/^RCPT TO:<(.+)>/i.test(line)) { to = line.match(/<(.+)>/)![1]; say("250 ok"); }
      else if (/^DATA/i.test(line)) { inData = true; data = ""; say("354 go"); }
      else if (/^QUIT/i.test(line)) { say("221 bye"); s.end(); }
      else say("500 ?");
    }
  });
});

// ── IMAP stand-in: an INBOX with a few messages ──
const inbox: { uid: number; raw: string }[] = [];
const imap = createServer((s: Socket) => {
  let buf = "";
  const say = (l: string) => s.write(`${l}\r\n`);
  s.on("error", () => {});
  say("* OK IMAP ready");
  s.on("data", (d) => {
    buf += d.toString("latin1");
    let i;
    while ((i = buf.indexOf("\r\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const [tag, cmd, ...rest] = line.split(" ");
      const args = rest.join(" ");
      if (/^LOGIN$/i.test(cmd)) {
        const m = args.match(/^"((?:[^"\\]|\\.)*)" "((?:[^"\\]|\\.)*)"$/);
        const ok = m && m[1] === USER && Buffer.from(m[2].replace(/\\(.)/g, "$1"), "latin1").toString("utf8") === PASS;
        say(ok ? `${tag} OK logged in` : `${tag} NO [AUTHENTICATIONFAILED] bad`);
      } else if (/^EXAMINE$/i.test(cmd)) say(`* ${inbox.length} EXISTS\r\n${tag} OK [READ-ONLY] done`);
      else if (/^UID$/i.test(cmd) && /^SEARCH/i.test(args)) say(`* SEARCH ${inbox.map((m) => m.uid).join(" ")}\r\n${tag} OK done`);
      else if (/^UID$/i.test(cmd) && /^FETCH/i.test(args)) {
        const uids = args.split(" ")[1].split(",").map(Number);
        const headersOnly = /HEADER\.FIELDS/i.test(args);
        for (const m of inbox.filter((x) => uids.includes(x.uid))) {
          const raw = headersOnly ? `${m.raw.split("\r\n\r\n")[0]}\r\n\r\n` : m.raw;
          const bytes = Buffer.from(raw, "utf8");
          s.write(`* ${m.uid} FETCH (UID ${m.uid} BODY[${headersOnly ? "HEADER.FIELDS (MESSAGE-ID)" : ""}] {${bytes.length}}\r\n`);
          s.write(bytes);
          s.write(")\r\n");
        }
        say(`${tag} OK done`);
      } else if (/^LOGOUT$/i.test(cmd)) { say("* BYE"); say(`${tag} OK`); s.end(); }
      else say(`${tag} BAD unknown`);
    }
  });
});

await new Promise<void>((r) => smtp.listen(0, "127.0.0.1", r));
await new Promise<void>((r) => imap.listen(0, "127.0.0.1", r));
const account = {
  email: USER, name: "Sara Ali", user: USER, pass: PASS,
  imap: { host: "127.0.0.1", port: (imap.address() as AddressInfo).port, security: "none" as const },
  smtp: { host: "127.0.0.1", port: (smtp.address() as AddressInfo).port, security: "none" as const },
};
const token = JSON.stringify(account);

try {
  // Login check.
  await verifyAccount(account);
  await assert.rejects(verifyAccount({ ...account, pass: "wrong" }), (e: Error & { kind?: string }) => e.kind === "auth");

  // Send: first message, then a follow-up in the same thread.
  const first = await imapProvider.send(token, { from: USER, fromName: "Sara Ali", to: "omar@client.test", subject: "Quick idea for Client Co", body: "Hi Omar,\n.\nA line starting with a dot." });
  assert.match(first.providerMessageId, /^<[0-9a-f-]+@acme\.test>$/);
  assert.equal(first.threadId, first.providerMessageId);
  const d1 = delivered.at(-1)!;
  assert.equal(d1.from, USER); assert.equal(d1.to, "omar@client.test");
  assert.match(d1.data, new RegExp(`Message-ID: ${first.providerMessageId}`));
  assert.match(d1.data, /From: "?Sara Ali"? <sara@acme\.test>|From: Sara Ali <sara@acme\.test>/);
  const body = Buffer.from(d1.data.split("\r\n\r\n")[1].replace(/\r\n/g, ""), "base64").toString("utf8");
  assert.equal(body, "Hi Omar,\r\n.\r\nA line starting with a dot.", "dot-stuffing round-trips");
  const second = await imapProvider.send(token, { from: USER, fromName: null, to: "omar@client.test", subject: "Re: Quick idea for Client Co", body: "Following up.", threadId: first.threadId, replyToProviderId: first.providerMessageId });
  assert.equal(second.threadId, first.threadId);
  assert.match(delivered.at(-1)!.data, new RegExp(`In-Reply-To: ${first.providerMessageId}`));
  assert.match(delivered.at(-1)!.data, new RegExp(`References: ${first.providerMessageId}`));

  // Replies: one to our thread (UTF-8, quoted-printable, quoted history), one unrelated, one of ours, one bounce.
  const qp = "=D8=B4=D9=83=D8=B1=D9=8B=D8=A7=D8=8C =D9=85=D9=87=D8=AA=D9=85.";
  inbox.push({ uid: 7, raw: `Message-ID: <reply-1@client.test>\r\nIn-Reply-To: ${second.providerMessageId}\r\nReferences: ${first.providerMessageId} ${second.providerMessageId}\r\nFrom: Omar <omar@client.test>\r\nSubject: =?UTF-8?B?${Buffer.from("رد: فكرة").toString("base64")}?=\r\nDate: Mon, 19 Oct 2026 10:00:00 +0000\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n${qp}\r\n\r\nOn Mon, Sara wrote:\r\n> Following up.\r\n` });
  inbox.push({ uid: 8, raw: "Message-ID: <news@shop.test>\r\nFrom: news@shop.test\r\nSubject: Sale\r\n\r\nBuy now\r\n" });
  inbox.push({ uid: 9, raw: `Message-ID: <self@acme.test>\r\nIn-Reply-To: ${first.providerMessageId}\r\nFrom: ${USER}\r\nSubject: note\r\n\r\nmine\r\n` });
  inbox.push({ uid: 10, raw: `Message-ID: <dsn-1@mx.test>\r\nFrom: Mail Delivery Subsystem <mailer-daemon@mx.test>\r\nSubject: Undeliverable: Quick idea\r\n\r\nYour message ${first.providerMessageId} could not be delivered to lost@client.test\r\n` });
  inbox.push({ uid: 11, raw: `Message-ID: <ooo-1@client.test>\r\nIn-Reply-To: ${first.providerMessageId}\r\nFrom: Laila <laila@client.test>\r\nSubject: Re: Quick idea\r\nAuto-Submitted: auto-replied\r\n\r\nAway until Monday.\r\n` });
  const replies = await imapProvider.replies(token, USER, [first.threadId]);
  const away = replies.find((r) => r.providerMessageId === "<ooo-1@client.test>");
  assert.ok(away?.autoReply && !away.bounce, "an Auto-Submitted reply is marked automatic");
  const reply = replies.find((r) => !r.bounce && !r.autoReply)!;
  assert.equal(replies.filter((r) => !r.bounce && !r.autoReply).length, 1, "only the reply to our thread, not our own message or the newsletter");
  assert.ok(!reply.autoReply, "a person's reply is not automatic");
  assert.equal(reply.threadId, first.threadId);
  assert.equal(reply.from, "omar@client.test"); assert.equal(reply.fromName, "Omar");
  assert.equal(reply.subject, "رد: فكرة");
  assert.equal(reply.body, "شكرًا، مهتم.", "decoded and without the quoted history");
  assert.equal(reply.providerMessageId, "<reply-1@client.test>");
  assert.ok(replies.some((r) => r.bounce && r.threadId === first.threadId), "the bounce is matched to its thread");
  assert.deepEqual(await imapProvider.replies(token, USER, []), []);

  // Only real mail servers.
  process.env.YOLIAS_TEST_MAILBOX = "0";
  assert.throws(() => checkEndpoint({ host: "127.0.0.1", port: 993, security: "tls" }, "imap"));
  assert.throws(() => checkEndpoint({ host: "mail.acme.local", port: 993, security: "tls" }, "imap"));
  assert.throws(() => checkEndpoint({ host: "imap.acme.com", port: 22, security: "tls" }, "imap"));
  assert.throws(() => checkEndpoint({ host: "smtp.acme.com", port: 465, security: "none" }, "smtp"));
  checkEndpoint({ host: "imap.acme.com", port: 993, security: "tls" }, "imap");
  checkEndpoint({ host: "smtp.acme.com", port: 587, security: "starttls" }, "smtp");

  console.log("✓ imap/smtp: login check, send + follow-up threading, dot-stuffing, replies only to our threads (UTF-8, QP, quotes dropped), bounces, own mail skipped, host/port rules");
} finally {
  smtp.close();
  imap.close();
}
