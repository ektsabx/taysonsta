import "server-only";
import type { Tables } from "@/lib/bos/db";

// Reply on the customer's own channel (docs/bos/39 §5): one function used by
// staff replies and AI replies alike. The system knows the conversation's
// channel and connected account and sends through it; when the channel is not
// connected the reply is kept and marked "skipped" — never silently lost.

type Conversation = Tables<"conversations">;
type Customer = Tables<"support_customers">;
export type DeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "skipped" | null;
export interface Delivery { status: DeliveryStatus; error: string | null; externalId: string | null }

const META_GRAPH = "https://graph.facebook.com/v21.0";

export async function deliverToCustomer(conv: Conversation, customer: Customer, text: string, actorId: string | null): Promise<Delivery> {
  const out: Delivery = { status: "sent", error: null, externalId: null };
  switch (conv.channel) {
    case "email": {
      if (!customer.email) return { ...out, status: "failed", error: "Customer has no email" };
      const { sendEmail } = await import("@/lib/bos/integrations/email");
      const { resolveConnection } = await import("@/services/bos/integrations");
      const inbound = await resolveConnection("support_email").catch(() => null);
      const subject = `${conv.subject ? `Re: ${conv.subject}` : conv.number} [${conv.number}]`;
      const res = await sendEmail({ to: [customer.email], subject, text, ...(inbound ? { replyTo: (inbound.connection.config as Record<string, string>).inbound_address } : {}) });
      if (res.status === "sent") return { ...out, externalId: res.id };
      return { ...out, status: res.status === "skipped" ? "skipped" : "failed", error: res.status === "skipped" ? res.reason : res.error };
    }
    case "messenger":
    case "instagram": {
      const recipient = conv.channel === "messenger" ? customer.messenger_id : customer.instagram_id;
      if (!recipient) return { ...out, status: "failed", error: "Customer has no channel id" };
      const { resolveConnection, providerFetch } = await import("@/services/bos/integrations");
      const conn = await resolveConnection("meta").catch(() => null);
      if (!conn?.secrets.access_token) return { ...out, status: "skipped", error: "Meta is not connected" };
      const r = await providerFetch({
        provider: "meta", connectionId: conn.connection.id, operation: `${conv.channel}.send`, secrets: conn.secrets, actorId, retries: 1,
        url: `${META_GRAPH}/me/messages?access_token=${encodeURIComponent(conn.secrets.access_token)}`,
        init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient: { id: recipient }, messaging_type: "RESPONSE", message: { text: text.slice(0, 2000) } }) },
      });
      const b = r.body as { message_id?: string; error?: { message?: string } } | null;
      return r.ok ? { ...out, externalId: b?.message_id ?? null } : { ...out, status: "failed", error: b?.error?.message ?? r.error ?? `HTTP ${r.status}` };
    }
    case "telegram": {
      if (!customer.telegram_id) return { ...out, status: "failed", error: "Customer has no Telegram chat" };
      const { resolveConnection, providerFetch } = await import("@/services/bos/integrations");
      const conn = await resolveConnection("telegram").catch(() => null);
      if (!conn?.secrets.bot_token) return { ...out, status: "skipped", error: "Telegram is not connected" };
      const r = await providerFetch({
        provider: "telegram", connectionId: conn.connection.id, operation: "telegram.send", secrets: conn.secrets, actorId, retries: 1,
        url: `https://api.telegram.org/bot${conn.secrets.bot_token}/sendMessage`,
        init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: customer.telegram_id, text: text.slice(0, 4000) }) },
      });
      const b = r.body as { ok?: boolean; result?: { message_id?: number }; description?: string } | null;
      return r.ok && b?.ok ? { ...out, externalId: b.result?.message_id ? String(b.result.message_id) : null } : { ...out, status: "failed", error: b?.description ?? r.error ?? `HTTP ${r.status}` };
    }
    case "manual":
      return { ...out, status: null }; // a record of what was said; nothing to deliver
    default:
      return out; // web_widget: stored and shown to the customer in the widget
  }
}
