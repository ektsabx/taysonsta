import { redirect } from "next/navigation";

// Recruitment moved to Team → Recruitment (docs/bos/28 §20, §36); old URL kept.
export default async function LegacyCareersRedirect() {
  redirect("/admin/team/recruitment/interviews");
}
