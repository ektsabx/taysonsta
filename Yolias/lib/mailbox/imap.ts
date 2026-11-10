import "server-only";
import { buildMessage, isAutoReply, isBounce, messageIds, parseAddress, parseHeaders, parseMessage, replyText } from "./mime";
import { checkEndpoint, LineConn, type Endpoint } from "./socket";
import { MailboxError, type IncomingMail, type MailboxProvider, type OutgoingMail } from "./types";

// Any mailbox with IMAP + SMTP (D-238): the member's own email account on
// their host (Zoho, Hostinger, GoDaddy, cPanel, Yahoo, iCloud, a company
// server…), connected with its server settings and password (usually an
// "app password"). Sending: SMTP, then a copy is appended to the mailbox's
// Sent folder so the member sees it in their own mail app. Replies: IMAP,
// read-only (EXAMINE), only messages that answer a thread Yolias started
// (In-Reply-To / References) are read. The settings and password are kept together in Supabase Vault (the
// mailbox's token), never in the database or the browser.

export interface ImapAccount {
  email: string;
  name: string | null;
  user: string;
  pass: string;
  imap: Endpoint;
  smtp: Endpoint;
}

export function parseAccount(token: string): ImapAccount {
  try {
    const a = JSON.parse(token) as ImapAccount;
    if (!a.email || !a.user || !a.pass || !a.imap?.host || !a.smtp?.host) throw new Error("incomplete");
    return a;
  } catch {
    throw new MailboxError("auth", "mailbox settings are missing");
  }
}

// ── SMTP ────────────────────────────────────────────────────────────────────

async function smtpReply(c: LineConn): Promise<{ code: number; text: string }> {
  const lines: string[] = [];
  for (;;) {
    const line = await c.readLine();
    lines.push(line);
    if (!/^\d{3}-/.test(line)) break;
  }
  const last = lines[lines.length - 1];
  return { code: Number(last.slice(0, 3)) || 0, text: lines.join("\n") };
}

