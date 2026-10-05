import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card } from "@/components/bos/ui";
import { DeviceForm } from "../DeviceForm";
import { db } from "@/lib/bos/db";

export default async function NewDevicePage() {
  await requirePermission("devices.create", "all");
  const { data: vendors } = await db().from("vendors").select("id, name").order("name");
  return (
    <>
      <PageHeader title="أصل جديد" />
      <Card><DeviceForm vendors={(vendors ?? []).map((v) => ({ value: v.id, label: v.name }))} /></Card>
    </>
  );
}
