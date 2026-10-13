import { StatusBadge } from "@/components/bos/ui";
import type { Tone } from "@/lib/bos/labels";
import type { AdminAccountRow } from "../../Yolias/types/database";

// Labels shared by Users, User 360 and Conversions (D-214). Account state,
// subscription state and the journey segment are different things and are
// shown separately.

export const accountStatusLabel: Record<string, { label: string; tone: Tone }> = {
  active: { label: "نشط", tone: "success" },
  suspended: { label: "موقوف", tone: "danger" },
  paused: { label: "موقوف مؤقتًا", tone: "warning" },
  banned: { label: "محظور", tone: "danger" },
  deleted: { label: "محذوف", tone: "neutral" },
};

export function AccountStatus({ value, until }: { value: string; until?: string | null }) {
  const d = accountStatusLabel[value] ?? { label: value, tone: "neutral" as Tone };
  return (
    <>
      <StatusBadge tone={d.tone} label={d.label} />
      {value === "paused" && until ? <span className="cell-sub" dir="ltr">{until.slice(0, 10)}</span> : null}
    </>
  );
}

type SubInput = Pick<AdminAccountRow, "plan" | "subscription_status" | "cancel_at_period_end" | "current_period_end" | "paid_count" | "trial_started_at" | "last_checkout_status">;

/** The real subscription state, from the confirmed subscription status (never from a pending payment). */
export function subscriptionState(r: SubInput): { label: string; tone: Tone } {
  const soon = r.current_period_end && Date.parse(r.current_period_end) - Date.now() < 7 * 86_400_000;
  // No paid plan = not subscribed, whatever the status says (old free workspaces).
  switch (r.plan === "free" && r.subscription_status !== "trialing" ? "none" : r.subscription_status) {
    case "trialing": return { label: "تجربة مجانية", tone: "info" };
    case "active":
      if (r.cancel_at_period_end) return { label: "ملغى — ساري حتى تاريخ الانتهاء", tone: "warning" };
      return soon ? { label: "مدفوع — سينتهي قريبًا", tone: "warning" } : { label: "مدفوع نشط", tone: "success" };
    case "test": return { label: "اشتراك اختبار (بدون دفع)", tone: "neutral" };
    case "past_due": return { label: "دفع متأخر / فاشل", tone: "danger" };
    case "canceled":
      return r.paid_count > 0 ? { label: "اشتراك منتهٍ", tone: "neutral" } : r.trial_started_at ? { label: "انتهت التجربة", tone: "neutral" } : { label: "منتهٍ", tone: "neutral" };
    default:
      if (r.last_checkout_status === "payment_failed") return { label: "دفع فاشل — لم يتفعل", tone: "danger" };
      if (r.last_checkout_status === "awaiting_result") return { label: "في انتظار نتيجة الدفع", tone: "info" };
      return { label: "لم يشترك", tone: "neutral" };
  }
}

export function SubscriptionState(props: SubInput) {
  const s = subscriptionState(props);
  return <StatusBadge tone={s.tone} label={s.label} />;
}

export const segmentLabel: Record<string, string> = {
  registered_only: "سجّل ولم يبدأ تجربة أو اشتراكًا",
  trialing: "في التجربة المجانية الآن",
  trial_ended: "انتهت التجربة ولم يتحول لمدفوع",
  plan_selected: "اختار خطة ولم يفتح Checkout",
  checkout_no_payment: "فتح Checkout ولم يبدأ الدفع",
  payment_pending: "بدأ الدفع ولم تكتمل النتيجة",
  payment_failed: "فشل دفعه",
  payment_not_completed: "بدأ الدفع ثم ترك العملية",
  paid_active: "مشترك مدفوع نشط",
  lapsed: "اشترك سابقًا ثم ألغى أو انتهى",
  test: "اشتراك اختبار",
  deleted: "حساب محذوف",
};

export const sourceLabel: Record<string, string> = {
  google: "Google", youtube: "YouTube", tiktok: "TikTok", friend: "صديق / ترشيح", x: "X", instagram: "Instagram", review_site: "موقع تقييمات",
  blog: "مقال / مدونة", facebook: "Facebook", ai_chat: "مساعد ذكاء اصطناعي", linkedin: "LinkedIn", email: "بريد إلكتروني", reddit: "Reddit",
  podcast: "بودكاست", other: "أخرى", prefer_not_to_say: "فضّل عدم الإجابة",
};

export const providerLabel: Record<string, string> = { polar: "Polar (بطاقة)", paymob: "Paymob (مصر)" };

export const money = (n: number | null | undefined) => (n == null ? "—" : `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(n))}`);
export const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 1000) / 10}%`);
