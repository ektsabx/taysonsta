"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { addNote, adjustBalance, commissionAction, payoutAction, saveProgram, setAffiliateStatus, type ProgramInput } from "@/services/yolias/affiliates";

// Every action re-checks its own permission here (hiding a button is not
// protection) and the database re-checks the allowed transition.

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const n = (fd: FormData, k: string) => {
  const v = s(fd, k).trim().replace(/,/g, "");
  return v === "" ? NaN : Number(v);
};

export async function affiliateStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.affiliate.status", async () => {
    const { bos } = await authorize("affiliates.approve", "all");
    const id = s(fd, "id");
    await setAffiliateStatus(bos, id, s(fd, "to"), s(fd, "reason"));
    revalidatePath("/admin/affiliates", "layout");
    return { ok: true };
  });
}

export async function affiliateNoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.affiliate.note", async () => {
    const { bos } = await authorize("affiliates.approve", "all");
    const id = s(fd, "id");
    await addNote(bos, id, s(fd, "body"));
    revalidatePath(`/admin/affiliates/${id}`);
    return { ok: true };
  });
}

export async function commissionActionForm(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.affiliate.commission", async () => {
    const { bos } = await authorize("affiliates.update", "all");
    await commissionAction(bos, s(fd, "id"), s(fd, "action"), s(fd, "reason"));
    revalidatePath("/admin/affiliates", "layout");
    return { ok: true };
  });
}

export async function adjustAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.affiliate.adjust", async () => {
    const { bos } = await authorize("affiliates.update", "all");
    const id = s(fd, "id");
    await adjustBalance(bos, id, n(fd, "amount"), s(fd, "reason"));
    revalidatePath(`/admin/affiliates/${id}`);
    return { ok: true };
  });
}

export async function payoutActionForm(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.affiliate.payout", async () => {
    const { bos } = await authorize("affiliate_payouts.approve", "all");
    const id = s(fd, "id");
    await payoutAction(bos, id, s(fd, "to"), { reference: s(fd, "reference"), reason: s(fd, "reason"), note: s(fd, "note") });
    revalidatePath("/admin/affiliates", "layout");
    return { ok: true };
  });
}

export async function programAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("yolias.affiliate.program", async () => {
    const { bos } = await authorize("affiliates.manage", "all");
    const lines = (k: string) => s(fd, k).split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
    const questions = [0, 1, 2, 3, 4, 5].map((i) => ({ id: s(fd, `q${i}_id`).trim(), label: s(fd, `q${i}_label`).trim(), required: fd.get(`q${i}_required`) === "on" })).filter((q) => q.label);
    const methods = [0, 1, 2, 3, 4].map((i) => ({ id: s(fd, `m${i}_id`).trim(), label: s(fd, `m${i}_label`).trim(), enabled: fd.get(`m${i}_enabled`) === "on" })).filter((m) => m.id && m.label);
    const max = s(fd, "maxPayments").trim();
    const input: ProgramInput = {
      enabled: fd.get("enabled") === "on",
      autoApprove: fd.get("autoApprove") === "on",
      questions,
      commissionType: s(fd, "commissionType") === "fixed" ? "fixed" : "percent",
      percent: n(fd, "percent") || 0,
      fixedUsd: n(fd, "fixedUsd") || 0,
      plans: fd.getAll("plans").map(String),
      periods: fd.getAll("periods").map(String),
      packs: fd.get("packs") === "on",
      recurring: fd.get("recurring") === "on",
      maxPayments: max === "" ? null : Number(max),
      packMonths: Number(s(fd, "packMonths") || 12),
      attributionDays: n(fd, "attributionDays"),
      model: s(fd, "model") === "last_touch" ? "last_touch" : "first_touch",
      minPaymentUsd: n(fd, "minPaymentUsd") || 0,
      holdDays: n(fd, "holdDays"),
      minPayoutUsd: n(fd, "minPayoutUsd"),
      excludedWorkspaces: lines("excludedWorkspaces"),
      excludedEmails: lines("excludedEmails"),
      holdSameIp: fd.get("holdSameIp") === "on",
      maxSignupsPerIpDay: n(fd, "maxSignupsPerIpDay"),
      payoutMethods: methods,
      includeTestPayments: fd.get("includeTestPayments") === "on",
      notifyAffiliates: fd.get("notifyAffiliates") === "on",
      termsVersion: s(fd, "termsVersion"),
      terms: s(fd, "terms"),
      note: s(fd, "note"),
      notifyTermsChange: fd.get("notifyTermsChange") === "on",
    };
    await saveProgram(bos, input);
    revalidatePath("/admin/affiliates", "layout");
    return { ok: true };
  });
}
