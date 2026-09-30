import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/bos/auth";

// Roles & permissions are managed in Settings (docs/bos/22-settings.md).
export default async function TeamPermissionsPage() {
  await requirePermission("roles.manage");
  redirect("/admin/settings/roles");
}
