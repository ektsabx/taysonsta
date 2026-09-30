"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { assignSeat, closeMaintenance, markAvailable, moveStock, openMaintenance, releaseSeat, setEndOfLife, transferBranch } from "@/services/bos/assets";

// Asset lifecycle actions (docs/bos/30 §21).
const uuid = /^[0-9a-f-]{36}$/i;
const num = (v: string | undefined) => (v && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

export async function assetAction(op: "available" | "seat" | "release" | "stock" | "maint_open" | "maint_close" | "branch" | "retire" | "lost", id: string, a?: string, b?: string, c?: string): Promise<ActionState> {
  return handleAction(`asset.${op}`, async () => {
    const { bos } = await authorize("devices.read");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    if (op === "available") await markAvailable(bos, id);
    else if (op === "seat") {
      if (!a || !uuid.test(a)) throw new ValidationError("اختر الموظف.");
      await assignSeat(bos, id, a, b || null);
    } else if (op === "release") await releaseSeat(bos, id);
    else if (op === "stock") await moveStock(bos, id, Number(a), b ?? "", c && uuid.test(c) ? c : null);
    else if (op === "maint_open") await openMaintenance(bos, id, { description: a ?? "", vendor_id: b && uuid.test(b) ? b : null, cost: num(c) });
    else if (op === "maint_close") await closeMaintenance(bos, id, { result: a ?? "", cost: num(b), retire: c === "1" });
    else if (op === "branch") {
      if (!a || !uuid.test(a)) throw new ValidationError("اختر الفرع.");
      await transferBranch(bos, id, a, b || null);
    } else await setEndOfLife(bos, id, op === "retire" ? "retired" : "lost", a ?? "");
    revalidatePath("/admin/team/devices", "layout");
    return { ok: true, message: "تم" };
  });
}
