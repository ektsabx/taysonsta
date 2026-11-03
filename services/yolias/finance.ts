import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import { ydb } from "@/lib/yolias/db";

// The owner's monthly costs (owner, 2026-11-03, D-276): fixed costs and
// marketing spend per channel, for profit, margin and CAC on the dashboard.
// platform.manage only; every change is audited.
export const FIXED_CATEGORIES = ["servers", "database", "email", "ai", "software", "salaries", "office", "other"] as const;
export const MARKETING_CATEGORIES = ["seo", "geo", "paid_ads", "social", "affiliate", "email", "other"] as const;
// Costs that serve customers directly count in the gross margin by default.
const COGS_DEFAULT = new Set(["servers", "database", "email", "ai"]);

export async function saveFinanceEntry(bos: BosUser, input: { month: string; kind: string; category: string; amount: number; cogs?: boolean; note?: string | null }) {
  if (!/^\d{4}-\d{2}$/.test(input.month)) throw new ValidationError("الشهر غير صالح.", { month: "اختر شهرًا" });
  if (input.kind !== "fixed" && input.kind !== "marketing") throw new ValidationError("النوع غير صالح.");
  const cats: readonly string[] = input.kind === "fixed" ? FIXED_CATEGORIES : MARKETING_CATEGORIES;
  if (!cats.includes(input.category)) throw new ValidationError("البند غير صالح.", { category: "اختر بندًا" });
  if (!Number.isFinite(input.amount) || input.amount < 0 || input.amount > 10_000_000) throw new ValidationError("المبلغ غير صالح.", { amount_usd: "رقم بالدولار" });
  const row = {
    month: `${input.month}-01`, kind: input.kind as "fixed" | "marketing", category: input.category, amount_usd: Math.round(input.amount * 100) / 100,
    cogs: input.kind === "fixed" ? (input.cogs ?? COGS_DEFAULT.has(input.category)) : false,
    note: input.note?.trim().slice(0, 300) || null, created_by: bos.userId, updated_at: new Date().toISOString(),
  };
  const { error } = await ydb().from("yolias_finance_entries").upsert(row, { onConflict: "month,kind,category" });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.finance.save", entityType: "yolias_finance", entityId: null, newValue: row, metadata: { month: input.month } });
}

export async function deleteFinanceEntry(bos: BosUser, id: string) {
  const { data } = await ydb().from("yolias_finance_entries").select("*").eq("id", id).maybeSingle();
  if (!data) return;
  const { error } = await ydb().from("yolias_finance_entries").delete().eq("id", id);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.finance.delete", entityType: "yolias_finance", entityId: null, oldValue: data, metadata: { month: data.month } });
}
