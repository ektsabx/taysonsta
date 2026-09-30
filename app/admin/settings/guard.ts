import "server-only";
import { redirect } from "next/navigation";
import { requireBosUser, type BosUser } from "@/lib/bos/auth";
import { sectionDelegates } from "@/lib/bos/settings-delegation";

export async function requireSettingsSection(section: string): Promise<BosUser> {
  const bos = await requireBosUser();
  const delegate = sectionDelegates[section];
  if (bos.permissions.get("settings.manage") === "all" || (delegate && bos.permissions.get(delegate) === "all")) return bos;
  redirect("/admin/forbidden");
}
