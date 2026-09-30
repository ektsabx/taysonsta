"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Each item shows only when the client user has that section (Phase 16 permissions).
const items: { href: string; label: string; perm?: string }[] = [
  { href: "/portal", label: "الرئيسية" },
  { href: "/portal/projects", label: "المشاريع", perm: "projects" },
  { href: "/portal/delivery", label: "النشر والتسليم", perm: "projects" },
  { href: "/portal/approvals", label: "الموافقات", perm: "approvals" },
  { href: "/portal/change-requests", label: "طلبات التغيير", perm: "change_requests" },
  { href: "/portal/contracts", label: "العقود والمستندات", perm: "contracts" },
  { href: "/portal/invoices", label: "الفواتير", perm: "invoices" },
  { href: "/portal/payments", label: "المدفوعات", perm: "payments" },
  { href: "/portal/support", label: "الدعم والتذاكر", perm: "support" },
  { href: "/portal/support/chat", label: "محادثات الدعم", perm: "support" },
  { href: "/portal/maintenance", label: "الصيانة والدعم", perm: "support" },
  { href: "/portal/messages", label: "رسائل المشاريع", perm: "messages" },
  { href: "/portal/meetings", label: "الاجتماعات", perm: "meetings" },
  { href: "/portal/files", label: "الملفات", perm: "files" },
];

export function PortalNav({ permissions }: { permissions: Record<string, boolean> }) {
  const path = usePathname();
  const visible = items.filter((i) => !i.perm || permissions[i.perm] !== false);
  const best = visible.filter((i) => (i.href === "/portal" ? path === "/portal" : path.startsWith(i.href))).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="portal-nav" aria-label="قائمة البوابة">
      {visible.map((i) => {
        const active = i.href === best;
        return <Link key={i.href} href={i.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>{i.label}</Link>;
      })}
    </nav>
  );
}
