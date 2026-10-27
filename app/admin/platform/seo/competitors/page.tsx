import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { SeoNotReady } from "@/components/yolias/SeoUi";
import { listCompetitors, type CompetitorPrice } from "@/services/yolias/seo/catalog";
import { listSeoPages } from "@/services/yolias/seo/pages";
import { seoReady } from "@/services/yolias/seo/indexing";

const dueForReview = (at: string | null) => !at || Date.now() - Date.parse(at) > 90 * 86_400_000;

// Competitors (D-257): the facts comparison and alternatives pages use, each
// with its source and review date. Older than 90 days = due for review.
export default async function SeoCompetitorsPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="المنافسون" /><NotConnected /></>);
  if (!(await seoReady())) return (<><PageHeader title="المنافسون" /><SeoNotReady /></>);
  const [rows, pages] = await Promise.all([listCompetitors(), listSeoPages()]);
  const manage = can(bos, "platform.manage", "all");
  const usedBy = (slug: string) => pages.filter((p) => p.meta.competitor === slug || (p.meta.tools ?? []).includes(slug)).length;
  return (
    <>
      <PageHeader title="المنافسون" subtitle="المعلومات التي تعرضها صفحات المقارنة والبدائل، بمصدرها وتاريخ مراجعتها. السعر لا يظهر في الموقع إلا بعد توثيقه." actions={manage ? <Link className="admin-btn" href="/admin/platform/seo/competitors/new"><Tx>منافس جديد</Tx></Link> : undefined} />
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll"><BosTable className="bos-table">
            <thead><tr><th><Tx>المنافس</Tx></th><th><Tx>الأسعار</Tx></th><th><Tx>صفحات تستخدمه</Tx></th><th><Tx>آخر مراجعة</Tx></th></tr></thead>
            <tbody>{rows.map((r) => {
              const prices = (Array.isArray(r.pricing) ? r.pricing : []) as unknown as CompetitorPrice[];
              const verified = prices.filter((p) => p.verified).length;
              const stale = dueForReview(r.last_reviewed_at);
              return (
                <tr key={r.id}>
                  <td><Link className="bos-link" href={`/admin/platform/seo/competitors/${r.id}`}>{r.name}</Link><span className="cell-sub" dir="ltr">{r.website}</span></td>
                  <td>{r.publishes_prices === false ? <Tx>لا ينشر أسعارًا</Tx> : prices.length ? <Tx vars={{ v: num(verified), n: num(prices.length) }}>{"{v} موثّق من {n}"}</Tx> : "—"}</td>
                  <td>{num(usedBy(r.slug))}</td>
                  <td>{r.last_reviewed_at ? <>{formatDateTime(r.last_reviewed_at)}{r.reviewed_by && <span className="cell-sub">{r.reviewed_by}</span>}</> : <StatusBadge tone="warning" label="لم تُراجع" />}{r.last_reviewed_at && stale && <StatusBadge tone="warning" label="تحتاج مراجعة" />}</td>
                </tr>
              );
            })}</tbody>
          </BosTable></div>
        ) : <EmptyState title="لا يوجد منافسون" description="شغّل npm run seo:seed في Yolias لإضافة المنافسين الثمانية الأوائل بمصادرهم، أو أضف منافسًا." />}
      </Card>
    </>
  );
}
