// Plain-text email (RFC 5322) for the Gmail API, and helpers to read replies.

const b64url = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const utf8 = (s: string) => new TextEncoder().encode(s);

/** "=?UTF-8?B?...?=" for non-ASCII header values (subject, names). */
export function encodeHeader(v: string): string {
  return /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${btoa(String.fromCharCode(...utf8(v)))}?=`;
}

const clean = (v: string) => v.replace(/[\r\n]+/g, " ").trim();

export function buildRawEmail(m: { from: string; fromName: string | null; to: string; subject: string; body: string; inReplyTo?: string | null }): string {
  const headers = [
    `From: ${m.fromName ? `${encodeHeader(clean(m.fromName))} <${clean(m.from)}>` : clean(m.from)}`,
    `To: ${clean(m.to)}`,
    `Subject: ${encodeHeader(clean(m.subject))}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    ...(m.inReplyTo ? [`In-Reply-To: ${clean(m.inReplyTo)}`, `References: ${clean(m.inReplyTo)}`] : []),
  ];
  const body = btoa(String.fromCharCode(...utf8(m.body.replace(/\r?\n/g, "\r\n")))).replace(/(.{76})/g, "$1\r\n");
  return b64url(utf8(`${headers.join("\r\n")}\r\n\r\n${body}`));
}

export function decodeBase64Url(data: string): string {
  const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** "Name <a@b.com>" → { email, name }. */
export function parseAddress(v: string): { email: string; name: string | null } {
  const m = v.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { email: m[2].trim().toLowerCase(), name: m[1].trim() || null };
  return { email: v.trim().toLowerCase(), name: null };
}

/** The new part of a reply: drops the quoted history ("On … wrote:", "> …", Outlook's "From:" block). */
export function replyText(body: string): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) break;
    if (/^On .+wrote:\s*$/i.test(line) || /^في .+كتب:?\s*$/.test(line) || /^-{2,}\s*Original Message\s*-{2,}/i.test(line) || /^From:\s.+/i.test(line) && out.length > 0) break;
    out.push(line);
  }
  return out.join("\n").trim() || body.trim();
}

export function isBounce(from: string, subject: string): boolean {
  return /mailer-daemon|postmaster/i.test(from) || /delivery status notification|undeliverable|delivery has failed|mail delivery failed|returned mail/i.test(subject);
}

/** Very small HTML → text for Outlook bodies that come back as HTML. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n").trim();
}

// ── SMTP / IMAP mailboxes (D-238) ───────────────────────────────────────────

/** A complete RFC 5322 message for SMTP (CRLF line ends, base64 UTF-8 body). */
export function buildMessage(m: { from: string; fromName: string | null; to: string; subject: string; body: string; messageId: string; inReplyTo?: string | null; references?: string[]; date?: Date }): string {
  const refs = (m.references ?? []).filter(Boolean).map(clean);
  const headers = [
    `Date: ${(m.date ?? new Date()).toUTCString().replace("GMT", "+0000")}`,
    `From: ${m.fromName ? `${encodeHeader(clean(m.fromName))} <${clean(m.from)}>` : clean(m.from)}`,
    `To: ${clean(m.to)}`,
    `Subject: ${encodeHeader(clean(m.subject))}`,
    `Message-ID: ${clean(m.messageId)}`,
    ...(m.inReplyTo ? [`In-Reply-To: ${clean(m.inReplyTo)}`] : []),
    ...(refs.length ? [`References: ${refs.join(" ")}`] : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  const body = btoa(String.fromCharCode(...utf8(m.body.replace(/\r?\n/g, "\r\n")))).replace(/(.{76})/g, "$1\r\n");
  return `${headers.join("\r\n")}\r\n\r\n${body}\r\n`;
}

function decodeBytes(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

const latin1Bytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

function qpDecode(s: string): Uint8Array {
  const t = s.replace(/=\r?\n/g, "");
  const out: number[] = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "=" && /^[0-9A-F]{2}$/i.test(t.slice(i + 1, i + 3))) { out.push(parseInt(t.slice(i + 1, i + 3), 16)); i += 2; }
    else out.push(t.charCodeAt(i) & 0xff);
  }
  return Uint8Array.from(out);
}

/** "=?UTF-8?B?...?=" / "=?utf-8?Q?...?=" in header values. */
export function decodeWords(v: string): string {
  return v.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=\s*(?==\?)?/gi, (_m, cs: string, enc: string, data: string) => {
    const bytes = enc.toUpperCase() === "B" ? latin1Bytes(atob(data)) : qpDecode(data.replace(/_/g, " "));
    return decodeBytes(bytes, cs);
  });
}

/** Headers (unfolded, lower-case names, words decoded) of a raw message or part (latin1 text). */
export function parseHeaders(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.replace(/\r\n[ \t]+/g, " ").split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    if (!(k in out)) out[k] = decodeWords(line.slice(i + 1).trim());
  }
  return out;
}

const param = (v: string, name: string) => v.match(new RegExp(`${name}\\s*=\\s*"?([^";]+)"?`, "i"))?.[1] ?? "";

function partText(raw: string): { plain: string | null; html: string | null } {
  const sep = raw.search(/\r?\n\r?\n/);
  const head = parseHeaders(sep >= 0 ? raw.slice(0, sep) : raw);
  const body = sep >= 0 ? raw.slice(sep).replace(/^\r?\n\r?\n/, "") : "";
  const type = (head["content-type"] ?? "text/plain").toLowerCase();
  if (type.startsWith("multipart/")) {
    const boundary = param(head["content-type"] ?? "", "boundary");
    if (!boundary) return { plain: null, html: null };
    let plain: string | null = null, html: string | null = null;
    for (const p of body.split(`--${boundary}`).slice(1)) {
      if (p.startsWith("--")) break;
      const r = partText(p.replace(/^\r?\n/, ""));
      plain ??= r.plain;
      html ??= r.html;
    }
    return { plain, html };
  }
  if (!type.startsWith("text/")) return { plain: null, html: null };
  const enc = (head["content-transfer-encoding"] ?? "7bit").toLowerCase();
  const bytes = enc === "base64" ? latin1Bytes(atob(body.replace(/[^A-Za-z0-9+/=]/g, ""))) : enc === "quoted-printable" ? qpDecode(body) : latin1Bytes(body);
  const text = decodeBytes(bytes, param(head["content-type"] ?? "", "charset") || "utf-8");
  return type.startsWith("text/html") ? { plain: null, html: text } : { plain: text, html: null };
}

/** Headers and readable text of a raw message (bytes as latin1 text, as IMAP returns them). */
export function parseMessage(raw: string): { headers: Record<string, string>; text: string } {
  const sep = raw.search(/\r?\n\r?\n/);
  const headers = parseHeaders(sep >= 0 ? raw.slice(0, sep) : raw);
  const t = partText(raw);
  return { headers, text: t.plain ?? (t.html ? htmlToText(t.html) : "") };
}

/** Message ids in a header ("<a@b> <c@d>") → ["<a@b>", "<c@d>"], lower-cased. */
export function messageIds(v: string | undefined): string[] {
  return (v ?? "").match(/<[^<>\s]+>/g)?.map((x) => x.toLowerCase()) ?? [];
}
