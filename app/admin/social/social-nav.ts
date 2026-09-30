import { can, type BosUser } from "@/lib/bos/auth";

// Social area tabs (docs/bos/30 §12).
export function socialNav(bos: BosUser) {
  return [
    { key: "overview", href: "/admin/social", label: "التحليلات", show: can(bos, "social.read") },
    { key: "calendar", href: "/admin/social/calendar", label: "التقويم", show: can(bos, "social.read") },
    { key: "posts", href: "/admin/social/posts", label: "المنشورات", show: can(bos, "social.read") },
    { key: "accounts", href: "/admin/social/accounts", label: "الحسابات", show: can(bos, "social.manage") },
  ].filter((i) => i.show).map(({ key, href, label }) => ({ key, href, label }));
}
