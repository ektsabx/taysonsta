"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { setUserSuspended } from "@/services/yolias/users";
import { adjustUsage } from "@/services/yolias/usage";
import { ydb } from "@/lib/yolias/db";
import {
  accountViews, addAccountNote, matchingAccountIds, sendAccountMessage, setAccountState,
  type AccountAction, type AccountFilters, type AccountView, type ActionResult,
} from "@/services/yolias/accounts";

// Users actions (D-214). platform.manage (scope all) only; every change is
// audited in the services. Bulk actions return one result per account so a
// partial success is visible.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const MAX_BULK = 500;
/** Messages to more accounts than this need typing SEND. */
const MESSAGE_CONFIRM = 20;

export async function setSuspendedAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.setUserSuspended", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = str(fd, "id");
    if (!UUID.test(id)) return { ok: false, error: "Invalid user" };
    await setUserSuspended(bos, id, fd.get("suspend") === "1", str(fd, "reason"));
    revalidatePath("/admin/platform/users", "layout");
    return { ok: true };
  });
}

export type BulkResult = { results: ActionResult[] };

const failure = (id: string, e: unknown): ActionResult => ({ id, email: null, ok: false, error: e instanceof Error ? e.message : "فشل" });

export async function bulkAccountAction(_prev: ActionState<BulkResult>, fd: FormData): Promise<ActionState<BulkResult>> {
  return handleAction("yolias.accounts.bulk", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const action = str(fd, "action");
    let ids = fd.getAll("ids").map(String).filter((i) => UUID.test(i));
    if (fd.get("all") === "1") {
      const view = (accountViews as string[]).includes(str(fd, "view")) ? (str(fd, "view") as AccountView) : "all";
      let filters: AccountFilters = {};
      try { filters = JSON.parse(str(fd, "filters") || "{}") as AccountFilters; } catch { /* no filters */ }
      ids = await matchingAccountIds(view, filters, MAX_BULK + 1);
    }
    ids = [...new Set(ids)];
    if (!ids.length) throw new ValidationError("اختر حسابًا واحدًا على الأقل.");
    if (ids.length > MAX_BULK) throw new ValidationError(`الحد الأقصى ${MAX_BULK} حساب في العملية الواحدة. ضيّق الفلاتر.`);
    const reason = str(fd, "reason");
    const results: ActionResult[] = [];

    if (["suspend", "pause", "ban", "restore", "unban", "delete"].includes(action)) {
      if (action === "delete" && str(fd, "confirm") !== "DELETE") throw new ValidationError("اكتب DELETE للتأكيد.", { confirm: "DELETE" });
      if (["suspend", "pause", "ban", "delete"].includes(action) && reason.length < 3) throw new ValidationError("السبب مطلوب (3 أحرف على الأقل).", { reason: "مطلوب" });
      for (const id of ids) {
        try { results.push(await setAccountState(bos, id, action as AccountAction, reason, { days: Number(str(fd, "days") || 7) })); } catch (e) { results.push(failure(id, e)); }
      }
    } else if (action === "note") {
      const body = str(fd, "body");
      if (!body) throw new ValidationError("اكتب الملاحظة.", { body: "مطلوب" });
      for (const id of ids) {
        try { await addAccountNote(bos, id, body); results.push({ id, email: null, ok: true }); } catch (e) { results.push(failure(id, e)); }
      }
    } else if (action === "email" || action === "in_app" || action === "sms" || action === "renewal_request") {
      if (ids.length > MESSAGE_CONFIRM && str(fd, "confirm") !== "SEND") throw new ValidationError(`للإرسال إلى أكثر من ${MESSAGE_CONFIRM} حسابًا اكتب SEND للتأكيد.`, { confirm: "SEND" });
      const renewal = action === "renewal_request";
      const p = str(fd, "purpose");
      const purpose = renewal ? "service" : p === "recovery" || p === "marketing" ? p : "service";
      if (!renewal && (str(fd, "subject").length < 2 || str(fd, "body").length < 2)) throw new ValidationError("العنوان والنص مطلوبان.", { subject: "مطلوب" });
      for (const id of ids) {
        try {
          let cta = str(fd, "cta_url") || null;
          if (renewal) {
            // A renewal request only links to the checkout: nothing is activated without a successful payment.
            const { data: acc } = await ydb().from("admin_accounts_v").select("plan, billing_period").eq("id", id).maybeSingle();
            cta = `/checkout?plan=${acc?.plan && acc.plan !== "free" ? acc.plan : "growth"}&period=${acc?.billing_period ?? "monthly"}`;
          }
          results.push(await sendAccountMessage(bos, id, {
            channel: renewal ? "email" : (action as "email" | "in_app" | "sms"), purpose,
            subject: renewal ? str(fd, "subject") || "Renew your Yolias plan" : str(fd, "subject"),
            body: renewal ? str(fd, "body") || "Your Yolias plan can be renewed from your account. Open the link below to choose your plan and pay securely." : str(fd, "body"),
            ctaUrl: cta,
          }));
        } catch (e) {
          if (e instanceof ValidationError) throw e;
          results.push(failure(id, e));
        }
      }
    } else if (action === "compensate") {
      const prospects = Number(str(fd, "prospects"));
      if (!Number.isInteger(prospects) || prospects <= 0 || prospects > 100_000) throw new ValidationError("اكتب عدد العملاء المحتملين (1 – 100,000).", { prospects: "مطلوب" });
      if (reason.length < 3) throw new ValidationError("السبب مطلوب.", { reason: "مطلوب" });
      const done = new Set<string>();
      for (const id of ids) {
        const { data: acc } = await ydb().from("admin_accounts_v").select("email, workspace_id").eq("id", id).maybeSingle();
        if (!acc?.workspace_id) { results.push({ id, email: acc?.email ?? null, ok: false, error: "لا توجد مساحة عمل" }); continue; }
        if (done.has(acc.workspace_id)) { results.push({ id, email: acc.email, ok: false, error: "أُضيف لمساحة العمل نفسها في هذه العملية" }); continue; }
        try {
          await adjustUsage(bos, acc.workspace_id, prospects, reason);
          done.add(acc.workspace_id);
          results.push({ id, email: acc.email, ok: true });
        } catch (e) { results.push({ ...failure(id, e), email: acc.email }); }
      }
    } else {
      throw new ValidationError("إجراء غير معروف.");
    }
    revalidatePath("/admin/platform/users", "layout");
    revalidatePath("/admin/platform/conversions", "layout");
    const ok = results.filter((r) => r.ok).length;
    return { ok: true, data: { results }, message: `نجح: ${ok} · فشل: ${results.length - ok}` };
  });
}

export async function addNoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.accounts.note", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = str(fd, "id");
    await addAccountNote(bos, id, str(fd, "body"), str(fd, "checkout_id") || null);
    revalidatePath(`/admin/platform/users/${id}`);
    revalidatePath("/admin/platform/conversions", "layout");
    return { ok: true };
  });
}
