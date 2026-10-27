import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { SeoNotReady } from "@/components/yolias/SeoUi";
import { formatList } from "@/lib/yolias/seo-pages";
import { formatPrices, getCompetitor } from "@/services/yolias/seo/catalog";
import { seoReady } from "@/services/yolias/seo/indexing";
import { CompetitorForm, type CompetitorValues } from "../CompetitorForm";

type L = { en?: string; ar?: string };
type LL = { en?: string[]; ar?: string[] };

export default async function CompetitorEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="منافس" /><NotConnected /></>);
  if (!(await seoReady())) return (<><PageHeader title="منافس" /><SeoNotReady /></>);
  const { id } = await params;
  let v: CompetitorValues = { id: null, slug: "", name: "", website: "https://", pricingUrl: "", publishesPrices: "unknown", pricing: "", en: { summary: "", bestFor: "", strengths: "", limits: "" }, ar: { summary: "", bestFor: "", strengths: "", limits: "" } };
  let reviewed: string | null = null;
  if (id !== "new") {
    if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
    const c = await getCompetitor(id).catch(() => null);
    if (!c) notFound();
    const side = (l: "en" | "ar") => ({ summary: (c.summary as L)?.[l] ?? "", bestFor: (c.best_for as L)?.[l] ?? "", strengths: formatList((c.strengths as LL)?.[l]), limits: formatList((c.limits as LL)?.[l]) });
    v = { id: c.id, slug: c.slug, name: c.name, website: c.website, pricingUrl: c.pricing_url ?? "", publishesPrices: c.publishes_prices === true ? "yes" : c.publishes_prices === false ? "no" : "unknown", pricing: formatPrices(c.pricing), en: side("en"), ar: side("ar") };
    reviewed = c.last_reviewed_at ? `${formatDateTime(c.last_reviewed_at)}${c.reviewed_by ? ` · ${c.reviewed_by}` : ""}` : null;
  }
  return (
    <>
      <PageHeader title={v.name || "منافس جديد"} subtitle={reviewed ? <Tx vars={{ v: reviewed }}>{"آخر مراجعة: {v}"}</Tx> : "لم تُراجع بعد"} actions={<Link className="admin-btn secondary" href="/admin/platform/seo/competitors"><Tx>كل المنافسين</Tx></Link>} />
      <Card>{can(bos, "platform.manage", "all") ? <CompetitorForm v={v} /> : <pre dir="auto" style={{ whiteSpace: "pre-wrap" }}>{v.ar.summary}</pre>}</Card>
    </>
  );
}
