import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { getBookingContent } from "@/content/booking";
import { UnqualifiedResult } from "@/components/booking/UnqualifiedResult";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "ar";

  return {
    title: locale === "ar" ? "شكرًا لاهتمامك - تايسونستا" : "Thanks for Your Interest - Taysonsta",
    robots: { index: false, follow: false },
  };
}

export default async function UnqualifiedPage({ params }: PageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  return <UnqualifiedResult content={getBookingContent(localeParam).unqualified} />;
}
