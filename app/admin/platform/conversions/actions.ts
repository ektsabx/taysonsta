"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { ydb } from "@/lib/yolias/db";
import { addAccountNote, sendAccountMessage, type ActionResult } from "@/services/yolias/accounts";
import { matchingCheckoutIds, reviewCheckouts, saveTrackingSettings, type CheckoutFilters } from "@/services/yolias/conversions";

// Abandoned checkouts follow-up (D-212). platform.manage (scope all) only;
// audited in the services. Messages go only to known members (never to
// anonymous visitors), never automatically, and respect the member's
// "Product updates" setting for recovery messages.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const PATH = "/admin/platform/conversions";

export type CheckoutBulkResult = { results: ActionResult[] };

async function idsFrom(fd: FormData): Promise<string[]> {
  if (fd.get("all") === "1") {
    let f: CheckoutFilters = {};
    try { f = JSON.parse(str(fd, "filters") || "{}") as CheckoutFilters; } catch { /* none */ }
    return matchingCheckoutIds(f, 501);
  }
  return [...new Set(fd.getAll("ids").map(String).filter((i) => UUID.test(i)))];
}

export async function checkoutBulkAction(_prev: ActionState<CheckoutBulkResult>, fd: FormData): Promise<ActionState<CheckoutBulkResult>> {
  return handleAction("yolias.checkouts.bulk", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const action = str(fd, "action");
    const ids = await idsFrom(fd);
    if (!ids.length) throw new ValidationError("اختر حالة واحدة على الأقل.");
    if (ids.length > 500) throw new ValidationError("الحد الأقصى 500 حالة في العملية الواحدة.");
    const results: ActionResult[] = [];
    if (action === "reviewed" || action === "excluded" || action === "new" || action === "assign") {
      const n = await reviewCheckouts(bos, ids, action, { reason: str(fd, "reason"), assignee: str(fd, "assignee") });
      for (const id of ids) results.push({ id, email: null, ok: true });
      revalidatePath(PATH, "layout");
      return { ok: true, data: { results }, message: `تم تحديث ${n} حالة` };
    }
    const { data: rows } = await ydb().from("checkout_sessions").select("id, user_id, status, workspace_id").in("id", ids);
    if (action === "note") {
      const body = str(fd, "body");
      if (!body) throw new ValidationError("اكتب الملاحظة.", { body: "مطلوب" });
      for (const r of rows ?? []) {
        if (!r.user_id) { results.push({ id: r.id, email: null, ok: false, error: "زائر مجهول" }); continue; }
        try { await addAccountNote(bos, r.user_id, body, r.id); results.push({ id: r.id, email: null, ok: true }); } catch (e) { results.push({ id: r.id, email: null, ok: false, error: e instanceof Error ? e.message : "فشل" }); }
      }
    } else if (action === "email" || action === "in_app" || action === "sms") {
      if (ids.length > 20 && str(fd, "confirm") !== "SEND") throw new ValidationError("للإرسال إلى أكثر من 20 حالة اكتب SEND للتأكيد.", { confirm: "SEND" });
      if (str(fd, "subject").length < 2 || str(fd, "body").length < 2) throw new ValidationError("العنوان والنص مطلوبان.", { subject: "مطلوب" });
      const sentTo = new Set<string>();
      for (const r of rows ?? []) {
        if (!r.user_id) { results.push({ id: r.id, email: null, ok: false, error: "زائر مجهول: لا يمكن التواصل" }); continue; }
        if (sentTo.has(r.user_id)) { results.push({ id: r.id, email: null, ok: false, error: "نفس المستخدم في هذه العملية" }); continue; }
        // A member who is subscribed now doesn't get a "complete your subscription" message.
        const { data: ws } = r.workspace_id ? await ydb().from("workspaces").select("subscription_status").eq("id", r.workspace_id).maybeSingle() : { data: null };
        if (ws && ["active", "trialing"].includes(ws.subscription_status)) { results.push({ id: r.id, email: null, ok: false, error: "مشترك الآن" }); continue; }
        try {
          // Always a fresh link to the checkout page (never an expired provider link).
          const res = await sendAccountMessage(bos, r.user_id, { channel: action, purpose: "recovery", subject: str(fd, "subject"), body: str(fd, "body"), ctaUrl: "/checkout", checkoutId: r.id });
          if (res.ok) sentTo.add(r.user_id);
          results.push({ ...res, id: r.id });
        } catch (e) {
          if (e instanceof ValidationError) throw e;
          results.push({ id: r.id, email: null, ok: false, error: e instanceof Error ? e.message : "فشل" });
        }
      }
    } else {
      throw new ValidationError("إجراء غير معروف.");
    }
    revalidatePath(PATH, "layout");
    const ok = results.filter((r) => r.ok).length;
    return { ok: true, data: { results }, message: `نجح: ${ok} · فشل: ${results.length - ok}` };
  });
}

export async function saveTrackingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.checkouts.settings", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await saveTrackingSettings(bos, Number(str(fd, "abandon_minutes")), Number(str(fd, "result_minutes")));
    revalidatePath(PATH, "layout");
    return { ok: true };
  });
}
