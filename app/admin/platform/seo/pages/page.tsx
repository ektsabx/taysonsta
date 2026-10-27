import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { SeoNotReady, pct } from "@/components/yolias/SeoUi";
import { seoKindLabel, seoKinds, seoPath, seoStatusLabel, type SeoKind } from "@/lib/yolias/seo-pages";
import { listSeoPages } from "@/services/yolias/seo/pages";
import { pageStats } from "@/services/yolias/seo/metrics";
import { inspections, lastCrawl, seoReady } from "@/services/yolias/seo/indexing";

// Every SEO page (D-257): the ones made here, and the website's pages from
// code with their search numbers (edited in code, listed so nothing is missed).
export default async function SeoPagesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="صفحات SEO" /><NotConnected /></>);
  if (!(await seoReady())) return (<><PageHeader title="صفحات SEO" /><SeoNotReady /></>);
  const sp = await searchParams;
  const [rows, { stats, conversions }, insp, crawl] = await Promise.all([listSeoPages(), pageStats(28), inspections(), lastCrawl()]);
  const manage = can(bos, "platform.manage", "all");
  const site = (process.env.YOLIAS_SITE_URL ?? "").replace(/\/$/, "");
  const verdict = new Map(insp.map((i) => [new URL(i.url).pathname, i]));
  const q = (sp.q ?? "").toLowerCase();
  const list = rows.map((r) => {
    const path = seoPath(r.kind, r.slug);
    return { ...r, path, s: stats.get(path), c: conversions.get(path), v: verdict.get(path) };
  }).filter((r) =>
    (!sp.kind || r.kind === sp.kind) && (!sp.status || r.status === sp.status) &&
    (!q || r.slug.includes(q) || (r.primary_keyword ?? "").toLowerCase().includes(q) || r.doc.ar.title.toLowerCase().includes(q) || r.doc.en.title.toLowerCase().includes(q)) &&
    (sp.perf !== "clicks" || (r.s?.clicks ?? 0) > 0) && (sp.perf !== "none" || !(r.s?.impressions)) && (sp.perf !== "signups" || (r.c?.signups ?? 0) > 0));
  const mine = new Set(rows.map((r) => seoPath(r.kind, r.slug)));
  const codePaths = [...new Set([...(crawl?.pages ?? []).map((p) => p.path), ...stats.keys()])].filter((p) => !mine.has(p)).sort();

  return (
    <>
      <PageHeader title="صفحات SEO" subtitle="صفحات المقارنة والبدائل والحلول والقوالب، بالكلمة التي تستهدفها كل صفحة وأداؤها في آخر 28 يومًا"
        actions={manage ? <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{seoKinds.map((k) => <Link key={k} className="admin-btn secondary" href={`/admin/platform/seo/pages/new?kind=${k}`}><Tx>{`+ ${seoKindLabel[k]}`}</Tx></Link>)}</span> : undefined} />
      <FilterBar searchPlaceholder="ابحث بالاسم أو الرابط أو الكلمة" filters={[
        { key: "kind", label: "النوع", type: "select", options: seoKinds.map((k) => ({ value: k, label: seoKindLabel[k] })) },
        { key: "status", label: "الحالة", type: "select", options: Object.entries(seoStatusLabel).map(([value, v]) => ({ value, label: v.label })) },
        { key: "perf", label: "الأداء", type: "select", options: [{ value: "clicks", label: "لها نقرات" }, { value: "signups", label: "جلبت تسجيلات" }, { value: "none", label: "بلا ظهور" }] },
      ]} />
      <Card flush>
        {list.length ? (
          <div className="bos-table-scroll"><BosTable className="bos-table">
            <thead><tr>
              <th><Tx>الصفحة</Tx></th><th><Tx>النوع</Tx></th><th><Tx>الكلمة الرئيسية</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الفهرسة</Tx></th>
              <th><Tx>النقرات</Tx></th><th><Tx>مرات الظهور</Tx></th><th><Tx>نسبة النقر</Tx></th><th><Tx>تسجيلات</Tx></th><th><Tx>دفعوا</Tx></th><th><Tx>آخر تعديل</Tx></th>
            </tr></thead>
            <tbody>{list.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link className="bos-link" href={`/admin/platform/seo/pages/${r.id}`}>{r.doc.ar.title}</Link>
                  <span className="cell-sub" dir="ltr">{r.status === "published" && site ? <a className="bos-link" href={`${site}${r.path}`} target="_blank" rel="noreferrer">{r.path}</a> : r.path}</span>
                </td>
                <td><Tx>{seoKindLabel[r.kind as SeoKind]}</Tx></td>
                <td dir="ltr">{r.primary_keyword ?? "—"}{r.secondary_keywords.length > 0 && <span className="cell-sub" title={r.secondary_keywords.join(", ")}><Tx vars={{ n: num(r.secondary_keywords.length) }}>{"+ {n} كلمات ثانوية"}</Tx></span>}</td>
                <td><StatusBadge tone={seoStatusLabel[r.status].tone} label={seoStatusLabel[r.status].label} />{r.status === "scheduled" && r.scheduled_at && <span className="cell-sub">{formatDateTime(r.scheduled_at)}</span>}{r.meta.origin !== "human" && <span className="cell-sub"><Tx>مسودة آلية تحتاج مراجعة</Tx></span>}</td>
                <td>{r.v ? <StatusBadge tone={r.v.verdict === "PASS" ? "success" : r.v.verdict === "FAIL" ? "danger" : "neutral"} label={r.v.coverage_state ?? r.v.verdict ?? "—"} /> : "—"}</td>
                <td>{r.s ? num(r.s.clicks) : "—"}</td>
                <td>{r.s ? num(r.s.impressions) : "—"}</td>
                <td>{r.s ? pct(r.s.ctr, 2) : "—"}</td>
                <td>{num(r.c?.signups ?? 0)}</td>
                <td>{num(r.c?.paid ?? 0)}</td>
                <td>{r.updated_by ? `${r.updated_by} · ` : ""}{formatDateTime(r.updated_at)}</td>
              </tr>
            ))}</tbody>
          </BosTable></div>
        ) : <EmptyState title="لا توجد صفحات" description={rows.length ? "لا يطابق الفلاتر شيء." : "شغّل npm run seo:seed في Yolias لإضافة المسودات الأولى، أو أنشئ صفحة جديدة."} />}
      </Card>
      <Card title="صفحات الموقع من الكود">
        <p className="bos-faint" style={{ fontSize: 12, marginBottom: 8 }}><Tx>الصفحات الرئيسية والأسعار والحلول وحالات الاستخدام مكتوبة في كود Yolias وتتحدّث معه؛ تظهر هنا بأرقامها من خريطة الموقع وSearch Console.</Tx></p>
        {codePaths.length ? (
          <div className="bos-table-scroll"><BosTable className="bos-table">
            <thead><tr><th><Tx>الرابط</Tx></th><th><Tx>النقرات</Tx></th><th><Tx>مرات الظهور</Tx></th><th><Tx>نسبة النقر</Tx></th><th><Tx>تسجيلات</Tx></th><th><Tx>دفعوا</Tx></th></tr></thead>
            <tbody>{codePaths.map((p) => (
              <tr key={p}>
                <td dir="ltr">{site ? <a className="bos-link" href={`${site}${p}`} target="_blank" rel="noreferrer">{p}</a> : p}</td>
                <td>{num(stats.get(p)?.clicks ?? 0)}</td><td>{num(stats.get(p)?.impressions ?? 0)}</td><td>{pct(stats.get(p)?.ctr ?? null, 2)}</td>
                <td>{num(conversions.get(p)?.signups ?? 0)}</td><td>{num(conversions.get(p)?.paid ?? 0)}</td>
              </tr>
            ))}</tbody>
          </BosTable></div>
        ) : <EmptyState title="لا توجد بيانات بعد" description="تظهر بعد فحص الموقع من SEO ← الفهرسة أو بعد ربط Search Console." />}
      </Card>
    </>
  );
}
