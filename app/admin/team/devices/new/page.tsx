import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card } from "@/components/bos/ui";
import { DeviceForm } from "../DeviceForm";
import { db } from "@/lib/bos/db";

export default async function NewDevicePage() {
  await requirePermission("devices.create", "all");
  const [{ data: vendors }, { data: branches }] = await Promise.all([db().from("vendors").select("id, name").order("name"), db().from("branches").select("id, name").eq("status", "active").order("name")]);
  return (
    <>
      <PageHeader title="أصل جديد" breadcrumbs={[{ label: "الفريق" }, { label: "الأجهزة", href: "/admin/team/devices" }, { label: "جديد" }]} />
      <Card><DeviceForm vendors={(vendors ?? []).map((v) => ({ value: v.id, label: v.name }))} branches={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))} /></Card>
    </>
  );
}
