import { getT } from "@/lib/bos/i18n/server";
import Link from "next/link";

const items = [
  ["company", "الشركة"], ["branches", "الفروع"], ["users", "المستخدمون"], ["roles", "الأدوار"], ["permissions", "الأذونات"], ["products", "المنتجات والخدمات"], ["pricing", "التسعير والعملات"],
  ["commission", "العمولة"], ["pipeline", "المبيعات"], ["hr", "الموارد البشرية"], ["notifications", "الإشعارات"], ["integrations", "التكاملات"], ["security", "الأمان"], ["it", "IT والتطبيقات"], ["audit-logs", "سجل التدقيق"],
];

export async function SettingsNav({ active }: { active: string }) {
  const t = await getT();
  return (
    <nav className="bos-tabs" aria-label={t("أقسام الإعدادات")}>
      {items.map(([k, l]) => <Link key={k} href={`/admin/settings/${k}`} className={k === active ? "active" : undefined}>{t(l)}</Link>)}
    </nav>
  );
}
