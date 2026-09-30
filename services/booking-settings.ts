import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBookingContent, type BookingContent } from "@/content/booking";
import type { Locale } from "@/lib/i18n";

const SETTINGS_KEY = "booking_meeting";

export interface BookingMeetingSettings {
  title: { ar: string; en: string };
  description: { ar: string[]; en: string[] };
  location: { ar: string; en: string };
  durationMinutes: number;
  allowMultipleDurations: boolean;
  durationOptions: number[];
}

export async function getBookingMeetingSettings(): Promise<BookingMeetingSettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("site_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();

  if (error) {
    throw error;
  }

  return (data?.value as unknown as BookingMeetingSettings | undefined) ?? null;
}

export async function getBookingMeetingSettingsAdmin(): Promise<BookingMeetingSettings | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("site_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();

  if (error) {
    throw error;
  }

  return (data?.value as unknown as BookingMeetingSettings | undefined) ?? null;
}

export async function updateBookingMeetingSettings(settings: BookingMeetingSettings): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("site_settings").upsert({ key: SETTINGS_KEY, value: settings as unknown as Json });

  if (error) {
    throw error;
  }
}

function formatDuration(minutes: number, locale: Locale): string {
  return locale === "ar" ? `${minutes} دقيقة` : `${minutes} minutes`;
}

export type EffectiveMeeting = BookingContent["meeting"] & {
  allowMultipleDurations: boolean;
  durationOptions: number[];
  defaultDurationMinutes: number;
};

export async function getEffectiveMeetingContent(locale: Locale): Promise<EffectiveMeeting> {
  const base = getBookingContent(locale).meeting;
  const override = await getBookingMeetingSettings();

  if (!override) {
    return { ...base, allowMultipleDurations: false, durationOptions: [30], defaultDurationMinutes: 30 };
  }

  return {
    ...base,
    title: override.title[locale],
    paragraphs: override.description[locale],
    duration: formatDuration(override.durationMinutes, locale),
    platform: override.location[locale],
    allowMultipleDurations: override.allowMultipleDurations,
    durationOptions: override.durationOptions.length > 0 ? override.durationOptions : [override.durationMinutes],
    defaultDurationMinutes: override.durationMinutes,
  };
}
