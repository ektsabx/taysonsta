import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { getAboutContent } from "@/content/about";
import { getHomeContent } from "@/content/home";
import { PageTopSpacer } from "@/components/ui/PageTopSpacer";
import { Reveal } from "@/components/ui/Reveal";
import {
  AboutIntro,
  AboutStory,
  AboutFounder,
  AboutVision,
  AboutBrandStatement,
  AboutClosing,
} from "@/components/about/AboutSections";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "ar";

  return buildMetadata({
    locale,
    path: "/about",
    title: locale === "ar" ? "من نحن - تايسونستا" : "About Us - Taysonsta",
    description:
      locale === "ar"
        ? "Taysonsta شركة متخصصة في بناء وتطوير الشركات والمنتجات الرقمية مع المؤسسين."
        : "Taysonsta is a company specialized in building and developing digital companies and products with founders.",
  });
}

export default async function AboutPage({ params }: PageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const content = getAboutContent(locale);
  const finalCta = getHomeContent(locale).finalCta;

  return (
    <>
      <PageTopSpacer />
      <AboutIntro content={content.intro} />
      <Reveal><AboutStory content={content.story} /></Reveal>
      <Reveal><AboutFounder content={content.founder} /></Reveal>
      <Reveal><AboutVision content={content.vision} /></Reveal>
      <Reveal><AboutBrandStatement content={content.brand} /></Reveal>
      <Reveal><AboutClosing content={finalCta} locale={locale} /></Reveal>
    </>
  );
}
