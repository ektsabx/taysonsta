import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { listArticles, listCategories } from "@/services/bos/knowledge";
import { PageHeader, Card, KpiCard, EmptyState, StatusBadge, Tabs } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { BosTable } from "@/components/bos/BosTable";
import { formatDate } from "@/lib/bos/format";
import { KbRowActions } from "./KbControls";

// Support knowledge base (docs/bos/37 §7.6): the existing KB (same articles,
// categories, versions, editor), focused on customer-facing help content and
// what the AI support agent may use. No parallel content store.
export default async function SupportKnowledgePage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("knowledge.read");
  const sp = await readParams(searchParams);
  const view = sp.view === "all" ? "all" : "customers";
  const [articles, allPublic, categories] = await Promise.all([
    listArticles(bos, { q: sp.q, category: sp.category, status: sp.status, audience: view === "customers" ? "public" : undefined, ai: sp.ai === "1" ? true : sp.ai === "0" ? false : undefined }),
    listArticles(bos, { audience: "public" }),
    listCategories(),
  ]);
  const canPublish = can(bos, "knowledge.manage");
  const canEdit = can(bos, "knowledge.update");
  const live = allPublic.filter((a) => a.status === "published");
  return (
    <>
      <PageHeader title="قاعدة المعرفة" subtitle="مقالات المساعدة والأسئلة الشائعة للعملاء، ومصدر إجابات وكيل الذكاء الاصطناعي"
        actions={can(bos, "knowledge.create") ? <Link className="admin-btn small" href="/admin/knowledge/new?audience=public&ai=1"><Tx>+ مقال مساعدة</Tx></Link> : null} />
      <div className="bos-kpis">
        <KpiCard label="منشورة للعملاء" value={live.length} />
        <KpiCard label="متاحة للوكيل الذكي" value={live.filter((a) => a.ai_allowed).length} href="/admin/support/knowledge?ai=1&status=published" />
        <KpiCard label="مسودات" value={allPublic.filter((a) => a.status === "draft").length} href="/admin/support/knowledge?status=draft" />
        <KpiCard label="التصنيفات" value={categories.length} />
      </div>
      <Tabs baseHref="/admin/support/knowledge" param="view" active={view} tabs={[{ key: "customers", label: "محتوى العملاء" }, { key: "all", label: "كل المقالات" }]} />
      <FilterBar searchPlaceholder="بحث في العناوين والمحتوى..." filters={[
        { key: "status", label: "الحالة", type: "select", options: [{ value: "published", label: "منشور" }, { value: "draft", label: "مسودة" }, { value: "archived", label: "مؤرشف" }] },
        { key: "category", label: "التصنيف", type: "select", options: categories.map((c) => ({ value: c.id, label: c.name })) },
        { key: "ai", label: "الوكيل الذكي", type: "select", options: [{ value: "1", label: "متاح للوكيل" }, { value: "0", label: "غير متاح للوكيل" }] },
      ]} />
      <Card flush>
        {articles.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>المقال</Tx></th><th><Tx>التصنيف</Tx></th><th><Tx>الجمهور</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>آخر تحديث</Tx></th><th /></tr></thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id}>
                  <td className="cell-primary" data-label="المقال">
                    <Link href={`/admin/knowledge/articles/${a.slug}`}><Tx>{a.title}</Tx></Link>
                    <span className="cell-sub">v{a.version}{a.tags.length ? ` · ${a.tags.map((t) => `#${t}`).join(" ")}` : ""}</span>
                  </td>
                  <td data-label="التصنيف">{(a.kb_categories as { name: string } | null)?.name ?? "—"}</td>
                  <td data-label="الجمهور"><Tx>{a.audience === "public" ? "العملاء" : "داخلي"}</Tx>{a.ai_allowed ? <span className="cell-sub"><Tx>متاح للوكيل الذكي</Tx></span> : null}</td>
                  <td data-label="الحالة"><StatusBadge tone={a.status === "published" ? "success" : a.status === "archived" ? "neutral" : "warning"} label={a.status === "published" ? "منشور" : a.status === "archived" ? "مؤرشف" : "مسودة"} /></td>
                  <td data-label="آخر تحديث">{formatDate(a.updated_at)}</td>
                  <td>
                    <span className="bos-row" style={{ gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <Link className="admin-btn small ghost" href={`/admin/knowledge/articles/${a.slug}`}><Tx>معاينة</Tx></Link>
                      {canEdit ? <Link className="admin-btn small ghost" href={`/admin/knowledge/articles/${a.slug}/edit`}><Tx>تعديل</Tx></Link> : null}
                      <KbRowActions id={a.id} status={a.status} ai={!!a.ai_allowed} canPublish={canPublish} canEdit={canEdit && a.audience === "public"} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title={view === "customers" ? "لا توجد مقالات للعملاء بعد" : "لا توجد مقالات"} description={view === "customers" ? "اكتب مقال مساعدة واجعل جمهوره «عام» ليظهر هنا ويستخدمه الوكيل الذكي." : undefined} />}
      </Card>
    </>
  );
}
