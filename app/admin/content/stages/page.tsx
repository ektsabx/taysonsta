import { requirePermission } from "@/lib/bos/auth";
import { listStages } from "@/services/bos/content";
import { PageHeader, Card } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { StagesEditor } from "../ContentControls";

// Editable content lifecycle (docs/bos/30 §13.3).
export default async function ContentStagesPage() {
  await requirePermission("content.manage");
  const stages = await listStages();
  return (
    <>
      <PageHeader title="مراحل عمل المحتوى" />
      <Card>
        <p className="bos-hint"><Tx>المراحل الأساسية (فكرة، مراجعة، معتمد، جاهز للنشر، منشور، مؤرشف) يمكن تسميتها وترتيبها لكن لا تُحذف. المراحل التي «تتطلب اعتماداً» لا يدخلها المحتوى قبل اعتماده من المراجع.</Tx></p>
        <StagesEditor stages={stages} />
      </Card>
    </>
  );
}
