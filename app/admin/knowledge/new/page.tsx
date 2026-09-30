import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { listCategories, playbookLabels } from "@/services/bos/knowledge";
import { listActiveStaff, listRoles } from "@/services/bos/shared";
import { PageHeader, Card } from "@/components/bos/ui";
import { ArticleEditor } from "../ArticleEditor";
import { createArticleAction } from "../actions";

export default async function NewArticlePage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("knowledge.create");
  const sp = await readParams(searchParams);
  const [categories, roles, staff] = await Promise.all([listCategories(), listRoles(), listActiveStaff()]);
  return (
    <>
      <PageHeader title="مقال جديد" breadcrumbs={[{ label: "المعرفة", href: "/admin/knowledge" }, { label: "جديد" }]} />
      <Card>
        <ArticleEditor
          action={createArticleAction}
          initial={{ kind: sp.kind ?? "article", owner_id: bos.userId }}
          categories={categories.map((c) => ({ value: c.id, label: c.name }))}
          roles={roles.filter((r) => !r.is_client_role).map((r) => ({ value: r.id, label: r.name }))}
          staff={staff.map((s) => ({ value: s.userId, label: s.name }))}
          sections={Object.entries(playbookLabels).map(([value, label]) => ({ value, label }))}
          canPublish={!!bos.permissions.get("knowledge.manage") || bos.isSuperAdmin || can(bos, "knowledge.manage")}
        />
      </Card>
    </>
  );
}
