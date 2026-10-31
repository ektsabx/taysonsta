// Channel registry (owner, 2026-10-31, D-272): what each outreach channel can
// do, so campaigns never assume email is the only one. A new channel = a new
// entry here plus its adapter (sending, replies, limits, cost); the campaign
// engine, conversations and metrics read capabilities from this list.
// Only channels with a working adapter are "available": the screens show
// those only. Email is the one available now (D-269: email only); the others
// are recorded for the architecture and are never offered to the member.

export type ChannelId = "email" | "whatsapp" | "linkedin" | "phone" | "sms";

export interface ChannelSpec {
  id: ChannelId;
  label: { en: string; ar: string };
  /** A working adapter exists and the member can choose it. */
  available: boolean;
  capabilities: { send: boolean; receiveReplies: boolean; followUps: boolean; schedule: boolean; meetings: boolean };
  /** Metrics this channel produces (ids from lib/campaigns/metrics.ts). */
  metrics: string[];
  /** Where the account is connected. */
  connectHref: string | null;
  /** What it costs beyond the plan (null = included). */
  cost: { en: string; ar: string } | null;
  compliance: { en: string; ar: string };
}

export const CHANNELS: ChannelSpec[] = [
  {
    id: "email",
    label: { en: "Email", ar: "البريد الإلكتروني" },
    available: true,
    capabilities: { send: true, receiveReplies: true, followUps: true, schedule: true, meetings: true },
    metrics: ["contacted", "sent", "delivery_rate", "replies", "reply_rate", "interested", "positive_rate", "meetings"],
    connectHref: "/integrations",
    cost: null,
    compliance: {
      en: "Sent from your own mailbox, with an unsubscribe line on every campaign email; opt-outs and bounces stop all contact.",
      ar: "يُرسل من بريدك أنت، مع سطر إلغاء الاشتراك في كل رسالة حملة؛ وطلبات الإيقاف والارتداد توقف كل تواصل.",
    },
  },
  { id: "whatsapp", label: { en: "WhatsApp Business", ar: "واتساب للأعمال" }, available: false, capabilities: { send: false, receiveReplies: false, followUps: false, schedule: false, meetings: false }, metrics: [], connectHref: null, cost: null, compliance: { en: "Official API only, opted-in contacts only.", ar: "الواجهة الرسمية فقط، ولمن وافق فقط." } },
  { id: "linkedin", label: { en: "LinkedIn", ar: "لينكدإن" }, available: false, capabilities: { send: false, receiveReplies: false, followUps: false, schedule: false, meetings: false }, metrics: [], connectHref: null, cost: null, compliance: { en: "Official APIs only; no account automation.", ar: "الواجهات الرسمية فقط؛ بلا أتمتة للحسابات." } },
  { id: "phone", label: { en: "Phone calls", ar: "المكالمات" }, available: false, capabilities: { send: false, receiveReplies: false, followUps: false, schedule: false, meetings: false }, metrics: [], connectHref: null, cost: null, compliance: { en: "Through a licensed provider only.", ar: "عبر مزود مرخّص فقط." } },
  { id: "sms", label: { en: "SMS", ar: "الرسائل النصية" }, available: false, capabilities: { send: false, receiveReplies: false, followUps: false, schedule: false, meetings: false }, metrics: [], connectHref: null, cost: null, compliance: { en: "Opted-in numbers only.", ar: "للأرقام الموافقة فقط." } },
];

export const availableChannels = () => CHANNELS.filter((c) => c.available);
export const channelSpec = (id: string) => CHANNELS.find((c) => c.id === id) ?? null;
/** Keeps only channels that can actually run (a campaign never stores an unavailable one). */
export const cleanChannels = (ids: string[]): ChannelId[] => {
  const ok = ids.filter((id): id is ChannelId => Boolean(channelSpec(id)?.available));
  return ok.length ? [...new Set(ok)] : ["email"];
};
