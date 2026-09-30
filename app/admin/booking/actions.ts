"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth";
import { updateBookingMeetingSettings } from "@/services/booking-settings";
import { bookingStatuses, updateBookingStatusAdmin } from "@/services/booking-admin";
import { bookingServiceIds, bookingServices } from "@/content/booking-services";
import type { BookingStatus } from "@/types/database";

export interface FormState {
  error: string | null;
  success: boolean;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function parseDurations(text: string): number[] {
  return Array.from(
    new Set(
      text
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  ).sort((a, b) => a - b);
}

export async function saveBookingMeetingAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdminUser();

  const titleAr = String(formData.get("titleAr") ?? "").trim();
  const titleEn = String(formData.get("titleEn") ?? "").trim();
  const descriptionAr = String(formData.get("descriptionAr") ?? "");
  const descriptionEn = String(formData.get("descriptionEn") ?? "");
  const locationAr = String(formData.get("locationAr") ?? "").trim();
  const locationEn = String(formData.get("locationEn") ?? "").trim();
  const durationMinutes = Number(formData.get("durationMinutes") ?? 30);
  const allowMultipleDurations = formData.get("allowMultipleDurations") === "on";
  const durationOptionsRaw = String(formData.get("durationOptions") ?? "");

  if (!titleAr || !titleEn || !locationAr || !locationEn) {
    return { error: "من فضلك املأ كل الحقول المطلوبة", success: false };
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { error: "المدة الافتراضية غير صحيحة", success: false };
  }

  const parsedDescriptionAr = splitParagraphs(descriptionAr);
  const parsedDescriptionEn = splitParagraphs(descriptionEn);

  if (parsedDescriptionAr.length === 0 || parsedDescriptionEn.length === 0) {
    return { error: "الوصف مطلوب باللغتين", success: false };
  }

  let durationOptions = parseDurations(durationOptionsRaw);
  if (durationOptions.length === 0) {
    durationOptions = [durationMinutes];
  }
  if (!durationOptions.includes(durationMinutes)) {
    durationOptions = [...durationOptions, durationMinutes].sort((a, b) => a - b);
  }

  await updateBookingMeetingSettings({
    title: { ar: titleAr, en: titleEn },
    description: { ar: parsedDescriptionAr, en: parsedDescriptionEn },
    location: { ar: locationAr, en: locationEn },
    durationMinutes,
    allowMultipleDurations,
    durationOptions,
  });

  revalidatePath("/admin/booking/settings");
  for (const id of bookingServiceIds) {
    revalidatePath(bookingServices[id].path);
    revalidatePath(`/en${bookingServices[id].path}`);
  }

  return { error: null, success: true };
}

export interface UpdateBookingStatusResult {
  error: string | null;
}

export async function updateBookingStatusAction(id: string, status: BookingStatus): Promise<UpdateBookingStatusResult> {
  await requireAdminUser();

  if (!bookingStatuses.includes(status)) {
    return { error: "حالة غير صالحة" };
  }

  try {
    await updateBookingStatusAdmin(id, status);
  } catch {
    return { error: "حدث خطأ، حاول مرة أخرى" };
  }

  revalidatePath("/admin/booking");
  revalidatePath(`/admin/booking/${id}`);

  return { error: null };
}
