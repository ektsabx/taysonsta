import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, StatusBadge, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { blocksToMarkdown } from "@/lib/yolias/content";
import { emptyMeta, formatCompare, formatFaq, formatLinks, formatList, formatSteps, seoKindLabel, seoKinds, seoPath, seoStatusLabel, type SeoKind, type SeoMeta } from "@/lib/yolias/seo-pages";
import { getSeoPage, listRevisions, previewUrl, type SeoRow } from "@/services/yolias/seo/pages";
import { listCompetitors } from "@/services/yolias/seo/catalog";
import { pageStats } from "@/services/yolias/seo/metrics";
import { seoReady } from "@/services/yolias/seo/indexing";
import { ydb } from "@/lib/yolias/db";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { SeoNotReady, pct, pos } from "@/components/yolias/SeoUi";
import { deleteSeoPageAction, restoreRevisionAction, setSeoStatusAction } from "../../actions";
import { SeoPageForm, type Lang, type SeoFormValues } from "../SeoPageForm";

function values(r: SeoRow | null, kind: SeoKind): SeoFormValues {
  const m: SeoMeta = { ...emptyMeta(), ...(r?.meta ?? {}) };
  const lang = (l: "en" | "ar"): Lang => ({
    title: r?.doc[l]?.title ?? "", summary: r?.doc[l]?.summary ?? "", body: r ? blocksToMarkdown(r.doc[l]?.blocks ?? []) : "",
    metaTitle: r?.seo?.meta_title?.[l] ?? "", metaDescription: r?.seo?.meta_description?.[l] ?? "", h1: r?.seo?.h1?.[l] ?? "",
    answer: m.answer?.[l] ?? "", audience: formatList(m.audience?.[l]), criteria: formatList(m.criteria?.[l]), steps: formatSteps(m.steps?.[l]),
    compare: formatCompare(m.compare?.[l]), faq: formatFaq(m.faq?.[l], l === "ar"),
    ctaTitle: m.cta?.[l]?.title ?? "", ctaBody: m.cta?.[l]?.body ?? "", ctaLabel: m.cta?.[l]?.label ?? "", prompt: m.prompt?.[l] ?? "",
  });
  return {
    id: r?.id ?? null, kind, slug: r?.slug ?? "", status: r?.status ?? "draft", scheduledAt: r?.scheduled_at ?? "", sort: r?.sort ?? 0,
    primaryKeyword: r?.primary_keyword ?? "", secondaryKeywords: (r?.secondary_keywords ?? []).join(", "), origin: m.origin === "human" ? "human" : r ? "ai_draft" : "human",
    format: m.format === "list" ? "list" : "versus", competitor: m.competitor ?? "", tools: (m.tools ?? []).join(", "), links: formatLinks(m.links), sources: formatList(m.sources),
    canonical: r?.seo?.canonical ?? "", robots: r?.seo?.robots === "noindex" ? "noindex" : "index", schema: r?.seo?.schema === "none" ? "none" : "auto",
    en: lang("en"), ar: lang("ar"),
  };
}

