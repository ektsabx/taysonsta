import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KeyValues } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { yoliasPlanIds, yoliasPlanLabel } from "@/lib/yolias/plans";
import { getPlanTerms } from "@/services/yolias/usage";
import { NotConnected, connected, num, usd } from "@/components/yolias/PlatformUi";
import { PlanQuotaForm } from "../UsageForms";

// Plans and prospect quotas (docs/06, D-005: to protect margins, lower the
// prospects per plan rather than raise prices). Changes apply from now on.
export default async function PlansPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الخطط والحصص" /><NotConnected /></>);
  const terms = await getPlanTerms();
  const manage = can(bos, "platform.manage", "all");
  return (
    <>
      <PageHeader title="الخطط والحصص" subtitle="حصة العملاء المحتملين لكل خطة. التغيير يسري فوراً على كل مساحات العمل في الخطة، بما فيها صفحة الأسعار." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {yoliasPlanIds.map((p) => (
          <Card key={p} title={yoliasPlanLabel[p]}>
            <KeyValues items={[
              { label: "السعر الشهري", value: usd(terms[p].priceUsd) },
              { label: "العملاء المحتملون شهرياً", value: num(terms[p].prospects) },
              { label: "آخر تعديل", value: terms[p].updatedBy ? `${terms[p].updatedBy} · ${formatDateTime(terms[p].updatedAt)}` : "—" },
            ]} />
            {manage ? <PlanQuotaForm plan={p} prospects={terms[p].prospects} /> : null}
          </Card>
        ))}
      </div>
      <p className="bos-faint" style={{ fontSize: 12 }}><Tx>الأسعار تُعدّل مع مزود الدفع عند ربطه؛ هنا تُعدّل الحصص فقط.</Tx></p>
    </>
  );
}
