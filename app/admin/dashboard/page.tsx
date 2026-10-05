import { Tx } from "@/components/bos/I18n";
import { nowMs } from "@/lib/bos/clock";
import { Suspense } from "react";
import Link from "next/link";
import { requirePermission, type BosUser } from "@/lib/bos/auth";
import { type WidgetDef } from "@/lib/bos/widgets";
import { resolveWidgets } from "@/services/bos/dashboard-layout";
import { widgetComponents } from "./widgets";
import { PageHeader, ErrorState, LoadingState } from "@/components/bos/ui";
import { logServerError } from "@/lib/bos/errors";

async function WidgetSlot({ def, bos }: { def: WidgetDef; bos: BosUser }) {
  const Component = widgetComponents[def.key];
  if (!Component) return null;
  try {
    return await Component({ bos });
  } catch (error) {
    logServerError(`widget ${def.key}`, error);
    return <ErrorState title="تعذر تحميل هذا العنصر" description="حدث خطأ أثناء جلب البيانات. أعد تحميل الصفحة." retryHref="/admin/dashboard" />;
  }
}

const span: Record<number, string> = { 1: "span 1", 2: "span 2", 3: "span 3", 4: "1 / -1" };

export default async function DashboardPage() {
  const { bos } = await requirePermission("dashboard.read");
  const resolved = await resolveWidgets(bos);
  const hour = new Date(nowMs()).getHours();
  const greeting = hour < 12 ? "صباح الخير" : "مساء الخير";

  return (
    <>
      <PageHeader
        title={<Tx vars={{ greeting: <Tx>{greeting}</Tx>, v: bos.employee.full_name.split(" ")[0] }}>{"{greeting}، {v}"}</Tx>}
        actions={
          <>
            <Link href="/admin/dashboard/customize" className="admin-btn small ghost"><Tx>تخصيص</Tx></Link>
            {bos.permissions.has("leads.create") ? (
              <Link href="/admin/sales/leads/new" className="admin-btn small secondary">
                <Tx>+ عميل محتمل</Tx>
              </Link>
            ) : null}
            <Link href="/admin/profile/dashboard" className="admin-btn small ghost">
              <Tx>تخصيص</Tx>
            </Link>
          </>
        }
      />
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {resolved.map((def) => (
          <section key={def.key} className="bos-card bos-dash-widget" style={{ gridColumn: span[def.size] }}>
            <div className="bos-card-header">
              <h2><Tx>{def.title}</Tx></h2>
            </div>
            <div className="bos-card-body">
              <Suspense fallback={<LoadingState rows={3} />}>
                <WidgetSlot def={def} bos={bos} />
              </Suspense>
            </div>
          </section>
        ))}
      </div>
      {resolved.length === 0 ? <ErrorState title="لا توجد عناصر متاحة لدورك" description="اطلب من المسؤول إضافة صلاحيات أو تخصيص لوحة دورك." /> : null}
    </>
  );
}
