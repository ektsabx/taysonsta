import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { Card, PageHeader, StatusBadge } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { listUseCases } from "@/services/yolias/use-cases";

export default async function UseCasesPage() {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="حالات الاستخدام" /><NotConnected /></>);
  const rows = await listUseCases();
  return (
    <>
      <PageHeader title="حالات الاستخدام" actions={<Link className="admin-btn" href="/admin/platform/use-cases/new"><Tx>حالة جديدة</Tx></Link>} />
      <Card flush>
        <div className="bos-table-scroll"><table className="bos-table">
          <thead><tr><th><Tx>العنوان</Tx></th><th><Tx>الرابط</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug}>
                <td><Link href={`/admin/platform/use-cases/${r.slug}`} dir="auto">{(r.doc as { ar?: { name?: string } }).ar?.name ?? r.slug}</Link></td>
                <td dir="ltr">/use-cases/{r.slug}</td>
                <td>{r.status === "published" ? <StatusBadge tone="success" label="منشور" /> : <StatusBadge tone="neutral" label="مسودة" />}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={3}><Tx>لا توجد حالات بعد</Tx></td></tr>}
          </tbody>
        </table></div>
      </Card>
    </>
  );
}
