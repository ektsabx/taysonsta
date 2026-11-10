import { requirePermission, can } from "@/lib/bos/auth";
import { Card, PageHeader } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { getReferralProgram } from "@/services/yolias/referrals";
import { ReferralForm } from "../ReferralForm";

export default async function ReferralSettingsPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="إعدادات برنامج الدعوة" /><NotConnected /></>);
  const program = await getReferralProgram();
  return (
    <>
      <PageHeader title="إعدادات برنامج الدعوة" />
      <Card title="الإعدادات">{can(bos, "platform.manage", "all") ? <ReferralForm value={program} /> : <p className="bos-faint"><Tx>التعديل يحتاج صلاحية إدارة المنصة.</Tx></p>}</Card>
    </>
  );
}
