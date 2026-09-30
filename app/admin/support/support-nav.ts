import { can, type BosUser } from "@/lib/bos/auth";

// Support area tabs (docs/bos/30 §10.1) — shown only where permitted.
export function supportNav(bos: BosUser) {
  return [
    { key: "overview", href: "/admin/support", label: "نظرة عامة", show: can(bos, "conversations.read") },
    { key: "inbox", href: "/admin/support/inbox", label: "صندوق الوارد", show: can(bos, "conversations.read") },
    { key: "tickets", href: "/admin/support/tickets", label: "التذاكر", show: can(bos, "tickets.read") },
    { key: "customers", href: "/admin/support/customers", label: "العملاء", show: can(bos, "conversations.read") },
    { key: "widgets", href: "/admin/support/widgets", label: "ويدجت الموقع", show: can(bos, "conversations.manage", "all") },
    { key: "ai-agents", href: "/admin/support/ai-agents", label: "وكلاء الذكاء الاصطناعي", show: can(bos, "conversations.manage", "all") },
    { key: "teams", href: "/admin/support/teams", label: "الفرق والوكلاء", show: can(bos, "conversations.manage", "all") },
  ]
    .filter((i) => i.show)
    .map(({ key, href, label }) => ({ key, href, label }));
}
