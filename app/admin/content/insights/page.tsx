import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { contentInsights } from "@/services/bos/content";
import { platforms, type Platform } from "@/lib/bos/social/platforms";
import { MIN_SAMPLE, type Dimension } from "@/lib/bos/content-insights";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { SubNav } from "@/components/bos/SubNav";
import { contentNav } from "../content-nav";
import { ExplainInsights } from "../ContentControls";
import { typeLabels } from "../labels";

const dimLabels: Record<Dimension, string> = { platform: "حسب المنصة", content_type: "حسب نوع المحتوى", weekday: "حسب يوم النشر", hour: "حسب وقت النشر (القاهرة)", hook: "وجود افتتاحية (Hook)", topic: "حسب الموضوع", video_length: "حسب مدة الفيديو" };
const missingLabels: Record<string, string> = {
  no_published_posts: "لا توجد منشورات منشورة في الفترة.",
  reach_missing: "الوصول غير متاح لأكثر من 30% من المنشورات.",
  not_linked_to_content: "أكثر من 30% من المنشورات غير مرتبطة بعنصر محتوى (النوع/الافتتاحية غير معروفين).",
  hook_unknown: "الافتتاحية غير مسجلة لكثير من المنشورات.",
  video_length_missing: "مدة بعض الفيديوهات غير مسجلة.",
  retention_not_collected: "بيانات مدة المشاهدة/الاحتفاظ لا تُجمع حالياً من المنصات.",
  small_sample: "عدد المنشورات قليل (أقل من 10) — أي استنتاج ضعيف.",
};
const valueLabel = (d: Dimension, v: string) => (d === "platform" ? platforms[v as Platform]?.label ?? v : d === "content_type" ? typeLabels[v] ?? v : d === "hook" ? (v === "with_hook" ? "مع افتتاحية" : "بدون افتتاحية") : v);

// Why content wins or loses (docs/bos/30 §13.4): grouped real numbers with
// sample sizes; an optional AI explanation keeps facts, hypotheses and gaps apart.
export default async function ContentInsightsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("content.read");
  const sp = await readParams(searchParams);
  const days = ["30", "90", "180", "365"].includes(sp.days ?? "") ? Number(sp.days) : 90;
  const to = new Date().toISOString();
  const from = new Date(Date.now() - days * 86400_000).toISOString();
  const [r, { count: ai }] = await Promise.all([contentInsights(bos, { from, to }), db().from("integration_connections").select("id", { count: "exact", head: true }).in("provider", ["anthropic", "openai", "gemini"]).eq("status", "active")]);
  return (
    <>
      <PageHeader title="لماذا ينجح المحتوى أو يفشل" subtitle="من أرقام المنشورات الفعلية فقط — مع حجم العينة لكل مجموعة" breadcrumbs={[{ label: "التسويق" }, { label: "استوديو المحتوى", href: "/admin/content" }, { label: "التحليل" }]} />
      <SubNav items={contentNav(bos)} active="insights" label="استوديو المحتوى" />
      <FilterBar filters={[{ key: "days", label: "الفترة", type: "select", options: [{ value: "30", label: "آخر 30 يوماً" }, { value: "90", label: "آخر 90 يوماً" }, { value: "180", label: "آخر 6 أشهر" }, { value: "365", label: "آخر سنة" }] }]} />
      <Card title="ما الذي ينقص البيانات"><ul style={{ margin: 0, paddingInlineStart: 18 }}>{r.missing.map((m) => <li key={m}><Tx>{missingLabels[m] ?? m}</Tx></li>)}</ul><p className="bos-hint"><Tx vars={{ n: String(MIN_SAMPLE) }}>{"المجموعات التي فيها أقل من {n} منشورات بأرقام تفاعل مُعلّمة «عينة صغيرة» ولا تصلح للاستنتاج."}</Tx></p></Card>
      {r.posts ? (
        <>
          <Card title="الشرح بالذكاء الاصطناعي"><ExplainInsights from={from} to={to} aiReady={!!ai} /></Card>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}>
            {(Object.keys(dimLabels) as Dimension[]).map((d) => {
              const g = r.dimensions[d];
              return (
                <Card key={d} title={dimLabels[d]} flush>
                  {g.groups.length ? (
                    <table className="bos-table">
                      <thead><tr><th><Tx>المجموعة</Tx></th><th><Tx>منشورات</Tx></th><th><Tx>متوسط التفاعل</Tx></th><th><Tx>متوسط الوصول</Tx></th></tr></thead>
                      <tbody>
                        {g.groups.map((x) => (
                          <tr key={x.value} style={{ opacity: x.lowSample ? 0.6 : 1 }}>
                            <td><Tx>{valueLabel(d, x.value)}</Tx>{x.lowSample ? <span className="bos-tag" style={{ marginInlineStart: 4 }}><Tx>عينة صغيرة</Tx></span> : null}</td>
                            <td className="bos-num">{x.posts}</td>
                            <td className="bos-num">{x.avgEngagement != null ? `${x.avgEngagement}%` : <span className="bos-faint"><Tx>غير متاح</Tx></span>}</td>
                            <td className="bos-num">{x.avgReach != null ? Math.round(x.avgReach).toLocaleString("en-US") : <span className="bos-faint"><Tx>غير متاح</Tx></span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p className="bos-hint" style={{ padding: 12 }}><Tx>لا توجد بيانات لهذا البُعد.</Tx></p>}
                  {g.missing ? <p className="bos-faint" style={{ fontSize: 11.5, padding: "4px 12px 10px" }}><Tx vars={{ n: String(g.missing) }}>{"{n} منشور بدون قيمة لهذا البُعد."}</Tx></p> : null}
                </Card>
              );
            })}
          </div>
        </>
      ) : <Card><EmptyState title="لا توجد منشورات منشورة في هذه الفترة" /></Card>}
    </>
  );
}
