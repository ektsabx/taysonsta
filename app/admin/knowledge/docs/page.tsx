import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { listArticles } from "@/services/bos/knowledge";
import { PageHeader, Card } from "@/components/bos/ui";
import { ArticleList } from "../ArticleList";

// Documentation, company policies and onboarding guides.
export default async function DocsPage() {
  const { bos } = await requirePermission("knowledge.read");
  const [docs, policies, guides] = await Promise.all([listArticles(bos, { kind: "documentation" }), listArticles(bos, { kind: "policy" }), listArticles(bos, { kind: "onboarding_guide" })]);
  return (
    <>
      <PageHeader title="التوثيق والسياسات" actions={can(bos, "knowledge.create") ? <Link className="admin-btn small" href="/admin/knowledge/new?kind=documentation"><Tx>+ توثيق</Tx></Link> : null} />
      <Card title="سياسات الشركة" flush><ArticleList rows={policies} empty="لا توجد سياسات" /></Card>
      <Card title="أدلة التهيئة" flush><ArticleList rows={guides} empty="لا توجد أدلة" /></Card>
      <Card title="التوثيق التقني والمنتج" flush><ArticleList rows={docs} empty="لا يوجد توثيق" /></Card>
    </>
  );
}
