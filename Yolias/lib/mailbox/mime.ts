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
