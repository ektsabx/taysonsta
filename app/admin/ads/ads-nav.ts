import { can, type BosUser } from "@/lib/bos/auth";

// Ads area tabs (docs/bos/30 §14).
export function adsNav(bos: BosUser) {
  return [
    { key: "report", href: "/admin/ads", label: "الأداء", show: can(bos, "ads.read") },
    { key: "organic", href: "/admin/ads?view=organic", label: "العضوي مقابل المدفوع", show: can(bos, "ads.read") },
    { key: "accounts", href: "/admin/ads/accounts", label: "الحسابات الإعلانية", show: can(bos, "ads.manage") },
    { key: "alerts", href: "/admin/ads/alerts", label: "التنبيهات", show: can(bos, "ads.manage") },
  ].filter((i) => i.show).map(({ key, href, label }) => ({ key, href, label }));
}
