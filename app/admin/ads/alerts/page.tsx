import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { listAdAccounts } from "@/services/bos/ads";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { SubNav } from "@/components/bos/SubNav";
import { adsNav } from "../ads-nav";
import { AlertForm, DeleteAlert } from "../AdsControls";

const metricLabels: Record<string, string> = { daily_spend: "الإنفاق اليومي", cpa: "CPA", cpc: "CPC", ctr: "CTR %", roas: "ROAS" };

// Spend / performance alerts (docs/bos/30 §14): checked after every sync on
// the latest complete day; one alert per rule per day; never on missing data.
export default async function AdAlertsPage() {
  const { bos } = await requirePermission("ads.manage");
  const [{ data: rules }, accounts, staff, names] = await Promise.all([db().from("ad_alert_rules").select("*").order("created_at"), listAdAccounts(), listActiveStaff(), userNameMap()]);
  const accName = new Map(accounts.map((a) => [a.id, `${a.name} (${a.currency})`]));
  return (
    <>
      <PageHeader title="تنبيهات الإعلانات" breadcrumbs={[{ label: "التسويق" }, { label: "الإعلانات", href: "/admin/ads" }, { label: "التنبيهات" }]} />
      <SubNav items={adsNav(bos)} active="alerts" label="الإعلانات" />
      <Card title="تنبيه جديد"><AlertForm accounts={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))} staff={staff.map((s) => ({ value: s.userId, label: s.name }))} /></Card>
      <Card flush>
        {rules?.length ? (
          <table className="bos-table">
            <thead><tr><th><Tx>الاسم</Tx></th><th><Tx>الحساب</Tx></th><th><Tx>الشرط</Tx></th><th><Tx>المستلمون</Tx></th><th><Tx>آخر إطلاق</Tx></th><th /></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.account_id ? accName.get(r.account_id) ?? "—" : <Tx>كل الحسابات</Tx>}</td>
                  <td dir="ltr"><Tx>{metricLabels[r.metric] ?? r.metric}</Tx> {r.comparator === "gt" ? ">" : "<"} {Number(r.threshold)}</td>
                  <td style={{ fontSize: 12 }}>{r.notify_user_ids.map((u) => names.get(u) ?? "—").join("، ")}</td>
                  <td>{r.last_triggered_on ?? "—"}</td>
                  <td><DeleteAlert id={r.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد تنبيهات" />}
      </Card>
    </>
  );
}
