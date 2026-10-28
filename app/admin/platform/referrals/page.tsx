import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KeyValues, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { getReferralProgram, referralOverview } from "@/services/yolias/referrals";
import { ReferralForm } from "./ReferralForm";

const STATUS: Record<string, { tone: "success" | "warning" | "neutral"; label: string }> = {
  rewarded: { tone: "success", label: "مُكافأ" }, capped: { tone: "warning", label: "تجاوز الحد الشهري" }, rejected: { tone: "neutral", label: "لا يُحتسب" },
};

// Yolias referral program (owner, 2026-10-28): invite links, sign-ups through
// them and the prospects granted. Settings apply at once (Yolias reads them live).
export default async function ReferralsPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="برنامج الدعوة" /><NotConnected /></>);
  const [program, o] = await Promise.all([getReferralProgram(), referralOverview()]);
  const manage = can(bos, "platform.manage", "all");
  return (
    <>
      <PageHeader title="برنامج الدعوة" subtitle="كل مساحة عمل لها رابط دعوة. من ينشئ حسابًا جديدًا عبره يضيف عملاء محتملين لرصيد صاحب الرابط." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <Card title="الإعدادات">
          <KeyValues items={[
            { label: "الحالة", value: program.enabled ? <StatusBadge tone="success" label="مفعّل" /> : <StatusBadge tone="neutral" label="متوقف" /> },
            { label: "المكافأة", value: <Tx vars={{ n: num(program.prospects) }}>{"{n} عميل محتمل لكل تسجيل"}</Tx> },
            { label: "الحد الشهري", value: num(program.monthlyCap) },
          ]} />
          {manage ? <ReferralForm value={program} /> : <p className="bos-faint"><Tx>التعديل يحتاج صلاحية إدارة المنصة.</Tx></p>}
        </Card>
        <Card title="الأرقام">
          <KeyValues items={[
            { label: "تسجيلات عبر روابط الدعوة", value: num(o.total) },
            { label: "مُكافأة", value: num(o.rewarded) },
            { label: "عملاء محتملون مُنحوا", value: num(o.prospects) },
            { label: "آخر 30 يومًا", value: num(o.last30) },
          ]} />
        </Card>
        <Card title="أكثر من يدعو">
          {!o.top.length ? <EmptyState title="لا توجد دعوات بعد" /> : (
            <div className="bos-table-scroll">
              <BosTable className="bos-table">
                <thead><tr><th><Tx>مساحة العمل</Tx></th><th><Tx>تسجيلات</Tx></th><th><Tx>عملاء محتملون</Tx></th></tr></thead>
                <tbody>{o.top.map((t) => <tr key={t.workspaceId}><td><Link className="bos-link" href={`/admin/platform/workspaces/${t.workspaceId}`}>{t.name}</Link></td><td className="bos-num">{num(t.count)}</td><td className="bos-num">{num(t.prospects)}</td></tr>)}</tbody>
              </BosTable>
            </div>
          )}
        </Card>
      </div>
      <Card title="آخر التسجيلات">
        {!o.recent.length ? <EmptyState title="لا توجد تسجيلات عبر روابط الدعوة بعد" /> : (
          <div className="bos-table-scroll">
            <BosTable className="bos-table">
              <thead><tr><th><Tx>التاريخ</Tx></th><th><Tx>صاحب الرابط</Tx></th><th><Tx>الحساب الجديد</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>عملاء محتملون</Tx></th></tr></thead>
              <tbody>
                {o.recent.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.at)}</td>
                    <td><Link className="bos-link" href={`/admin/platform/workspaces/${r.referrerId}`}>{r.referrer}</Link></td>
                    <td dir="ltr">{r.referred}</td>
                    <td><StatusBadge tone={STATUS[r.status]?.tone ?? "neutral"} label={STATUS[r.status]?.label ?? r.status} /></td>
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
