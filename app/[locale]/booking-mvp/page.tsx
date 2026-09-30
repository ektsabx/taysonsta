import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { bookingServices } from "@/content/booking-services";
import { BookingPageContent } from "@/components/booking/BookingPageContent";

const service = bookingServices.mvp;

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "ar";

  return buildMetadata({
    locale,
    path: service.path,
    title: service.seoTitle(locale),
    description: service.seoDescription(locale),
  });
}

export default async function BookingMvpPage({ params }: PageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  return <BookingPageContent locale={localeParam} serviceId="mvp" />;
}
