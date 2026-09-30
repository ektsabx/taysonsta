import { requirePermission } from "@/lib/bos/auth";
import { widgets } from "@/lib/bos/widgets";
import { PageHeader } from "@/components/bos/ui";
import { resolveWidgets } from "@/services/bos/dashboard-layout";
import { LayoutEditor } from "../LayoutEditor";

// Personal customise mode (reorder / hide / add permitted widgets).
export default async function CustomizeDashboardPage() {
  const { bos } = await requirePermission("dashboard.read");
  const current = await resolveWidgets(bos);
  const available = widgets.filter((w) => w.perm.every((p) => bos.permissions.has(p))).map((w) => ({ key: w.key, title: w.title, dashboard: w.dashboard }));
  return (
    <>
      <PageHeader title="تخصيص لوحة التحكم" subtitle="تظهر فقط العناصر المسموحة لصلاحياتك" breadcrumbs={[{ label: "لوحة التحكم", href: "/admin/dashboard" }, { label: "تخصيص" }]} />
      <LayoutEditor roleId={null} available={available} initial={current.map((w) => w.key)} />
    </>
  );
}
