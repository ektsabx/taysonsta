"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { clockIn, clockOut, endBreak, startBreak } from "@/services/bos/attendance";

function refresh() {
  revalidatePath("/admin", "layout");
}

export async function clockInAction(source: "web" | "mobile" = "web", clientTz?: string): Promise<ActionState> {
  return handleAction("clockIn", async () => {
    const { bos } = await authorize("attendance.create");
    await clockIn(bos, source, clientTz ?? null);
    refresh();
    return { ok: true, message: "تم بدء العمل" };
  }, "تعذر بدء العمل.");
}

export async function clockOutAction(source: "web" | "mobile" = "web"): Promise<ActionState> {
  return handleAction("clockOut", async () => {
    const { bos } = await authorize("attendance.create");
    await clockOut(bos, source);
    refresh();
    return { ok: true, message: "تم إنهاء العمل" };
  }, "تعذر إنهاء العمل.");
}

export async function startBreakAction(): Promise<ActionState> {
  return handleAction("startBreak", async () => {
    const { bos } = await authorize("attendance.create");
    await startBreak(bos);
    refresh();
    return { ok: true };
  });
}

export async function endBreakAction(): Promise<ActionState> {
  return handleAction("endBreak", async () => {
    const { bos } = await authorize("attendance.create");
    await endBreak(bos);
    refresh();
    return { ok: true };
  });
}
