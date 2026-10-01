import {
  authEmail, discoveryReadyEmail, planEndingEmail, receiptEmail, usageAlertEmail, type EmailLocale, type RenderedEmail,
} from "@/lib/email/templates";

// Sample data for the email preview (development only).
export const emailNames = ["magic_link", "confirmation", "invite", "receipt", "discovery_ready", "usage_alert", "usage_limit", "plan_ending"] as const;
export type EmailName = (typeof emailNames)[number];

export function sampleEmail(name: EmailName, locale: EmailLocale, siteUrl: string): RenderedEmail {
  const link = `${siteUrl}/auth/confirm?token_hash=sample&type=email`;
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())).toISOString();
  switch (name) {
    case "magic_link":
    case "confirmation":
    case "invite":
      return authEmail(name, locale, siteUrl, link);
    case "receipt":
      return receiptEmail(locale, {
        siteUrl, invoiceId: "sample", invoiceNumber: "YL-001001", planName: locale === "ar" ? "يولـياس برو" : "Yolias Pro",
        period: "monthly", amountUsd: 20, date: now.toISOString(), periodEnd: next, test: true,
      });
    case "discovery_ready":
      return discoveryReadyEmail(locale, {
        siteUrl, strategyId: "sample", strategyTitle: locale === "ar" ? "شركات التقنية المالية في الإمارات" : "Fintech companies in the UAE", prospects: 86, companies: 41,
      });
    case "usage_alert":
      return usageAlertEmail(locale, { siteUrl, used: 820, total: 1000, resetsAt: next });
    case "usage_limit":
      return usageAlertEmail(locale, { siteUrl, used: 1000, total: 1000, resetsAt: next });
    case "plan_ending":
      return planEndingEmail(locale, { siteUrl, planName: locale === "ar" ? "يولـياس للنمو" : "Yolias Growth", endsAt: next });
  }
}
