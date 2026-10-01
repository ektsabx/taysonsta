import { ImportButton } from "@/components/bos/ImportButton";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { getRequiredReading, listArticles, listCategories, popularArticles } from "@/services/bos/knowledge";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { ArticleList } from "./ArticleList";

// Knowledge Base home (§42): categories, search, recent, popular, required reading.
export default async function KnowledgePage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("knowledge.read");
  const sp = await readParams(searchParams);
  const [categories, articles, popular, required] = await Promise.all([
    listCategories(),
    listArticles(bos, { q: sp.q, category: sp.category, kind: sp.kind, tag: sp.tag, status: sp.status }),
    popularArticles(bos),
    getRequiredReading(bos),
  ]);
  const filtering = !!(sp.q || sp.category || sp.kind || sp.tag || sp.status);
  return (
    <>
      <PageHeader
        title="قاعدة المعرفة"
       
        actions={<span className="bos-row" style={{ gap: 6 }}><ImportButton bos={bos} type="kb_articles" />{<>{can(bos, "knowledge.create") ? <Link className="admin-btn small" href="/admin/knowledge/new"><Tx>+ مقال</Tx></Link> : null}<Link className="admin-btn small ghost" href="/admin/knowledge/sops"><Tx>إجراءات التشغيل</Tx></Link><Link className="admin-btn small ghost" href="/admin/knowledge/playbooks"><Tx>أدلة المبيعات</Tx></Link><Link className="admin-btn small ghost" href="/admin/knowledge/docs"><Tx>التوثيق والسياسات</Tx></Link></>}</span>}
      />
      {required.filter((r) => !r.upToDate).length ? (
        <Card title="قراءة مطلوبة">
          {required.filter((r) => !r.upToDate).map((r) => (
            <div key={r.id} style={{ marginBottom: 6 }}>
              <Link className="bos-link" href={`/admin/knowledge/articles/${r.slug}`}><Tx>{r.title}</Tx></Link>
              <span className="bos-faint" style={{ fontSize: 12 }}> {r.readVersion ? `قرأت v${r.readVersion} — الإصدار الحالي v${r.version}` : "لم تُقرأ بعد"}</span>
            </div>
          ))}
        </Card>
      ) : null}
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 14 }}>
        {categories.map((c) => (
          <Link key={c.id} href={`/admin/knowledge?category=${c.id}`} className={`bos-kpi${sp.category === c.id ? " active" : ""}`}>
            <div className="bos-kpi-label">{c.name}</div>
            <div className="bos-kpi-sub">{articles.filter((a) => a.category_id === c.id).length || ""}</div>
          </Link>
        ))}
      </div>
      <FilterBar
        searchPlaceholder="بحث في العناوين والمحتوى..."
        filters={[
          { key: "kind", label: "النوع", type: "select", options: [{ value: "article", label: "مقال" }, { value: "sop", label: "إجراء تشغيل" }, { value: "playbook", label: "دليل مبيعات" }, { value: "documentation", label: "توثيق" }, { value: "policy", label: "سياسة" }, { value: "onboarding_guide", label: "دليل تهيئة" }] },
          { key: "tag", label: "وسم", type: "text" },
          ...(can(bos, "knowledge.update") ? [{ key: "status", label: "الحالة", type: "select" as const, options: [{ value: "published", label: "منشور" }, { value: "draft", label: "مسودة" }, { value: "archived", label: "مؤرشف" }] }] : []),
        ]}
      />
      <div className="bos-grid main-side">
        <Card title={filtering ? `النتائج (${articles.length})` : "الأحدث"} flush>
          <ArticleList rows={filtering ? articles : articles.slice(0, 20)} empty={filtering ? "لا توجد نتائج متاحة لك" : "لا توجد مقالات"} />
        </Card>
        <Card title="الأكثر قراءة">
          {popular.filter((p) => p.reads > 0).length ? popular.filter((p) => p.reads > 0).map((p) => (
            <div key={p.id} style={{ marginBottom: 6 }}><Link className="bos-link" href={`/admin/knowledge/articles/${p.slug}`}><Tx>{p.title}</Tx></Link> <span className="bos-faint" style={{ fontSize: 12 }}><Tx vars={{ reads: p.reads }}>{"· {reads} قراءة"}</Tx></span></div>
          )) : <EmptyState title="لا توجد قراءات بعد" />}
        </Card>
      </div>
    </>
  );
}
