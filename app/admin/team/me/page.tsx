import { redirect } from "next/navigation";
import { requireBosUser } from "@/lib/bos/auth";

// Employee self-service (docs/bos/28 §26): the same Employee 360 profile,
// shown to the employee with own-scope permissions — no separate portal.
export default async function MyHrPage() {
  const bos = await requireBosUser();
  redirect(`/admin/team/employees/${bos.employee.id}`);
}
