import { can, type BosUser } from "@/lib/bos/auth";

// Content Studio tabs (docs/bos/30 §13).
export function contentNav(bos: BosUser) {
  return [
    { key: "board", href: "/admin/content", label: "لوحة المحتوى", show: can(bos, "content.read") },
    { key: "ideas", href: "/admin/content/ideas", label: "مولّد الأفكار", show: can(bos, "content.create") },
    { key: "insights", href: "/admin/content/insights", label: "لماذا ينجح المحتوى", show: can(bos, "content.read") },
    { key: "stages", href: "/admin/content/stages", label: "مراحل العمل", show: can(bos, "content.manage") },
  ].filter((i) => i.show).map(({ key, href, label }) => ({ key, href, label }));
}