// Edit one SEO page, or create one (/new?kind=compare) (D-257).
export default async function SeoPageEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="صفحة SEO" /><NotConnected /></>);
  if (!(await seoReady())) return (<><PageHeader title="صفحة SEO" /><SeoNotReady /></>);
  const { id } = await params;
  const sp = await searchParams;
  let row: SeoRow | null = null;
  let kind: SeoKind = seoKinds.includes(sp.kind as SeoKind) ? (sp.kind as SeoKind) : "compare";
  if (id !== "new") {
    if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
    row = await getSeoPage(id).catch(() => null);
    if (!row) notFound();
    kind = row.kind;
  }
  const manage = can(bos, "platform.manage", "all");
  const [competitors, revisions, stats] = await Promise.all([listCompetitors(), row ? listRevisions(row.id) : Promise.resolve([]), row ? pageStats(28) : Promise.resolve(null)]);
  const v = values(row, kind);
  const path = row ? seoPath(row.kind, row.slug) : null;
  const site = (process.env.YOLIAS_SITE_URL ?? "").replace(/\/$/, "");
  const s = path ? stats?.stats.get(path) : undefined;
  const c = path ? stats?.conversions.get(path) : undefined;
  const { data: queries } = path && stats ? await ydb().from("seo_query_daily").select("query, clicks, impressions, position").eq("page", path).gte("day", stats.period.from).order("impressions", { ascending: false }).limit(200) : { data: null };
  const top = new Map<string, { clicks: number; impressions: number; position: number | null }>();
  for (const q of queries ?? []) { const a = top.get(q.query) ?? { clicks: 0, impressions: 0, position: q.position }; a.clicks += q.clicks; a.impressions += q.impressions; top.set(q.query, a); }
  const preview = row ? previewUrl(row.id) : null;

  return (
    <>
      <PageHeader title={row ? row.doc.ar.title || row.slug : `صفحة ${seoKindLabel[kind]} جديدة`} subtitle={<Tx>{seoKindLabel[kind]}</Tx>}
        actions={<span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {preview && <a className="admin-btn secondary" href={preview} target="_blank" rel="noreferrer"><Tx>معاينة</Tx></a>}
          {row?.status === "published" && site && path && <a className="admin-btn secondary" href={`${site}${path}`} target="_blank" rel="noreferrer"><Tx>فتح في الموقع</Tx></a>}
          <Link className="admin-btn secondary" href="/admin/platform/seo/pages"><Tx>كل الصفحات</Tx></Link>
        </span>} />
      {row && (
        <>
          <div className="bos-kpis">
            <KpiCard label="الحالة" value={<StatusBadge tone={seoStatusLabel[row.status].tone} label={seoStatusLabel[row.status].label} />} sub={row.meta.origin !== "human" ? "مسودة آلية تحتاج مراجعة" : undefined} />
            <KpiCard label="النقرات (28 يومًا)" value={s ? num(s.clicks) : "—"} />
            <KpiCard label="مرات الظهور" value={s ? num(s.impressions) : "—"} sub={s ? <Tx vars={{ ctr: pct(s.ctr, 2), pos: pos(s.position) }}>{"نسبة النقر {ctr} · الترتيب {pos}"}</Tx> : undefined} />
            <KpiCard label="تسجيلات من الصفحة" value={num(c?.signups ?? 0)} sub={<Tx vars={{ n: num(c?.paid ?? 0) }}>{"{n} دفعوا"}</Tx>} />
          </div>
          {manage && (
            <Card title="النشر">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {row.status !== "published" && row.meta.origin === "human" && (
                  <ActionForm action={setSeoStatusAction} successMessage="نُشرت"><input type="hidden" name="id" value={row.id} /><input type="hidden" name="status" value="published" /><SubmitButton label="نشر الآن" /></ActionForm>
                )}
                {row.status === "published" && (
                  <ActionForm action={setSeoStatusAction} successMessage="أصبحت مسودة"><input type="hidden" name="id" value={row.id} /><input type="hidden" name="status" value="draft" /><SubmitButton label="إلغاء النشر" className="admin-btn secondary" /></ActionForm>
                )}
                {row.status !== "hidden" && (
                  <ActionForm action={setSeoStatusAction} successMessage="أُخفيت"><input type="hidden" name="id" value={row.id} /><input type="hidden" name="status" value="hidden" /><SubmitButton label="إخفاء من الموقع" className="admin-btn secondary" /></ActionForm>
                )}
                {row.status !== "published" && (
                  <ActionForm action={deleteSeoPageAction} successMessage="حُذفت"><input type="hidden" name="id" value={row.id} /><SubmitButton label="حذف الصفحة" className="admin-btn secondary" /></ActionForm>
                )}
              </div>
              {row.meta.origin !== "human" && <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>هذه الصفحة كتبها الذكاء الاصطناعي كمسودة: راجع كل معلومة ومصدرها، ثم فعّل «راجعت المحتوى» في النموذج واحفظ، وبعدها يظهر زر النشر.</Tx></p>}
            </Card>
          )}
        </>
      )}
      <Card>{manage ? <SeoPageForm v={v} competitors={competitors.map((x) => ({ slug: x.slug, name: x.name }))} /> : <pre dir="auto" style={{ whiteSpace: "pre-wrap" }}>{v.ar.body}</pre>}</Card>
      {row && (
        <div className="bos-grid cols-2">
          <Card title="عبارات البحث لهذه الصفحة (28 يومًا)">
            {top.size ? (
              <div className="bos-table-scroll"><BosTable className="bos-table"><thead><tr><th><Tx>العبارة</Tx></th><th><Tx>النقرات</Tx></th><th><Tx>مرات الظهور</Tx></th><th><Tx>الترتيب</Tx></th></tr></thead>
                <tbody>{[...top].sort((a, b) => b[1].impressions - a[1].impressions).slice(0, 25).map(([q, x]) => <tr key={q}><td dir="auto">{q}</td><td>{num(x.clicks)}</td><td>{num(x.impressions)}</td><td>{pos(x.position)}</td></tr>)}</tbody></BosTable></div>
            ) : <EmptyState title="لا توجد بيانات" description="تظهر بعد النشر وربط Search Console." />}
          </Card>
          <Card title="سجل التعديلات">
            {revisions.length ? (
              <div className="bos-table-scroll"><BosTable className="bos-table"><thead><tr><th><Tx>التاريخ</Tx></th><th><Tx>بواسطة</Tx></th><th><Tx>الحالة</Tx></th><th /></tr></thead>
                <tbody>{revisions.map((r, i) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.saved_at)}</td><td>{r.saved_by ?? "—"}</td><td><Tx>{seoStatusLabel[r.status as keyof typeof seoStatusLabel]?.label ?? r.status}</Tx></td>
                    <td>{manage && i > 0 && <ActionForm action={restoreRevisionAction} successMessage="استُعيدت النسخة"><input type="hidden" name="id" value={row!.id} /><input type="hidden" name="revision" value={r.id} /><SubmitButton label="استعادة" className="admin-btn secondary" /></ActionForm>}</td>
                  </tr>
                ))}</tbody></BosTable></div>
            ) : <EmptyState title="لا يوجد" />}
          </Card>
        </div>
      )}
    </>
  );
}
