import { requirePermission } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { PageHeader } from "@/components/bos/ui";
import { ProjectsTable } from "../ProjectsTable";

export default async function MyProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("projects.read");
  const params = await readParams(searchParams);
  return (
    <>
      <PageHeader title="مشاريعي" subtitle="المشاريع التي أنت مديرها أو عضو فيها" />
      <ProjectsTable bos={bos} scope={scope} filters={{ ...params, page: pageOf(params) }} mine />
    </>
  );
}
