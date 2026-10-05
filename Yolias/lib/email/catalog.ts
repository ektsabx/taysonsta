import "server-only";
import { discoveryReadyEmail, planEndingEmail, receiptEmail, usageAlertEmail, type DiscoveryReadyInput, type EmailLocale, type PlanEndingInput, type ReceiptInput, type RenderedEmail, type UsageAlertInput } from "@/lib/email/templates";
import { renderMessage, type MessageData } from "@/lib/email/messages";
import type { EmailCategory } from "@/lib/email/send";

// Every product email Yolias sends: its category (sender), the profile
// setting that can turn it off (null = always sent: account and security
// mail is transactional) and how it renders. Triggers live next to the
// events (billing, pipeline, auth, admin); see docs/05 "Emails".

export type Pref = "notify_campaign_done" | "notify_usage" | "notify_billing" | "notify_product";

interface LegacyData {
  receipt: ReceiptInput;
  discovery_ready: DiscoveryReadyInput;
  usage_low: UsageAlertInput;
  usage_limit: UsageAlertInput;
  subscription_canceled: PlanEndingInput;
}
export type EmailData = MessageData & LegacyData;
export type EmailKind = keyof EmailData;

const entries: { [K in EmailKind]: { category: EmailCategory; pref: Pref | null } } = {
  welcome: { category: "account", pref: null },
  account_deleted: { category: "account", pref: null },
  new_sign_in: { category: "security", pref: null },
  suspicious_sign_in: { category: "security", pref: null },
  security_alert: { category: "security", pref: null },
  plan_welcome: { category: "subscription", pref: "notify_billing" },
  subscription_activated: { category: "subscription", pref: "notify_billing" },
  renewal_upcoming: { category: "subscription", pref: "notify_billing" },
  subscription_renewed: { category: "subscription", pref: "notify_billing" },
  subscription_canceled: { category: "subscription", pref: "notify_billing" },
  subscription_ending: { category: "subscription", pref: "notify_billing" },
  plan_upgraded: { category: "subscription", pref: "notify_billing" },
  plan_downgraded: { category: "subscription", pref: "notify_billing" },
  subscription_paused: { category: "subscription", pref: null },
  access_restored: { category: "subscription", pref: null },
  receipt: { category: "billing", pref: "notify_billing" },
  payment_failed: { category: "billing", pref: null },
  payment_method_attention: { category: "billing", pref: null },
  invoice_ready: { category: "billing", pref: "notify_billing" },
  refund_processed: { category: "billing", pref: "notify_billing" },
  refund_issued: { category: "billing", pref: "notify_billing" },
  payment_overdue: { category: "billing", pref: null },
  prospects_added: { category: "usage", pref: "notify_usage" },
  usage_low: { category: "usage", pref: "notify_usage" },
  usage_limit: { category: "usage", pref: "notify_usage" },
  discovery_ready: { category: "usage", pref: "notify_campaign_done" },
  announcement: { category: "updates", pref: "notify_product" },
};

export function emailMeta(kind: EmailKind) {
  return entries[kind];
}
export const emailKinds = Object.keys(entries) as EmailKind[];

export function renderEmail<K extends EmailKind>(kind: K, locale: EmailLocale, data: EmailData[K]): RenderedEmail {
  switch (kind) {
    case "receipt":
      return receiptEmail(locale, data as ReceiptInput);
    case "discovery_ready":
      return discoveryReadyEmail(locale, data as DiscoveryReadyInput);
    case "usage_low":
    case "usage_limit":
      return usageAlertEmail(locale, data as UsageAlertInput);
    case "subscription_canceled":
      return planEndingEmail(locale, data as PlanEndingInput);
    default:
      return renderMessage(kind as keyof MessageData, locale, data as MessageData[keyof MessageData]);
  }
}
