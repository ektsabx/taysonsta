import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isLocale, locales, type Locale } from "@/lib/i18n";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { Clarity } from "@/components/analytics/Clarity";
import { CrispChat } from "@/components/analytics/CrispChat";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? `/${locale}`;

  return (
    <>
      <MetaPixel />
      <Clarity />
      <CrispChat />
      <Header locale={locale} pathname={pathname} />
      {children}
      <Footer locale={locale} />
    </>
  );
}
