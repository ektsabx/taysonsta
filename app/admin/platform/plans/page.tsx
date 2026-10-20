import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KeyValues } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { yoliasPlanLabel, type YoliasPlan } from "@/lib/yolias/plans";
import { getPlanTerms } from "@/services/yolias/usage";
import { NotConnected, connected, num, usd } from "@/components/yolias/PlatformUi";
import { PlanQuotaForm } from "../UsageForms";

// Plans and prospect quotas (docs/06, D-005: to protect margins, lower the
// prospects per plan rather than raise prices). Changes apply from now on.
// Two monthly plans are sold (D-247); Pay As You Go is managed in Payments.
const SOLD: YoliasPlan[] = ["pro", "growth"];
export default async function PlansPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الخطط والحصص" /><NotConnected /></>);
  const terms = await getPlanTerms();
  const manage = can(bos, "platform.manage", "all");
  return (
    <>
      <PageHeader title="الخطط والحصص" subtitle="الخطتان الشهريتان: السعر وعدد العملاء المحتملين كل شهر. فوترة شهرية فقط. الدفع حسب الاستخدام يُدار من المدفوعات." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {SOLD.map((p) => (
          <Card key={p} title={yoliasPlanLabel[p]}>
            <KeyValues items={[
              { label: "السعر الشهري", value: usd(terms[p].priceUsd) },
              { label: "السعر الشهري لمصر", value: terms[p].priceEgp == null ? "—" : <span dir="ltr">EGP {num(terms[p].priceEgp)}</span> },
              { label: "العملاء المحتملون شهرياً", value: num(terms[p].prospects) },
              { label: "آخر تعديل", value: terms[p].updatedBy ? `${terms[p].updatedBy} · ${formatDateTime(terms[p].updatedAt)}` : "—" },
            ]} />
            {manage ? <PlanQuotaForm plan={p} prospects={terms[p].prospects} priceUsd={terms[p].priceUsd} priceEgp={terms[p].priceEgp} /> : null}
          </Card>
        ))}
      </div>
      <p className="bos-faint" style={{ fontSize: 12 }}><Tx>تغيير السعر يسري على الاشتراكات الجديدة والتجديدات القادمة. الاشتراكات السنوية أو Scale القديمة تستمر كما هي حتى تنتهي.</Tx></p>
      <p className="bos-faint" style={{ fontSize: 12 }}><Link className="bos-link" href="/admin/platform/payments"><Tx>مبالغ شحن الدفع حسب الاستخدام وسعر العميل المحتمل</Tx></Link></p>
    </>
  );
}
