import { StatusBadge } from "@/components/bos/ui";
import type { Tone } from "@/lib/bos/labels";
import type { CheckoutSessionRow } from "../../../../../Yolias/types/database";

// Checkout states (D-212). One state at a time; "recovered" is shown when an
// abandoned / failed checkout was later completed (its history stays).
const states: Record<string, { label: string; tone: Tone }> = {
  opened: { label: "بدأ Checkout", tone: "info" },
  details: { label: "بيانات غير مكتملة", tone: "info" },
  payment_started: { label: "بدأ الدفع", tone: "info" },
  awaiting_result: { label: "في انتظار نتيجة الدفع", tone: "warning" },
  payment_failed: { label: "فشل الدفع", tone: "danger" },
  abandoned: { label: "متروك", tone: "warning" },
  paid: { label: "اكتمل الدفع", tone: "success" },
  activated: { label: "تم تفعيل الاشتراك", tone: "success" },
  closed: { label: "أُغلق / أُلغي", tone: "neutral" },
};

export function checkoutState(c: Pick<CheckoutSessionRow, "status" | "recovered_at" | "abandoned_at" | "outcome">) {
  if (c.recovered_at) return { label: "استُعيد بعد التخلي عنه", tone: "success" as Tone };
  const s = states[c.status] ?? { label: c.status, tone: "neutral" as Tone };
  if (c.status === "activated" && c.outcome === "trial") return { label: "تم تفعيل التجربة المجانية", tone: "success" as Tone };
  return s;
}

export function CheckoutStatus({ c }: { c: Pick<CheckoutSessionRow, "status" | "recovered_at" | "abandoned_at" | "outcome"> }) {
  const s = checkoutState(c);
  return (
    <>
      <StatusBadge tone={s.tone} label={s.label} />
      {c.abandoned_at && c.status !== "abandoned" ? <span className="cell-sub" style={{ fontSize: 11 }}>تُرك سابقًا</span> : null}
    </>
  );
}

export function since(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (m < 60) return `${m} د`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} س`;
  return `${Math.round(h / 24)} يوم`;
}
