import { requirePermission } from "@/lib/bos/auth";
import { listStages } from "@/services/bos/content";
import { PageHeader, Card } from "@/components/bos/ui";
import { SubNav } from "@/components/bos/SubNav";
import { Tx } from "@/components/bos/I18n";
import { contentNav } from "../content-nav";
import { StagesEditor } from "../ContentControls";

// Editable content lifecycle (docs/bos/30 §13.3).
export default async function ContentStagesPage() {
  const { bos } = await requirePermission("content.manage");
  const stages = await listStages();
  return (
    <>
      <PageHeader title="مراحل عمل المحتوى" breadcrumbs={[{ label: "التسويق" }, { label: "استوديو المحتوى", href: "/admin/content" }, { label: "المراحل" }]} />
      <SubNav items={contentNav(bos)} active="stages" label="استوديو المحتوى" />
      <Card>
        <p className="bos-hint"><Tx>المراحل الأساسية (فكرة، مراجعة، معتمد، جاهز للنشر، منشور، مؤرشف) يمكن تسميتها وترتيبها لكن لا تُحذف. المراحل التي «تتطلب اعتماداً» لا يدخلها المحتوى قبل اعتماده من المراجع.</Tx></p>
        <StagesEditor stages={stages} />
      </Card>
    </>
  );
}
