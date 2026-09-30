import type { Metadata } from "next";
import { isLocale, type Locale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { getHomeContent } from "@/content/home";
import { Hero } from "@/components/home/Hero";
import { WhatWeBuild } from "@/components/home/WhatWeBuild";
import { HowWeHelp } from "@/components/home/HowWeHelp";
import { Packages } from "@/components/home/Packages";
import { WhyTaysonsta } from "@/components/home/WhyTaysonsta";
import { Qualification } from "@/components/home/Qualification";
import { FounderSection } from "@/components/home/FounderSection";
import { Portfolio } from "@/components/home/Portfolio";
import { FAQSection } from "@/components/home/FAQSection";
import { FinalCTA } from "@/components/home/FinalCTA";
import { Reveal } from "@/components/ui/Reveal";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "ar";

  return buildMetadata({
    locale,
    path: "/",
    title:
      locale === "ar"
        ? "تايسونستا - بناء مشروع منتجات رقمية حقيقي"
        : "Taysonsta - Build a Real Digital Products Business",
    description:
      locale === "ar"
        ? "نحوّل الأفكار إلى Startups، من استراتيجية المنتج والتحقق من السوق، إلى التصميم والتطوير والإطلاق والنمو."
        : "We turn ideas into Startups, from product strategy and market validation, to design, development, launch, and growth.",
  });
}

export default async function HomePage({ params }: PageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const content = getHomeContent(locale);

  return (
    <>
      <Hero content={content.hero} locale={locale} />
      <Reveal><WhatWeBuild content={content.whatWeBuild} /></Reveal>
      <Reveal><HowWeHelp content={content.howWeHelp} locale={locale} /></Reveal>
      <Reveal><Portfolio content={content.portfolio} locale={locale} /></Reveal>
      <Reveal><Qualification content={content.qualification} locale={locale} /></Reveal>
      <Reveal><WhyTaysonsta content={content.whyUs} /></Reveal>
      <Reveal><Packages content={content.packages} locale={locale} /></Reveal>
      <Reveal><FounderSection content={content.founder} /></Reveal>
      <Reveal><FAQSection content={content.faq} locale={locale} /></Reveal>
      <Reveal><FinalCTA content={content.finalCta} locale={locale} /></Reveal>
    </>
  );
}
