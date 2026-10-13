"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { saveSettingSection } from "@/services/bos/settings-admin";

const fields = ["gemini_daily_usd", "ai_failures_per_hour", "payment_failure_pct", "payment_min_attempts", "email_daily_quota", "email_warn_pct", "db_limit_mb", "db_warn_pct"] as const;

// Alert thresholds (bos_settings "platform_alerts"; validated by its schema, audited).
export async function saveAlertsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("platform.alerts.save", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const value: Record<string, unknown> = { enabled: fd.get("enabled") === "on" };
    for (const f of fields) value[f] = String(fd.get(f) ?? "");
    await saveSettingSection(bos, "platform_alerts", value);
    revalidatePath("/admin/platform/health");
    return { ok: true };
  });
}
