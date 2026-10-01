import Link from "next/link";
import type { Tone } from "@/lib/bos/labels";
import { StatusBadge, EmptyState, Card } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { yoliasConfigured } from "@/lib/yolias/db";

// Shared bits for the Yolias Platform pages (docs/09-yolias-admin.md §B).

const planTone: Record<string, Tone> = { free: "neutral", pro: "info", growth: "accent" };
const planLabel: Record<string, string> = { free: "Free", pro: "Pro", growth: "Growth" };

export function PlanBadge({ plan, status }: { plan: string; status?: string }) {
  return (
    <span className="bos-row" style={{ gap: 4, flexWrap: "nowrap" }}>
      <StatusBadge tone={planTone[plan] ?? "neutral"} label={planLabel[plan] ?? plan} />
      {status === "test" ? <StatusBadge tone="warning" label="وضع الاختبار" /> : null}
      {status === "canceled" || status === "past_due" ? <StatusBadge tone="danger" label={status === "canceled" ? "ملغى" : "متأخر السداد"} /> : null}
    </span>
  );
}

const searchStatus: Record<string, { label: string; tone: Tone }> = {
  understanding: { label: "قيد الفهم", tone: "info" },
  ready: { label: "جاهز", tone: "success" },
  failed: { label: "فشل", tone: "danger" },
};
const campaignStatus: Record<string, { label: string; tone: Tone }> = {
  awaiting_source: { label: "بانتظار مصدر بيانات", tone: "warning" },
  queued: { label: "في الطابور", tone: "info" },
  created: { label: "جديدة", tone: "neutral" },
  discovering_companies: { label: "تبحث عن شركات", tone: "info" },
  matching_companies: { label: "تطابق الشركات", tone: "info" },
  discovering_people: { label: "تبحث عن صناع القرار", tone: "info" },
  enriching: { label: "تُثري البيانات", tone: "info" },
  verifying: { label: "تتحقق من البريد", tone: "info" },
  researching: { label: "تبحث في المواقع", tone: "info" },
  scoring: { label: "تحسب التطابق", tone: "info" },
  delivering: { label: "تسلّم النتائج", tone: "info" },
  completed: { label: "مكتمل", tone: "success" },
  partial: { label: "جزئي", tone: "warning" },
  failed: { label: "فشل", tone: "danger" },
  paused: { label: "متوقف", tone: "neutral" },
};

export function SearchStatus({ value }: { value: string }) {
  const d = searchStatus[value] ?? { label: value, tone: "neutral" as Tone };
  return <StatusBadge tone={d.tone} label={d.label} />;
}

export function CampaignStatus({ value }: { value: string }) {
  const d = campaignStatus[value] ?? { label: value, tone: "neutral" as Tone };
  return <StatusBadge tone={d.tone} label={d.label} />;
}

export const campaignStatusLabel = (v: string) => campaignStatus[v]?.label ?? v;

/** Shown instead of the page when the admin has no connection to the Yolias database. */
export function NotConnected() {
  return (
    <Card>
      <EmptyState
        title="قاعدة بيانات Yolias غير متصلة"
        description="اضبط YOLIAS_SUPABASE_URL و YOLIAS_SUPABASE_SERVICE_ROLE_KEY على الخادم. محلياً يضبطهما الأمر npm run local."
      />
    </Card>
  );
}

export function connected(): boolean {
  return yoliasConfigured();
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="bos-row" style={{ justifyContent: "center", gap: 8, padding: 10 }}>
      {page > 1 ? <Link className="admin-btn small secondary" href={href(page - 1)}><Tx>السابق</Tx></Link> : null}
      <span className="bos-faint">{page}/{pages}</span>
      {page < pages ? <Link className="admin-btn small secondary" href={href(page + 1)}><Tx>التالي</Tx></Link> : null}
    </div>
  );
}

export function qsFor(base: string, sp: Record<string, string>) {
  return (page: number) => `${base}?${new URLSearchParams({ ...sp, page: String(page) })}`;
}

export const num = (n: number) => new Intl.NumberFormat("en-US").format(n);
export const usd = (n: number) => `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)}`;
