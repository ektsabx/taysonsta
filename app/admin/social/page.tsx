import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { formatDateTime } from "@/lib/bos/format";
import { listAccounts, socialAnalytics } from "@/services/bos/social";
import { metricDefs, platforms, platformKeys, type MetricKey, type Platform } from "@/lib/bos/social/platforms";
import { PageHeader, Card, KpiCard, EmptyState } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { SubNav } from "@/components/bos/SubNav";
import { socialNav } from "./social-nav";

const cols: MetricKey[] = ["views", "reach", "impressions", "likes", "comments", "shares", "saves", "clicks"];
const fmt = (n: number | undefined) => (n == null ? null : n.toLocaleString("en-US"));

function range(period: string, from?: string, to?: string) {
  const now = new Date();
  const end = now.toISOString();
  const day = 86400_000;
  if (period === "today") return { from: `${now.toISOString().slice(0, 10)}T00:00:00.000Z`, to: end };
  if (period === "week") return { from: new Date(now.getTime() - 7 * day).toISOString(), to: end };
  if (period === "all") return { from: "2000-01-01T00:00:00.000Z", to: end };
  if (period === "custom" && from && to) return { from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` };
  return { from: new Date(now.getTime() - 30 * day).toISOString(), to: end };
}

// Social analytics (docs/bos/30 §12.4): per platform, per account, per post;
// periods today / week / month / custom / all; comparison with the previous
// period. Metrics a platform doesn't provide show "not available".
export default async function SocialOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("social.read");
  const sp = await readParams(searchParams);
  const period = ["today", "week", "month", "custom", "all"].includes(sp.period ?? "") ? (sp.period as string) : "month";
  const r = range(period, sp.from, sp.to);
  const len = new Date(r.to).getTime() - new Date(r.from).getTime();
  const filter = { platform: sp.platform || null, account_id: sp.account || null };
  const [a, prev, accounts] = await Promise.all([
    socialAnalytics(bos, { ...r, ...filter }),
    period === "all" ? null : socialAnalytics(bos, { from: new Date(new Date(r.from).getTime() - len).toISOString(), to: r.from, ...filter }),
    listAccounts(),
  ]);
  const sum = (x: typeof a, k: MetricKey) => x.platforms.reduce((s, p) => s + (p.metrics[k] ?? 0), 0);
  const has = (x: typeof a, k: MetricKey) => x.platforms.some((p) => p.available.includes(k));
  const delta = (k: MetricKey) => (prev && has(prev, k) && sum(prev, k) > 0 ? Math.round(((sum(a, k) - sum(prev, k)) / sum(prev, k)) * 100) : null);
  const postsNow = a.posts.length;
  const postsPrev = prev?.posts.length ?? null;
  const accName = new Map(accounts.map((x) => [x.id, x.name]));
  return (
    <>
      <PageHeader title="التواصل الاجتماعي" subtitle="الأرقام كما تعرضها كل منصة — مع مصدرها ووقت آخر تحديث" breadcrumbs={[{ label: "التسويق" }, { label: "التحليلات" }]} />
      <SubNav items={socialNav(bos)} active="overview" label="التواصل الاجتماعي" />
      <FilterBar filters={[
        { key: "period", label: "الفترة", type: "select", options: [{ value: "today", label: "اليوم" }, { value: "week", label: "آخر 7 أيام" }, { value: "month", label: "آخر 30 يوماً" }, { value: "custom", label: "مخصص" }, { value: "all", label: "الكل" }] },
        { key: "from", label: "من", type: "date" },
        { key: "to", label: "إلى", type: "date" },
        { key: "platform", label: "المنصة", type: "select", options: platformKeys.map((p) => ({ value: p, label: platforms[p].label })) },
        { key: "account", label: "الحساب", type: "select", options: accounts.map((x) => ({ value: x.id, label: `${platforms[x.platform as Platform]?.label ?? x.platform} · ${x.name}` })) },
      ]} />
      <div className="bos-kpis">
        <KpiCard label="منشورات" value={postsNow} sub={postsPrev != null ? <Tx vars={{ n: String(postsPrev) }}>{"الفترة السابقة: {n}"}</Tx> : undefined} />
        {(["reach", "views", "likes", "comments"] as MetricKey[]).map((k) => (
          <KpiCard key={k} label={metricDefs[k].label} value={has(a, k) ? fmt(sum(a, k)) : <span className="bos-faint" style={{ fontSize: 14 }}><Tx>غير متاح</Tx></span>} sub={delta(k) != null ? `${delta(k)! >= 0 ? "+" : ""}${delta(k)}%` : undefined} trend={delta(k) != null ? (delta(k)! >= 0 ? "up" : "down") : undefined} />
        ))}
      </div>
      <Card title="مقارنة المنصات" flush>
        {a.platforms.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="bos-table">
              <thead><tr><th><Tx>المنصة</Tx></th><th><Tx>منشورات</Tx></th>{cols.map((c) => <th key={c} title={metricDefs[c].definition}><Tx>{metricDefs[c].label}</Tx></th>)}<th><Tx>معدل التفاعل</Tx></th></tr></thead>
              <tbody>
                {a.platforms.map((p) => (
                  <tr key={p.platform}>
                    <td><Tx>{platforms[p.platform].label}</Tx></td>
                    <td className="bos-num">{p.posts}</td>
                    {cols.map((c) => <td key={c} className="bos-num">{p.available.includes(c) ? fmt(p.metrics[c]) : <span className="bos-faint" style={{ fontSize: 11 }}><Tx>غير متاح</Tx></span>}</td>)}
                    <td className="bos-num">{p.engagement != null ? `${p.engagement}%` : <span className="bos-faint" style={{ fontSize: 11 }}><Tx>غير متاح</Tx></span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="لا توجد منشورات منشورة في هذه الفترة" />}
        <p className="bos-hint" style={{ padding: "8px 14px" }}><Tx>معدل التفاعل = (إعجابات + تعليقات + مشاركات + حفظ) ÷ الوصول (أو مرات الظهور/المشاهدات إن لم يتوفر الوصول). تعريفات المقاييس تختلف بين المنصات — مرّر المؤشر على اسم المقياس.</Tx></p>
      </Card>
      <Card title="أداء المنشورات" flush>
        {a.posts.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="bos-table">
              <thead><tr><th><Tx>المنشور</Tx></th><th><Tx>المنصة</Tx></th><th><Tx>النشر</Tx></th>{(["reach", "views", "likes", "comments", "shares"] as MetricKey[]).map((c) => <th key={c}><Tx>{metricDefs[c].label}</Tx></th>)}<th><Tx>التفاعل</Tx></th><th><Tx>المصدر / آخر تحديث</Tx></th></tr></thead>
              <tbody>
                {a.posts.slice(0, 50).map((p) => (
                  <tr key={p.targetId}>
                    <td><Link href={`/admin/social/posts/${p.postId}`}>{p.title}</Link>{p.url ? <> · <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>↗</a></> : null}</td>
                    <td><Tx>{platforms[p.platform].label}</Tx><div className="bos-faint" style={{ fontSize: 11 }}>{p.account}</div></td>
                    <td className="bos-nowrap">{formatDateTime(p.publishedAt)}</td>
                    {(["reach", "views", "likes", "comments", "shares"] as MetricKey[]).map((c) => <td key={c} className="bos-num">{fmt(p.metrics[c]) ?? <span className="bos-faint">—</span>}</td>)}
                    <td className="bos-num">{p.engagement != null ? `${p.engagement}%` : "—"}</td>
                    <td style={{ fontSize: 11.5 }}>{p.sources.length ? p.sources.map((s, i) => <span key={s}>{i ? " + " : ""}{s === "api" ? "API" : <Tx>يدوي</Tx>}</span>) : <Tx>غير متاح</Tx>}{p.lastSync ? <div className="bos-faint">{formatDateTime(p.lastSync)}</div> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="لا توجد بيانات" />}
      </Card>
      {a.followers.length ? (
        <Card title="نمو المتابعين" flush>
          <table className="bos-table">
            <thead><tr><th><Tx>الحساب</Tx></th><th><Tx>بداية الفترة</Tx></th><th><Tx>نهاية الفترة</Tx></th><th><Tx>التغيّر</Tx></th></tr></thead>
            <tbody>{a.followers.map((f) => <tr key={f.account_id}><td>{accName.get(f.account_id) ?? "—"}</td><td className="bos-num">{fmt(f.first)}</td><td className="bos-num">{fmt(f.last)}</td><td className="bos-num">{f.change >= 0 ? "+" : ""}{fmt(f.change)}</td></tr>)}</tbody>
          </table>
        </Card>
      ) : null}
    </>
  );
}
