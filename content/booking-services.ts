import type { Locale } from "@/lib/i18n";

export interface BookingQuestionOption {
  value: string;
  label: string;
}

export interface BookingQuestionDef {
  key: string;
  label: string;
  options: BookingQuestionOption[];
}

export interface BookingServiceDefinition {
  id: string;
  path: string;
  label: string;
  price: string;
  seoTitle: (locale: Locale) => string;
  seoDescription: (locale: Locale) => string;
  /** Overrides the shared meeting description paragraphs for this service only. Leave undefined to use the shared/admin-editable meeting content. */
  meetingParagraphs?: (locale: Locale) => string[];
  /** Custom qualification questions for this service. Leave undefined to use the default qualification form. */
  questions?: (locale: Locale) => BookingQuestionDef[];
}

export const bookingServices: Record<"mvp" | "growth", BookingServiceDefinition> = {
  mvp: {
    id: "mvp",
    path: "/booking-mvp",
    label: "MVP",
    price: "$5,000",
    seoTitle: (locale: Locale) => (locale === "ar" ? "احجز مكالمة - باقة MVP - تايسونستا" : "Book a Call - MVP Package - Taysonsta"),
    seoDescription: (locale: Locale) =>
      locale === "ar"
        ? "احجز مكالمة استراتيجية مع فريق Taysonsta لمناقشة باقة MVP لمشروعك الرقمي."
        : "Book a strategy call with the Taysonsta team to discuss the MVP package for your digital business.",
  },
  growth: {
    id: "growth",
    path: "/booking-growth",
    label: "Growth",
    price: "$20,000",
    seoTitle: (locale: Locale) => (locale === "ar" ? "احجز مكالمة - باقة Growth - تايسونستا" : "Book a Call - Growth Package - Taysonsta"),
    seoDescription: (locale: Locale) =>
      locale === "ar"
        ? "احجز مكالمة استراتيجية مع فريق Taysonsta لمناقشة باقة Growth لمشروعك الرقمي."
        : "Book a strategy call with the Taysonsta team to discuss the Growth package for your digital business.",
  },
};

export type BookingServiceId = keyof typeof bookingServices;

export function isBookingServiceId(value: string): value is BookingServiceId {
  return value in bookingServices;
}

export const bookingServiceIds = Object.keys(bookingServices) as BookingServiceId[];