async function smtpCmd(c: LineConn, cmd: string, ok: number[]): Promise<{ code: number; text: string }> {
  await c.write(`${cmd}\r\n`);
  const r = await smtpReply(c);
  if (!ok.includes(r.code)) {
    if (r.code === 535 || r.code === 534 || r.code === 530) throw new MailboxError("auth", `smtp auth ${r.code}`);
    if (r.code === 421 || r.code === 450 || r.code === 451 || r.code === 452) throw new MailboxError("rate", `smtp ${r.code}`);
    throw new MailboxError("rejected", `smtp ${r.code}: ${r.text.slice(0, 160)}`);
  }
  return r;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

/** Opens an authenticated SMTP session. */
async function smtpSession(a: ImapAccount): Promise<LineConn> {
  checkEndpoint(a.smtp, "smtp");
  const c = await LineConn.open(a.smtp);
  try {
    const hello = await smtpReply(c);
    if (hello.code !== 220) throw new MailboxError("unavailable", `smtp greeting ${hello.code}`);
    let ehlo = await smtpCmd(c, "EHLO yolias.com", [250]);
    if (a.smtp.security === "starttls") {
      await smtpCmd(c, "STARTTLS", [220]);
      await c.startTls(a.smtp.host);
      ehlo = await smtpCmd(c, "EHLO yolias.com", [250]);
    }
    if (/AUTH[ =][^\n]*PLAIN/i.test(ehlo.text)) {
      await smtpCmd(c, `AUTH PLAIN ${b64(`\u0000${a.user}\u0000${a.pass}`)}`, [235]);
    } else {
      await smtpCmd(c, "AUTH LOGIN", [334]);
      await smtpCmd(c, b64(a.user), [334]);
      await smtpCmd(c, b64(a.pass), [235]);
    }
    return c;
  } catch (e) {
    c.close();
    throw e;
  }
}

async function smtpSend(a: ImapAccount, to: string, message: string): Promise<void> {
  const c = await smtpSession(a);
  try {
    await smtpCmd(c, `MAIL FROM:<${a.email}>`, [250]);
    await smtpCmd(c, `RCPT TO:<${to}>`, [250, 251]);
    await smtpCmd(c, "DATA", [354]);
    // Dot-stuffing (RFC 5321 §4.5.2), then the end-of-data marker.
    await c.write(`${message.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..")}\r\n.\r\n`);
    const r = await smtpReply(c);
    if (r.code !== 250) throw new MailboxError(r.code >= 500 ? "rejected" : "rate", `smtp data ${r.code}`);
    await c.write("QUIT\r\n").catch(() => {});
  } finally {
    c.close();
  }
}

// ── IMAP ────────────────────────────────────────────────────────────────────

interface Untagged { text: string; literals: Buffer[] }

class Imap {
  private seq = 0;
  constructor(private c: LineConn) {}

  static async open(a: ImapAccount): Promise<Imap> {
    checkEndpoint(a.imap, "imap");
    const c = await LineConn.open(a.imap);
    const i = new Imap(c);
    try {
      const hello = await c.readLine();
      if (!/^\* (OK|PREAUTH)/i.test(hello)) throw new MailboxError("unavailable", "imap greeting");
      if (a.imap.security === "starttls") {
        await i.run("STARTTLS");
        await c.startTls(a.imap.host);
      }
      await i.run(`LOGIN ${quote(a.user)} ${quote(a.pass)}`).catch((e) => {
        throw e instanceof MailboxError && e.kind === "rejected" ? new MailboxError("auth", "imap login") : e;
      });
      return i;
    } catch (e) {
      c.close();
      throw e;
    }
  }

  /** Runs one command; returns its untagged responses (with literals). */
  async run(cmd: string): Promise<Untagged[]> {
    const tag = `Y${++this.seq}`;
    await this.c.write(`${tag} ${cmd}\r\n`);
    const out: Untagged[] = [];
    for (;;) {
      let line = await this.c.readLine();
      if (line.startsWith(`${tag} `)) {
        if (!/^\S+ OK/i.test(line)) throw new MailboxError("rejected", `imap: ${line.slice(0, 160)}`);
        return out;
      }
      const u: Untagged = { text: "", literals: [] };
      // A line ending in {n} is followed by n bytes, then the rest of the response.
      for (;;) {
        const m = line.match(/\{(\d+)\}$/);
        u.text += line;
        if (!m) break;
        u.literals.push(await this.c.readBytes(Number(m[1])));
        line = await this.c.readLine();
      }
      if (u.text.startsWith("*")) out.push(u);
    }
  }

  /** APPEND with a synchronizing literal: the server says "+" before the bytes. */
  async append(box: string, message: string): Promise<void> {
    const tag = `Y${++this.seq}`;
    const bytes = Buffer.byteLength(message, "utf8");
    await this.c.write(`${tag} APPEND ${quote(box)} (\\Seen) {${bytes}}\r\n`);
    for (;;) {
      const line = await this.c.readLine();
      if (line.startsWith("+")) break;
      if (line.startsWith(`${tag} `)) throw new MailboxError("rejected", `imap append: ${line.slice(0, 160)}`);
    }
    await this.c.write(`${message}\r\n`);
    for (;;) {
      const line = await this.c.readLine();
      if (line.startsWith(`${tag} `)) {
        if (!/^\S+ OK/i.test(line)) throw new MailboxError("rejected", `imap append: ${line.slice(0, 160)}`);
        return;
      }
    }
  }

  close() {
    this.c.write("Z LOGOUT\r\n").catch(() => {}).finally(() => this.c.close());
  }
}

const quote = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const imapDate = (d: Date) => `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;

/** Which side of the account failed the check, and why. */
export class VerifyError extends Error {
  constructor(public side: "imap" | "smtp", public kind: MailboxError["kind"] | "sender", message: string) {
    super(message);
  }
}
const wrap = (side: "imap" | "smtp", e: unknown) => new VerifyError(side, e instanceof MailboxError ? e.kind : "unavailable", e instanceof Error ? e.message : String(e));

/**
 * Checks the account works before it's saved: IMAP login and the inbox, SMTP
 * login, and that the SMTP server accepts this address as the sender (MAIL
 * FROM, then RSET: nothing is sent).
 */
export async function verifyAccount(a: ImapAccount): Promise<void> {
  try {
    const i = await Imap.open(a);
    try {
      await i.run("EXAMINE INBOX");
    } finally {
      i.close();
    }
  } catch (e) {
    throw wrap("imap", e);
  }
  let c: LineConn;
  try {
    c = await smtpSession(a);
  } catch (e) {
    throw wrap("smtp", e);
  }
  try {
    await smtpCmd(c, `MAIL FROM:<${a.email}>`, [250]).catch((e) => { throw new VerifyError("smtp", "sender", e instanceof Error ? e.message : "mail from"); });
    await smtpCmd(c, "RSET", [250]).catch(() => {});
    await c.write("QUIT\r\n").catch(() => {});
  } finally {
    c.close();
  }
}

/** The mailbox's Sent folder: the one marked \\Sent (RFC 6154), else a usual name. */
async function sentFolder(i: Imap): Promise<string | null> {
  const list = await i.run(`LIST "" "*"`).catch(() => [] as Untagged[]);
  const boxes = list.map((u) => {
    const m = u.text.match(/^\* LIST \(([^)]*)\) (?:"[^"]*"|NIL) (.+)$/i);
    if (!m) return null;
    const raw = m[2].trim();
    return { flags: m[1], name: raw.startsWith('"') ? raw.slice(1, -1).replace(/\\(["\\])/g, "$1") : raw };
  }).filter((b): b is { flags: string; name: string } => Boolean(b));
  const marked = boxes.find((b) => /\\Sent\b/i.test(b.flags));
  if (marked) return marked.name;
  const usual = ["Sent", "Sent Items", "Sent Messages", "INBOX.Sent", "INBOX/Sent", "Sent Mail"];
  return usual.map((n) => boxes.find((b) => b.name.toLowerCase() === n.toLowerCase())?.name).find(Boolean) ?? null;
}

/** Keeps a copy of a sent message in the Sent folder. A failure never fails the send. */
async function saveToSent(a: ImapAccount, message: string): Promise<void> {
  const i = await Imap.open(a);
  try {
    const box = await sentFolder(i);
    if (!box) return;
    await i.append(box, message.replace(/\r?\n/g, "\r\n"));
  } finally {
    i.close();
  }
}

/** Replies to our threads in the inbox, newest 300 messages of the last 30 days. */
async function imapReplies(a: ImapAccount, ownAddress: string, threadIds: string[]): Promise<IncomingMail[]> {
  if (!threadIds.length) return [];
  const want = new Map(threadIds.map((t) => [t.toLowerCase(), t]));
  const i = await Imap.open(a);
  try {
    await i.run("EXAMINE INBOX");
    const since = imapDate(new Date(Date.now() - 30 * 86_400_000));
    const found = await i.run(`UID SEARCH SINCE ${since}`);
    const uids = found.flatMap((u) => (u.text.match(/^\* SEARCH(.*)$/i)?.[1] ?? "").trim().split(/\s+/).filter(Boolean)).map(Number).filter(Number.isFinite).slice(-300);
    if (!uids.length) return [];
    const heads = await i.run(`UID FETCH ${uids.join(",")} (UID BODY.PEEK[HEADER.FIELDS (MESSAGE-ID IN-REPLY-TO REFERENCES FROM SUBJECT DATE)])`);
    const matches: { uid: number; thread: string; messageId: string; from: string; subject: string; date: string }[] = [];
    const bounces: number[] = [];
    for (const h of heads) {
      const uid = Number(h.text.match(/UID (\d+)/i)?.[1]);
      const head = parseHeaders(h.literals[0]?.toString("latin1") ?? "");
      const from = head.from ?? "";
      if (!uid || parseAddress(from).email === ownAddress.toLowerCase()) continue;
      const refs = [...messageIds(head["in-reply-to"]), ...messageIds(head.references)];
      const hit = refs.find((r) => want.has(r));
      if (hit) matches.push({ uid, thread: want.get(hit)!, messageId: messageIds(head["message-id"])[0] ?? `<uid-${uid}@imap>`, from, subject: head.subject ?? "", date: head.date ?? "" });
      else if (isBounce(from, head.subject ?? "")) bounces.push(uid);
    }
    const out: IncomingMail[] = [];
    for (const m of matches.slice(0, 50)) {
      const [body] = await i.run(`UID FETCH ${m.uid} (BODY.PEEK[])`);
      const parsed = parseMessage(body?.literals[0]?.toString("latin1") ?? "");
      const who = parseAddress(m.from);
      out.push({ providerMessageId: m.messageId, threadId: m.thread, from: who.email, fromName: who.name, subject: m.subject, body: replyText(parsed.text), receivedAt: new Date(Date.parse(m.date) || Date.now()).toISOString(), bounce: isBounce(m.from, m.subject), autoReply: isAutoReply((n) => parsed.headers[n] ?? "", m.subject) });
    }
    // A bounce quotes our message: it belongs to the thread whose id appears in it.
    for (const uid of bounces.slice(-20)) {
      const [body] = await i.run(`UID FETCH ${uid} (BODY.PEEK[])`);
      const raw = body?.literals[0]?.toString("latin1") ?? "";
      const hit = messageIds(raw).find((r) => want.has(r));
      if (!hit) continue;
      const parsed = parseMessage(raw);
      out.push({ providerMessageId: messageIds(parsed.headers["message-id"])[0] ?? `<bounce-${uid}@imap>`, threadId: want.get(hit)!, from: parseAddress(parsed.headers.from ?? "").email, fromName: null, subject: parsed.headers.subject ?? "", body: parsed.text.slice(0, 2000), receivedAt: new Date().toISOString(), bounce: true });
    }
    return out;
  } finally {
    i.close();
  }
}

export const imapProvider: MailboxProvider = {
  id: "imap",
  async configured() { return true; },
  async authorizeUrl() { throw new MailboxError("not_configured", "IMAP mailboxes are connected with their settings"); },
  async exchange() { throw new MailboxError("not_configured", "IMAP mailboxes are connected with their settings"); },
  // The "token" is the account itself, read from Vault.
  async accessToken(stored) { parseAccount(stored); return { token: stored, expiresAt: Date.now() + 3_600_000 }; },
  async send(token, mail: OutgoingMail) {
    const a = parseAccount(token);
    const domain = a.email.split("@")[1] ?? "yolias.com";
    const messageId = `<${crypto.randomUUID()}@${domain}>`;
    // Follow-ups answer the last message we sent and keep the whole thread in References.
    const refs = [...new Set([mail.threadId, mail.replyToProviderId].filter((x): x is string => Boolean(x)))];
    // The Sent copy carries no tracking pixel: opening it in the member's own mail app isn't an open.
    const base = { brand: mail.brand, files: mail.files, from: a.email, fromName: mail.fromName ?? a.name, to: mail.to, subject: mail.subject, body: mail.body, messageId, inReplyTo: mail.replyToProviderId ?? mail.threadId ?? null, references: refs, unsubscribeUrl: mail.unsubscribeUrl };
    await smtpSend(a, mail.to, buildMessage({ ...base, pixelUrl: mail.pixelUrl }));
    await saveToSent(a, buildMessage({ ...base, pixelUrl: null })).catch((e) => console.error("[imap] sent copy", e instanceof Error ? e.message : e));
    return { providerMessageId: messageId, threadId: mail.threadId ?? messageId };
  },
  async replies(token, ownAddress, threadIds) {
    return imapReplies(parseAccount(token), ownAddress, threadIds);
  },
};
