import { can, requirePermission } from "@/lib/bos/auth";
import { listActiveStaff } from "@/services/bos/shared";
import { PageHeader, Card } from "@/components/bos/ui";
import { ItemForm } from "../ContentControls";

export default async function NewContentPage() {
  const { bos } = await requirePermission("content.create");
  const staff = await listActiveStaff();
  return (
    <>
      <PageHeader title="فكرة محتوى جديدة" />
      <Card><ItemForm staff={staff.map((s) => ({ value: s.userId, label: s.name }))} canAssign={can(bos, "content.assign") || can(bos, "content.manage")} /></Card>
    </>
  );
}
