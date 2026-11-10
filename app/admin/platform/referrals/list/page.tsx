import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { referralOverview } from "@/services/yolias/referrals";

const STATUS: Record<string, { tone: "success" | "warning" | "neutral" | "danger"; label: string }> = {
  rewarded: { tone: "success", label: "مُكافأ" }, capped: { tone: "warning", label: "تجاوز الحد الشهري" }, rejected: { tone: "neutral", label: "لا يُحتسب" }, review: { tone: "danger", label: "قيد المراجعة" },
};
// Why a referral was held or refused (lib/referrals.ts in Yolias, D-273).
const SIGNAL: Record<string, string> = {
  same_workspace: "انضم لفريق صاحب الرابط", self_referral: "نفس بريد صاحب الرابط", disposable_email: "بريد مؤقت",
  ip_used: "نفس الشبكة (IP) جلبت إحالة من قبل", burst: "3 تسجيلات أو أكثر لنفس الرابط خلال 24 ساعة", monthly_cap: "تجاوز الحد الشهري",
};

// Every sign-up through an invite link (owner, 2026-11-10).
export default async function ReferralListPage() {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الإحالات" /><NotConnected /></>);
  const o = await referralOverview();
  return (
    <>
      <PageHeader title="الإحالات" />
      <Card title="آخر التسجيلات">
        {!o.recent.length ? <EmptyState title="لا توجد تسجيلات عبر روابط الدعوة بعد" /> : (
          <div className="bos-table-scroll">
            <BosTable className="bos-table">
              <thead><tr><th><Tx>التاريخ</Tx></th><th><Tx>صاحب الرابط</Tx></th><th><Tx>الحساب الجديد</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>السبب</Tx></th><th><Tx>العملاء الممنوحون</Tx></th></tr></thead>
              <tbody>
                {o.recent.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.at)}</td>
                    <td><Link className="bos-link" href={`/admin/platform/workspaces/${r.referrerId}`}>{r.referrer}</Link></td>
                    <td dir="ltr">{r.referred}</td>
                    <td><StatusBadge tone={STATUS[r.status]?.tone ?? "neutral"} label={STATUS[r.status]?.label ?? r.status} /></td>
                    <td><Tx>{SIGNAL[r.reason ?? ""] ?? "—"}</Tx></td>
                    <td className="bos-num">{num(r.prospects)}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        )}
      </Card>
    </>
  );
}
