import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Messaging settings (Yolias Admin → Messaging → Settings), stored in
// site_settings "messaging". Numbers are clamped to safe ranges here, so a
// bad value in the table can never turn the caps off by accident.

export interface MessagingSettings {
  enabled: boolean;
  sender_name: string;
  /** Full From header for lifecycle / marketing mail ("Yolias <updates@…>"); empty = the default sender. */
  marketing_from: string;
  reply_to: string;
  /** At most one lifecycle / marketing email per user in this many hours (0 = no cap). */
  frequency_hours: number;
  /** At most this many lifecycle / marketing emails a day across all users. */
  daily_cap: number;
  /** Campaigns larger than this need the recipient count typed to confirm. */
  campaign_confirm_over: number;
  inactive_days: number;
  stopped_days: number;
  trial_ending_days: number;
  /** A subscription within this many days of a message counts as converted by it. */
  attribution_days: number;
  /** Addresses test sends may go to (besides the admin's own). */
  test_emails: string[];
}

export const DEFAULT_MESSAGING: MessagingSettings = {
  enabled: true, sender_name: "Yolias", marketing_from: "", reply_to: "", frequency_hours: 24, daily_cap: 2000, campaign_confirm_over: 100,
  inactive_days: 7, stopped_days: 30, trial_ending_days: 2, attribution_days: 7, test_emails: [],
};

const num = (v: unknown, d: number, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function parseMessagingSettings(v: unknown): MessagingSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const d = DEFAULT_MESSAGING;
  return {
    enabled: o.enabled !== false,
    sender_name: str(o.sender_name, 60) || d.sender_name,
    marketing_from: str(o.marketing_from, 200),
    reply_to: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(o.reply_to, 200)) ? str(o.reply_to, 200) : "",
    frequency_hours: num(o.frequency_hours, d.frequency_hours, 0, 720),
    daily_cap: num(o.daily_cap, d.daily_cap, 1, 100_000),
    campaign_confirm_over: num(o.campaign_confirm_over, d.campaign_confirm_over, 1, 1_000_000),
    inactive_days: num(o.inactive_days, d.inactive_days, 2, 180),
    stopped_days: num(o.stopped_days, d.stopped_days, 7, 365),
    trial_ending_days: num(o.trial_ending_days, d.trial_ending_days, 1, 14),
    attribution_days: num(o.attribution_days, d.attribution_days, 1, 60),
    test_emails: Array.isArray(o.test_emails) ? (o.test_emails as unknown[]).map((x) => str(x, 200).toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)).slice(0, 20) : [],
  };
}

export async function messagingSettings(db = createAdminClient()): Promise<MessagingSettings> {
  const { data } = await db.from("site_settings").select("value").eq("key", "messaging").maybeSingle();
  return parseMessagingSettings(data?.value);
}
