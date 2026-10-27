import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { SeoNotReady, pos } from "@/components/yolias/SeoUi";
import { listKeywords, sharedTargets } from "@/services/yolias/seo/catalog";
import { seoReady } from "@/services/yolias/seo/indexing";
import { ydb } from "@/lib/yolias/db";
import { period } from "@/services/yolias/seo/metrics";
import { KeywordForm, intentLabel, pageTypeLabel, stageLabel, type KeywordValues } from "./KeywordForm";

const empty: KeywordValues = { id: null, keyword: "", locale: "en", intent: "commercial", cluster: "", pageType: "", priority: "2", stage: "idea", targetPath: "", volume: "", volumeSource: "", difficulty: "", difficultySource: "", notes: "", related: "" };

// Keywords and opportunities (D-257). Search volume and difficulty appear
// only with their source; Search Console shows what each keyword really got.
export default async function SeoKeywordsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الكلمات والفرص" /><NotConnected /></>);
  if (!(await seoReady())) return (<><PageHeader title="الكلمات والفرص" /><SeoNotReady /></>);
  const sp = await searchParams;
  const [rows, allRows] = await Promise.all([listKeywords(sp), listKeywords()]);
  const manage = can(bos, "platform.manage", "all");
  const p = period(28);
  // What Search Console saw for these exact words in the last 28 days.
  const { data: seen } = await ydb().from("seo_query_daily").select("query, clicks, impressions, position").gte("day", p.from).in("query", rows.map((r) => r.keyword.toLowerCase()).slice(0, 300));
  const gsc = new Map<string, { clicks: number; impressions: number; position: number | null }>();
  for (const s of seen ?? []) { const a = gsc.get(s.query) ?? { clicks: 0, impressions: 0, position: s.position }; a.clicks += s.clicks; a.impressions += s.impressions; gsc.set(s.query, a); }
  const shared = sharedTargets(allRows);
  const clusters = [...new Set(allRows.map((r) => r.cluster).filter(Boolean))] as string[];
  const editing = sp.edit ? allRows.find((r) => r.id === sp.edit) : null;
  const v: KeywordValues = editing ? {
    id: editing.id, keyword: editing.keyword, locale: editing.locale, intent: editing.intent, cluster: editing.cluster ?? "", pageType: editing.page_type ?? "", priority: String(editing.priority), stage: editing.stage,
    targetPath: editing.target_path ?? "", volume: editing.volume == null ? "" : String(editing.volume), volumeSource: editing.volume_source ?? "", difficulty: editing.difficulty == null ? "" : String(editing.difficulty), difficultySource: editing.difficulty_source ?? "", notes: editing.notes ?? "", related: editing.related.join(", "),
  } : empty;
  return (
    <>
      <PageHeader title="الكلمات والفرص" subtitle="الكلمات المستهدفة ونية البحث والصفحة المناسبة لكل منها. لا يوجد مزود أحجام بحث متصل: الأحجام اليدوية مكتوب عليها أنها تقدير." />
      {shared.size > 0 && (
        <Card title="كلمات تتشارك نفس الصفحة">
          <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, lineHeight: 1.8 }}>{[...shared].map(([path, kws]) => <li key={path}><span dir="ltr">{path}</span>: <span dir="auto">{kws.join("، ")}</span></li>)}</ul>
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>طبيعي للكلمات الثانوية؛ إن كانت كلها رئيسية بنوايا مختلفة فقد تحتاج صفحة منفصلة.</Tx></p>
        </Card>
      )}
      {manage && <Card title={editing ? "تعديل كلمة" : "إضافة كلمة"} actions={editing ? <Link className="admin-btn secondary" href="/admin/platform/seo/keywords"><Tx>إلغاء</Tx></Link> : undefined}><KeywordForm key={v.id ?? "new"} v={v} /></Card>}
      <FilterBar searchPlaceholder="ابحث عن كلمة" filters={[
        { key: "cluster", label: "المجموعة", type: "select", options: clusters.map((c) => ({ value: c, label: c })) },
        { key: "stage", label: "المرحلة", type: "select", options: Object.entries(stageLabel).map(([value, label]) => ({ value, label })) },
        { key: "intent", label: "النية", type: "select", options: Object.entries(intentLabel).map(([value, label]) => ({ value, label })) },
        { key: "priority", label: "الأولوية", type: "select", options: [{ value: "1", label: "عالية" }, { value: "2", label: "متوسطة" }, { value: "3", label: "منخفضة" }] },
      ]} />
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll"><BosTable className="bos-table">
            <thead><tr><th><Tx>الكلمة</Tx></th><th><Tx>النية</Tx></th><th><Tx>المجموعة</Tx></th><th><Tx>الصفحة</Tx></th><th><Tx>الأولوية</Tx></th><th><Tx>المرحلة</Tx></th><th><Tx>حجم البحث</Tx></th><th><Tx>الصعوبة</Tx></th><th><Tx>في Search Console (28 يومًا)</Tx></th></tr></thead>
            <tbody>{rows.map((r) => {
              const g = gsc.get(r.keyword.toLowerCase());
              const est = (src: string | null) => (src === "manual_estimate" ? <span className="cell-sub"><Tx>تقدير يدوي</Tx></span> : src ? <span className="cell-sub" dir="ltr">{src}</span> : null);
              return (
                <tr key={r.id}>
                  <td>{manage ? <Link className="bos-link" href={`/admin/platform/seo/keywords?edit=${r.id}`} dir="auto">{r.keyword}</Link> : <span dir="auto">{r.keyword}</span>}<span className="cell-sub">{r.locale.toUpperCase()}{r.notes ? ` · ${r.notes.slice(0, 80)}` : ""}</span></td>
                  <td><Tx>{intentLabel[r.intent]}</Tx></td>
                  <td dir="auto">{r.cluster ?? "—"}</td>
                  <td dir="ltr">{r.target_path ?? (r.page_type ? <span className="bos-faint"><Tx>{pageTypeLabel[r.page_type]}</Tx></span> : "—")}</td>
                  <td>{r.priority === 1 ? <StatusBadge tone="danger" label="عالية" /> : r.priority === 2 ? <StatusBadge tone="neutral" label="متوسطة" /> : <StatusBadge tone="neutral" label="منخفضة" />}</td>
                  <td><Tx>{stageLabel[r.stage]}</Tx></td>
                  <td>{r.volume == null ? <span className="bos-faint"><Tx>غير معروف</Tx></span> : <>{num(r.volume)}{est(r.volume_source)}</>}</td>
                  <td>{r.difficulty == null ? <span className="bos-faint"><Tx>غير معروف</Tx></span> : <>{r.difficulty}{est(r.difficulty_source)}</>}</td>
                  <td>{g ? <Tx vars={{ c: num(g.clicks), i: num(g.impressions), p: pos(g.position) }}>{"{c} نقرة · {i} ظهور · ترتيب {p}"}</Tx> : "—"}</td>
                </tr>
              );
            })}</tbody>
          </BosTable></div>
        ) : <EmptyState title="لا توجد كلمات" description="شغّل npm run seo:seed في Yolias لإضافة خطة الكلمات الأولى، أو أضف كلمة." />}
      </Card>
    </>
  );
}
