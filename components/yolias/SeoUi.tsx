import Link from "next/link";
import { Card, EmptyState, Tabs } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { num } from "@/components/yolias/PlatformUi";

// Shared bits for Admin → SEO (D-257).

export function SeoNotReady() {
  return (
    <Card>
      <EmptyState
        title="قسم SEO يحتاج تحديث قاعدة بيانات Yolias"
        description="قاعدة البيانات المتصلة لم يُطبَّق عليها ملف 20261123000000_seo_control_center.sql بعد. بعد تطبيقه تعمل صفحات SEO مباشرة. الخطوات في docs/17 آخر قسم."
      />
    </Card>
  );
}

export const pct = (v: number | null | undefined, digits = 1) => (v == null ? "—" : `${(v * 100).toFixed(digits)}%`);
export const pos = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(1));

/** "+12 (+30%)" against the previous period; nothing when there is no previous value. */
export function delta(now: number, prev: number): { text: string; trend?: "up" | "down" } {
  if (!prev && !now) return { text: "" };
  const d = now - prev;
  const rel = prev ? ` (${d >= 0 ? "+" : ""}${Math.round((d / prev) * 100)}%)` : "";
  return { text: `${d >= 0 ? "+" : ""}${num(Math.round(d * 100) / 100)}${rel}`, trend: d > 0 ? "up" : d < 0 ? "down" : undefined };
}

export function PeriodTabs({ days, base }: { days: number; base: string }) {
  return <Tabs tabs={[{ key: "7", label: "7 أيام" }, { key: "28", label: "28 يومًا" }, { key: "90", label: "90 يومًا" }]} active={String(days)} baseHref={base} param="days" />;
}

/** The source behind a number, or how to connect it. */
export function SourceNote({ gsc, ga4, attribution }: { gsc: boolean; ga4: boolean; attribution: boolean }) {
  const missing = [!gsc && "Search Console", !ga4 && "GA4"].filter(Boolean) as string[];
  return (
    <p className="bos-faint" style={{ fontSize: 12, lineHeight: 1.7 }}>
      <Tx>النقرات ومرات الظهور ونسبة النقر والترتيب من Google Search Console؛ الزيارات العضوية من GA4؛ التسجيلات والتجارب والمدفوعات من Yolias حسب أول صفحة في زيارة كل حساب جديد.</Tx>{" "}
      {missing.length > 0 && <><Tx vars={{ list: missing.join(" و ") }}>{"غير متصل: {list}."}</Tx> <Link className="bos-link" href="/admin/platform/seo/settings"><Tx>طريقة الربط</Tx></Link></>}
      {!attribution && <> <Tx>لم يُسجَّل مصدر أي تسجيل بعد (يبدأ بعد نشر هذا التحديث).</Tx></>}
    </p>
  );
}
