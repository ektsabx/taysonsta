import { can, requirePermission } from "@/lib/bos/auth";
import { messagingReady } from "@/services/yolias/messaging";
import { PageHeader } from "@/components/bos/ui";
import { MessagingNotReady, NotConnected, connected } from "@/components/yolias/PlatformUi";
import { FlowList } from "../_ui/FlowList";

export default async function SequencesPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="تسلسلات الإيميلات" /><NotConnected /></>);
  if (!(await messagingReady())) return (<><PageHeader title="تسلسلات الإيميلات" /><MessagingNotReady /></>);
  return (
    <>
      <PageHeader title="تسلسلات الإيميلات" subtitle="سلسلة رسائل مرتبطة بحدث أو حالة، بتوقيتات وشروط وانتقال وتوقف قابلة للتعديل." />
      <FlowList kind="sequence" canManage={can(bos, "platform.manage", "all")} />
    </>
  );
}
