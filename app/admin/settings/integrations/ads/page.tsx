import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { formatDateTime } from "@/lib/bos/format";
import { listAdAccounts } from "@/services/bos/ads";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/bos/ui";
import { AccountRow, ConnectButtons } from "@/app/admin/ads/AdsControls";

const platformLabels: Record<string, string> = { meta: "Meta", google: "Google Ads", linkedin: "LinkedIn", tiktok: "TikTok", snapchat: "Snapchat", x: "X", other: "أخرى" };

// Ad accounts (docs/bos/30 §14): API (Meta, Google Ads) or CSV import.
export default async function AdAccountsPage() {
  await requirePermission("ads.manage");
  const accounts = await listAdAccounts();
  return (
    <>
      <PageHeader title="الحسابات الإعلانية" subtitle="قراءة فقط — لا تُمنح أي صلاحية لتعديل الحملات" actions={<ConnectButtons />} />
      <Card flush>
        {accounts.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>المنصة</Tx></th><th><Tx>الحساب</Tx></th><th><Tx>العملة</Tx></th><th><Tx>الطريقة</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>آخر مزامنة</Tx></th><th /></tr></thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>{platformLabels[a.platform] ?? a.platform}</td>
                  <td>{a.name}{a.external_id ? <div className="bos-faint" dir="ltr" style={{ fontSize: 11 }}>{a.external_id}</div> : null}</td>
                  <td dir="ltr">{a.currency}</td>
                  <td><Tx>{a.mode === "api" ? "مزامنة تلقائية" : "استيراد CSV"}</Tx></td>
                  <td>{a.is_active ? (a.last_error ? <StatusBadge tone="danger" label="خطأ" /> : <StatusBadge tone="success" label="نشط" />) : <StatusBadge tone="neutral" label="موقوف" />}{a.last_error ? <div className="bos-danger" style={{ fontSize: 11 }} title={a.last_error}>{a.last_error.slice(0, 100)}</div> : null}</td>
                  <td>{a.last_sync_at ? formatDateTime(a.last_sync_at) : "—"}</td>
                  <td><AccountRow id={a.id} active={a.is_active} mode={a.mode} /></td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد حسابات إعلانية" />}
      </Card>
    </>
  );
}
