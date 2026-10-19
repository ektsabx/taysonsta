import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import { ydb } from "@/lib/yolias/db";

// Platform switches (owner brief 2026-10-13, D-213): what the owner can turn
// on and off in Yolias at any time. Stored in Yolias's
// site_settings.platform_switches (missing key = on); Yolias reads it within
// ~15 seconds (lib/switches.ts there). Off = hidden from customers and
// refused by the server. Every change is audited.

export const SWITCHES = [
  { key: "payments_polar", label: "الدفع بالبطاقة (Polar)", hint: "طريقة «Visa / بطاقة ائتمان» في صفحة الدفع، مع التجربة المجانية. الاشتراكات الجارية على Polar تستمر وتتجدد من Polar." },
  { key: "payments_kashier", label: "الدفع من الصفحة (كاشير)", hint: "خيار إضافي في صفحة الدفع: العميل يدفع بالكارت داخل يولياس، والتجديد يتخصم تلقائيًا من البطاقة المحفوظة. يظهر فقط بعد ربط كاشير من مركز التكاملات." },
  { key: "payments_paymob", label: "الدفع بالكارت (Paymob)", hint: "بوابة الدفع الأساسية: طريقة «الدفع بالكارت» في صفحة الدفع (بالجنيه لعملاء مصر)، وشراء الباقات الإضافية، ودفع فواتير التجديد. المدفوعات التي بدأت قبل الإيقاف تُسجَّل نتيجتها عادي." },
  { key: "buy_more", label: "شراء عملاء محتملين إضافيين (Buy More)", hint: "زر وباقات الشراء الإضافي داخل التطبيق." },
] as const;
export type SwitchKey = (typeof SWITCHES)[number]["key"];

export async function getSwitches(): Promise<{ values: Record<SwitchKey, boolean>; updatedAt: string | null }> {
  const { data } = await ydb().from("site_settings").select("value, updated_at").eq("key", "platform_switches").maybeSingle();
  const v = (data?.value ?? {}) as Record<string, unknown>;
  return {
    values: Object.fromEntries(SWITCHES.map((s) => [s.key, v[s.key] !== false])) as Record<SwitchKey, boolean>,
    updatedAt: data?.updated_at ?? null,
  };
}

export async function setSwitch(bos: BosUser, key: string, on: boolean): Promise<void> {
  if (!SWITCHES.some((s) => s.key === key)) throw new ValidationError("مفتاح غير معروف.");
  const { values } = await getSwitches();
  const next = { ...values, [key]: on };
  const { error } = await ydb().from("site_settings").upsert({ key: "platform_switches", value: next, updated_at: new Date().toISOString() });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.switch", entityType: "yolias_setting", entityId: null, oldValue: { [key]: values[key as SwitchKey] }, newValue: { [key]: on }, metadata: { key } });
}
