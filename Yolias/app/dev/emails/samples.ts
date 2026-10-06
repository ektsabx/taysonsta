import { authEmail, emailChangedNotice, securityNoticeEmail, type EmailLocale, type RenderedEmail } from "@/lib/email/templates";
import { renderEmail, type EmailData, type EmailKind } from "@/lib/email/catalog";

// Sample data for the email preview (development only): every email Yolias
// sends, auth emails (sent by Supabase) and product emails (lib/email/catalog).

const authNames = ["magic_link", "confirmation", "invite", "email_change", "email_changed", "mfa_factor_enrolled", "mfa_factor_unenrolled"] as const;
const productNames = [
  "welcome", "new_sign_in", "suspicious_sign_in", "security_alert", "account_deleted",
  "plan_welcome", "subscription_activated", "renewal_upcoming", "subscription_renewed", "subscription_canceled", "subscription_ending",
  "plan_upgraded", "plan_downgraded", "subscription_paused", "access_restored",
  "receipt", "invoice_ready", "payment_failed", "payment_method_attention", "payment_overdue", "refund_processed", "refund_issued",
  "prospects_added", "usage_low", "usage_limit", "discovery_ready", "announcement",
] as const satisfies readonly EmailKind[];

export const emailNames = [...authNames, ...productNames] as const;
export type EmailName = (typeof emailNames)[number];

function sample(name: (typeof productNames)[number], l: EmailLocale): Omit<EmailData[EmailKind], "siteUrl"> {
  const ar = l === "ar";
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())).toISOString();
  const pro = ar ? "يولـياس برو" : "Yolias Pro";
  const growth = ar ? "يولـياس للنمو" : "Yolias Growth";
  const plan = { planName: pro, period: "monthly" as const, amount: 20, periodEnd: next, test: true };
  const data: { [K in (typeof productNames)[number]]: Omit<EmailData[K], "siteUrl"> } = {
    welcome: { name: ar ? "سارة" : "Sara" },
    new_sign_in: { at: now.toISOString(), device: "Safari · iOS", ip: "197.32.10.4" },
    suspicious_sign_in: { attempts: 7, windowMinutes: 60 },
    security_alert: { event: "signed_out_everywhere", at: now.toISOString() },
    account_deleted: { email: "sara@company.com" },
    plan_welcome: { ...plan, prospectsPerMonth: 1000 },
    subscription_activated: plan,
    renewal_upcoming: plan,
    subscription_renewed: { ...plan, invoiceId: "sample", invoiceNumber: "YL-001002" },
    subscription_canceled: { planName: growth, endsAt: next },
    subscription_ending: { planName: growth, endsAt: next },
    plan_upgraded: { ...plan, planName: growth, fromPlanName: pro, amount: 50, prospectsPerMonth: 3000 },
    plan_downgraded: { ...plan, fromPlanName: growth, prospectsPerMonth: 1000 },
    subscription_paused: { planName: pro, reason: ar ? "تعذّر تحصيل الدفعة" : "the payment couldn’t be collected" },
    access_restored: { planName: pro },
    receipt: { invoiceId: "sample", invoiceNumber: "YL-001001", planName: pro, period: "monthly", amount: 20, date: now.toISOString(), periodEnd: next, test: true },
    invoice_ready: { invoiceId: "sample", invoiceNumber: "YL-001003", planName: pro, amount: 20, dueAt: next, test: true },
    payment_failed: { planName: pro, amount: 20, reason: ar ? "تم رفض البطاقة" : "card declined", retryAt: next },
    payment_method_attention: { reason: ar ? "تنتهي صلاحية بطاقتك هذا الشهر" : "Your card expires this month" },
    payment_overdue: { planName: pro, amount: 20, reason: null, retryAt: null, daysOverdue: 7 },
    refund_processed: { invoiceNumber: "YL-001001", amount: 20, reason: null },
    refund_issued: { invoiceNumber: "YL-001001", amount: 20, reason: null },
    prospects_added: { added: 200, allowance: 1200, reason: null },
    usage_low: { used: 820, total: 1000, resetsAt: next },
    usage_limit: { used: 1000, total: 1000, resetsAt: next },
    discovery_ready: { strategyId: "sample", strategyTitle: ar ? "شركات التقنية المالية في الإمارات" : "Fintech companies in the UAE", prospects: 86, companies: 41 },
    announcement: {
      type: "new_feature", title: ar ? "محادثات محفوظة" : "Saved conversations",
      body: ar ? "كل بحث يحتفظ الآن بمحادثته مع Yolias AI.\n\nافتح أي بحث لتكمل من حيث توقفت." : "Every search now keeps its Yolias AI conversation.\n\nOpen any search to pick up where you left off.",
      ctaLabel: ar ? "جرّبها الآن" : "Try it now", ctaUrl: "https://yolias.ai/",
    },
  };
  return data[name];
}

export function sampleEmail(name: EmailName, locale: EmailLocale, siteUrl: string): RenderedEmail {
  const link = `${siteUrl}/auth/confirm?token_hash=sample&type=email`;
  switch (name) {
    case "magic_link":
    case "confirmation":
    case "invite":
    case "email_change":
      return authEmail(name, locale, siteUrl, link);
    case "email_changed":
      return emailChangedNotice(locale, siteUrl, "old@company.com", "new@company.com");
    case "mfa_factor_enrolled":
    case "mfa_factor_unenrolled":
      return securityNoticeEmail(name, locale, siteUrl);
    default:
      return renderEmail(name, locale, { ...sample(name, locale), siteUrl } as EmailData[typeof name]);
  }
}
