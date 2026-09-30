import { Tx } from "@/components/bos/I18n";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/bos/auth";
import { NotFoundError } from "@/lib/bos/errors";
import { getArticleBySlug, listCategories, playbookLabels } from "@/services/bos/knowledge";
import { listActiveStaff, listRoles } from "@/services/bos/shared";
import { PageHeader, Card } from "@/components/bos/ui";
import { ArticleEditor } from "../../../ArticleEditor";
import { updateArticleAction } from "../../../actions";

export default async function EditArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { bos } = await requirePermission("knowledge.update");
  const { slug } = await params;
  let a;
  try {
    a = await getArticleBySlug(bos, slug);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  if (a.author_id !== bos.userId && bos.permissions.get("knowledge.update") !== "all" && !bos.permissions.get("knowledge.manage")) notFound();
  const [categories, roles, staff] = await Promise.all([listCategories(), listRoles(), listActiveStaff()]);
  return (
    <>
      <PageHeader title={<Tx vars={{ title: a.title }}>{"تعديل: {title}"}</Tx>} subtitle={<Tx vars={{ version: a.version }}>{"الإصدار الحالي v{version} — أي تغيير في العنوان أو المحتوى يُنشئ إصداراً جديداً"}</Tx>} breadcrumbs={[{ label: "المعرفة", href: "/admin/knowledge" }, { label: a.title, href: `/admin/knowledge/articles/${a.slug}` }, { label: "تعديل" }]} />
      <Card>
        <ArticleEditor
          action={updateArticleAction.bind(null, a.id)}
          initial={{ ...a, status: a.status === "archived" ? "draft" : a.status }}
          categories={categories.map((c) => ({ value: c.id, label: c.name }))}
          roles={roles.filter((r) => !r.is_client_role).map((r) => ({ value: r.id, label: r.name }))}
          staff={staff.map((s) => ({ value: s.userId, label: s.name }))}
          sections={Object.entries(playbookLabels).map(([value, label]) => ({ value, label }))}
          canPublish={!!bos.permissions.get("knowledge.manage") || bos.isSuperAdmin}
        />
      </Card>
    </>
  );
}
