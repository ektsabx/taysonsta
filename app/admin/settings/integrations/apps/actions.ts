"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { APPS, saveListing, saveOwnPixel, type AppKey } from "@/services/yolias/app-listings";

const files = (f: FormData, k: string) => f.getAll(k).filter((x): x is File => x instanceof File && x.size > 0);

export async function saveListingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.app_listing", async () => {
    const { bos } = await authorize("integrations.manage", "all");
    const key = String(fd.get("key") ?? "") as AppKey;
    if (!APPS.some((a) => a.key === key)) throw new ValidationError("تكامل غير معروف.");
    await saveListing(bos, key, { remove: fd.getAll("remove").map(String), images: files(fd, "images"), version: String(fd.get("version") ?? ""), storeUrl: String(fd.get("store_url") ?? ""), zip: files(fd, "zip")[0] ?? null });
    revalidatePath("/admin/settings/integrations/apps");
  });
}

export async function saveOwnPixelAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.own_pixel", async () => {
    const { bos } = await authorize("integrations.manage", "all");
    await saveOwnPixel(bos, String(fd.get("public_id") ?? ""));
    revalidatePath("/admin/settings/integrations/apps");
  });
}
