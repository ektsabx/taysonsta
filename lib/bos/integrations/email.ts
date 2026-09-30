import "server-only";
import { getSetting } from "@/lib/bos/settings";
import { providerFetch, resolveConnection } from "@/services/bos/integrations";

export interface EmailMessage {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Uint8Array }[];
  // Overrides the account's default reply-to (e.g. the support inbound address).
  replyTo?: string;
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export type EmailResult = { status: "sent"; id: string | null } | { status: "skipped"; reason: string } | { status: "failed"; error: string };

// Outgoing email (docs/bos/24, 30 §7). Source of credentials, in order:
// 1) the default Resend connection in the Integration Hub (encrypted),
// 2) the legacy environment setup (Settings → Integrations → Email + RESEND_API_KEY).
// With neither, sends are recorded as skipped — in-app notifications still work.
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const recipients = message.to.filter((t) => /.+@.+\..+/.test(t));
  if (!recipients.length) {
    return { status: "skipped", reason: "No valid recipient" };
  }

  let apiKey: string | undefined;
  let from: string | null | undefined;
  let replyTo: string | undefined;
  let connectionId: string | null = null;
  const hub = await resolveConnection("resend").catch(() => null);
  if (hub?.secrets.api_key) {
    apiKey = hub.secrets.api_key;
    from = (hub.connection.config as Record<string, string>).from;
    replyTo = (hub.connection.config as Record<string, string>).reply_to;
    connectionId = hub.connection.id;
  } else {
    const email = (await getSetting("integrations")).email;
    if (!email?.enabled) return { status: "skipped", reason: "Email integration is not enabled" };
    if (email.provider !== "resend") return { status: "skipped", reason: `Unsupported email provider: ${email.provider ?? "none"}` };
    apiKey = process.env.RESEND_API_KEY;
    from = email.from;
  }
  if (!apiKey || !from) {
    return { status: "skipped", reason: "Resend key or from address missing" };
  }
  if (message.replyTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.replyTo)) replyTo = message.replyTo;

  const res = await providerFetch({
    provider: "resend",
    connectionId,
    operation: "email.send",
    url: "https://api.resend.com/emails",
    init: {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(message.attachments?.length ? { attachments: message.attachments.map((a) => ({ filename: a.filename, content: toBase64(a.content) })) } : {}),
      }),
    },
    secrets: { api_key: apiKey },
    meta: { recipients: recipients.length, attachments: message.attachments?.length ?? 0 },
  });
  if (!res.ok) return { status: "failed", error: res.error ?? `Provider responded ${res.status}` };
  return { status: "sent", id: (res.body as { id?: string } | null)?.id ?? null };
}
