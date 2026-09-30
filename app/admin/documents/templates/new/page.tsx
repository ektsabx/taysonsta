import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card } from "@/components/bos/ui";
import { docTypeLabels } from "@/services/bos/documents";
import { NewTemplateForm } from "./NewTemplateForm";

export default async function NewTemplatePage() {
  await requirePermission("documents.manage", "all");
  return (
    <>
      <PageHeader title="قالب جديد" />
      <Card>
        <NewTemplateForm types={Object.entries(docTypeLabels).map(([value, label]) => ({ value, label }))} />
      </Card>
    </>
  );
}
