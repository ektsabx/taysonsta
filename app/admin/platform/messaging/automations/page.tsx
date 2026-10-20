import { can, requirePermission } from "@/lib/bos/auth";
import { messagingReady } from "@/services/yolias/messaging";
import { PageHeader } from "@/components/bos/ui";
import { MessagingNotReady, NotConnected, connected } from "@/components/yolias/PlatformUi";
import { FlowList } from "../_ui/FlowList";

export default async function AutomationsPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الأتمتة" /><NotConnected /></>);
  if (!(await messagingReady())) return (<><PageHeader title="الأتمتة" /><MessagingNotReady /></>);
  return (
    <>
      <PageHeader title="الأتمتة" subtitle="مسارات تبدأ من حدث في Yolias وتنفذ خطوات: إيميل، إشعار داخل المنصة، انتظار، تفرّع." />
      <FlowList kind="automation" canManage={can(bos, "platform.manage", "all")} />
    </>
  );
}
