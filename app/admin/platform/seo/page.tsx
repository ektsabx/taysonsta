import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, StatusBadge, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { seoAudit } from "@/services/yolias/modules";
import { num } from "@/components/yolias/PlatformUi";

const issueLabel: Record<string, string> = {
  no_title: "بلا عنوان", long_title: "العنوان طويل", no_description: "بلا وصف", long_description: "الوصف طويل",
  no_h1: "بلا H1", many_h1: "أكثر من H1", wrong_lang: "لغة الصفحة خاطئة", duplicate_description: "وصف مكرر",
};

// SEO (final spec phase 9): a live check of the Yolias website — title,
// description, one H1 and the page language for each public page in both
// languages, plus robots.txt and the sitemap.
export default async function SeoPage() {
  await requirePermission("platform.read");
  const a = await seoAudit();
  if (!a.base) return (<><PageHeader title="تحسين محركات البحث" /><EmptyState title="رابط موقع Yolias غير مضبوط" description="YOLIAS_SITE_URL" /></>);
  const withIssues = a.pages.filter((p) => p.issues.length).length;
  return (
    <>
      <PageHeader title="تحسين محركات البحث" subtitle={`فحص مباشر لموقع ${a.base}`} />
      <div className="bos-kpis">
        <KpiCard label="صفحات بلا مشاكل" value={`${num(a.pages.length - withIssues)} / ${num(a.pages.length)}`} />
        <KpiCard label="robots.txt" value={a.robots ? <StatusBadge tone={a.robots.sitemap && a.robots.disallowsApp ? "success" : "warning"} label={a.robots.sitemap ? "سليم" : "بلا خريطة"} /> : <StatusBadge tone="danger" label="غير موجود" />} />
        <KpiCard label="خريطة الموقع" value={a.sitemapUrls == null ? <StatusBadge tone="danger" label="غير موجودة" /> : <Tx vars={{ n: num(a.sitemapUrls) }}>{"{n} رابط"}</Tx>} />
      </div>
      <Card title="الصفحات">
        <BosTable className="bos-table">
          <thead><tr><th><Tx>الصفحة</Tx></th><th><Tx>اللغة</Tx></th><th><Tx>العنوان</Tx></th><th><Tx>الوصف</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
          <tbody>{a.pages.map((p) => (
            <tr key={`${p.path}:${p.locale}`}>
              <td dir="ltr">{p.path}</td>
              <td dir="ltr">{p.locale}</td>
              <td dir="auto" style={{ maxWidth: 260 }}>{p.title ?? "—"}{p.title && <span className="cell-sub">{p.title.length}</span>}</td>
              <td dir="auto" style={{ maxWidth: 320, fontSize: 12 }}>{p.description ?? "—"}{p.description && <span className="cell-sub">{p.description.length}</span>}</td>
              <td>{p.issues.length ? p.issues.map((i) => <StatusBadge key={i} tone="warning" label={issueLabel[i] ?? i} />) : <StatusBadge tone="success" label="سليمة" />}</td>
            </tr>
          ))}</tbody>
        </BosTable>
        <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>العنوان حتى 65 حرفاً والوصف حتى 170 حرفاً، وعنوان H1 واحد لكل صفحة.</Tx></p>
      </Card>
    </>
  );
}
