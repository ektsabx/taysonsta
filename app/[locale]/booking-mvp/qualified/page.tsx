import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { getBookingContent } from "@/content/booking";
import { QualifiedResult } from "@/components/booking/QualifiedResult";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "ar";

  return {
    title: locale === "ar" ? "تم تأكيد حجزك - تايسونستا" : "Your Booking Is Confirmed - Taysonsta",
    robots: { index: false, follow: false },
  };
}

export default async function QualifiedPage({ params }: PageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  return <QualifiedResult content={getBookingContent(localeParam).qualified} />;
}
