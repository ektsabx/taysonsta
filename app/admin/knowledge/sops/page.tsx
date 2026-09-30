import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { listArticles } from "@/services/bos/knowledge";
import { PageHeader, Card } from "@/components/bos/ui";
import { ArticleList } from "../ArticleList";

export default async function SopsPage() {
  const { bos } = await requirePermission("knowledge.read");
  const rows = await listArticles(bos, { kind: "sop" });
  return (
    <>
      <PageHeader title="إجراءات التشغيل (SOPs)" subtitle="خطوات مرتبة، مالك، مستندات مطلوبة، وقائمة تحقق تفاعلية" actions={can(bos, "knowledge.create") ? <Link className="admin-btn small" href="/admin/knowledge/new?kind=sop"><Tx>+ إجراء</Tx></Link> : null} />
      <Card flush><ArticleList rows={rows} empty="لا توجد إجراءات منشورة" /></Card>
    </>
  );
}
