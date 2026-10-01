// Where each import type lives (docs/bos/39 §4): every section imports and
// exports only its own data. `after` lists the sections whose records must
// exist first, so references (account, vendor, project, manager) resolve and
// relations never break — rows whose reference is missing are reported, not
// written.
export interface ImportSection { href: string; label: string; after: { key: string; label: string; href: string }[] }

export const importSections: Record<string, ImportSection> = {
  clients: { href: "/admin/clients", label: "الحسابات", after: [] },
  contacts: { href: "/admin/contacts", label: "جهات الاتصال", after: [{ key: "clients", label: "الحسابات", href: "/admin/clients" }] },
  leads: { href: "/admin/sales/leads", label: "العملاء المحتملون", after: [] },
  deals: { href: "/admin/sales/deals", label: "الصفقات", after: [{ key: "clients", label: "الحسابات", href: "/admin/clients" }] },
  employees: { href: "/admin/team/employees", label: "الموظفون", after: [] },
  tasks: { href: "/admin/projects/tasks", label: "المهام", after: [{ key: "projects", label: "المشاريع", href: "/admin/projects" }] },
  expenses: { href: "/admin/finance/expenses", label: "المصروفات", after: [{ key: "vendors", label: "الموردون", href: "/admin/finance/vendors" }] },
  assets: { href: "/admin/team/devices", label: "الأجهزة والأصول", after: [] },
  vendors: { href: "/admin/finance/vendors", label: "الموردون", after: [] },
  products: { href: "/admin/products", label: "المنتجات والخدمات", after: [] },
  kb_articles: { href: "/admin/knowledge", label: "قاعدة المعرفة", after: [] },
};
