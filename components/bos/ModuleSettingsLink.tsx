"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/bos/I18n";

// Settings hub (docs/bos/35 B8): every module links to its configuration in
// Settings. Shown only when that settings page is in the viewer's permitted
// navigation, so the link never leads to a forbidden page.
const moduleSettings: [prefix: string, href: string][] = [
  ["/admin/dashboard", "/admin/settings/dashboards"],
  ["/admin/sales", "/admin/settings/pipeline"],
  ["/admin/finance/commissions", "/admin/settings/company"],
  ["/admin/finance", "/admin/settings/company"],
  ["/admin/team/locations", "/admin/settings/hr"],
  ["/admin/team/access", "/admin/settings/it"],
  ["/admin/team/devices", "/admin/settings/it"],
  ["/admin/team", "/admin/settings/hr"],
  ["/admin/communication/notifications", "/admin/settings/notifications"],
  ["/admin/communication/messaging", "/admin/settings/integrations"],
  ["/admin/social", "/admin/settings/integrations"],
  ["/admin/ads", "/admin/settings/integrations"],
  ["/admin/content", "/admin/settings/integrations"],
  ["/admin/support", "/admin/settings/integrations"],
  ["/admin/documents/signatures", "/admin/settings/integrations"],
  ["/admin/clients", "/admin/settings/company"],
  ["/admin/projects", "/admin/settings/company"],
];

export function ModuleSettingsLink({ allowed }: { allowed: string[] }) {
  const pathname = usePathname();
  const t = useT();
  const hit = moduleSettings.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  if (!hit || !allowed.includes(hit[1]) || pathname.startsWith("/admin/settings")) return null;
  return (
    <Link href={hit[1]} className="admin-icon-btn bos-module-settings" aria-label={t("إعدادات هذا القسم")} title={t("إعدادات هذا القسم")}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
    </Link>
  );
}
