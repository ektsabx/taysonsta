import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { PageHeader } from "@/components/bos/ui";
import { ProjectsTable } from "./ProjectsTable";

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("projects.read");
  const params = await readParams(searchParams);
  return (
    <>
      <PageHeader
        title="كل المشاريع"
       
        actions={
          <>
            <Link href="/admin/projects/my" className="admin-btn small secondary"><Tx>مشاريعي</Tx></Link>
            {can(bos, "projects.create") ? <Link href="/admin/projects/new" className="admin-btn small"><Tx>+ مشروع داخلي</Tx></Link> : null}
          </>
        }
      />
      <ProjectsTable bos={bos} scope={scope} filters={{ ...params, page: pageOf(params) }} />
    </>
  );
}
