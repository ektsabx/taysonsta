import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card } from "@/components/bos/ui";
import { DatasetsNotReady, NotConnected, connected } from "@/components/yolias/PlatformUi";
import { datasetsReady } from "@/services/yolias/datasets";
import { ImportWizard } from "./ImportWizard";

// New import (D-248): source and licence, file, AI column mapping, upload.
export default async function NewDatasetPage() {
  await requirePermission("platform.manage", "all");
  if (!connected()) return (<><PageHeader title="استيراد بيانات" /><NotConnected /></>);
  if (!(await datasetsReady())) return (<><PageHeader title="استيراد بيانات" /><DatasetsNotReady /></>);
  return (
    <>
      <PageHeader title="استيراد بيانات" subtitle="المصدر والترخيص، ثم ربط الأعمدة بالذكاء الاصطناعي، ثم التنظيف والمطابقة مع قاعدة البيانات المشتركة." />
      <Card><ImportWizard /></Card>
    </>
  );
}
