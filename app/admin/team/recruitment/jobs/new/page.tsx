import { requirePermission } from "@/lib/bos/auth";
import { PageHeader } from "@/components/bos/ui";
import { JobForm } from "../../RecruitmentControls";
import { recruitmentLookups } from "../../lookups";

export default async function NewJobPage() {
  await requirePermission("recruitment.create", "all");
  const l = await recruitmentLookups();
  return (
    <>
      <PageHeader title="وظيفة جديدة" />
      <JobForm departments={l.departments} teams={l.teams} managers={l.users} currencies={l.currencies} />
    </>
  );
}
