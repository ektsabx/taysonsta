import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { listArticles, playbookLabels } from "@/services/bos/knowledge";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";

// Sales playbook sections (§44).
export default async function PlaybooksPage() {
  const { bos } = await requirePermission("knowledge.read");
  const rows = await listArticles(bos, { kind: "playbook" });
  return (
    <>
      <PageHeader title="أدلة المبيعات" breadcrumbs={[{ label: "المعرفة", href: "/admin/knowledge" }, { label: "أدلة المبيعات" }]} actions={can(bos, "knowledge.create") ? <Link className="admin-btn small" href="/admin/knowledge/new?kind=playbook"><Tx>+ قسم</Tx></Link> : null} />
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {Object.entries(playbookLabels).map(([key, label]) => {
          const items = rows.filter((r) => r.playbook_section === key);
          return (
            <Card key={key} title={label}>
              {items.length ? items.map((a) => (
                <div key={a.id} style={{ marginBottom: 6 }}>
                  <Link className="bos-link" href={`/admin/knowledge/articles/${a.slug}`}><Tx>{a.title}</Tx></Link>{" "}
                  {a.status !== "published" ? <StatusBadge tone="warning" label="مسودة" /> : null}
                </div>
              )) : <EmptyState title="لا يوجد محتوى" />}
            </Card>
          );
        })}
      </div>
    </>
  );
}
