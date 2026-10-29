import type { Metadata } from "next";
import { localizedHref } from "@/lib/i18n/paths";

// Search and answer-engine metadata for the public website (D-179). One
// helper so every public page gets a unique title and description, a
// canonical URL on the production domain, Open Graph / X cards and a shared
// image. Structured data (schema.org JSON-LD) is built here from the same
// facts the page shows; nothing is added that the page doesn't say (no
// ratings, reviews, awards or invented prices).
//
// Every website page has an English URL and an Arabic one under /ar (D-258);
// each declares its own canonical and both versions as hreflang alternates,
// so searches in either language find the page in that language.

export const SITE_NAME = "Yolias";
export const HOME_TITLE = "Yolias: Your AI Sales Agent for Business Growth";
/** The owner's home title in Arabic, for /ar: the Arabic name first, so Arabic searches for the brand find Yolias (D-265). */
export const HOME_TITLE_AR = "يولياس (Yolias): وكيل المبيعات بالذكاء الاصطناعي لنمو أعمالك";
/** The home page's search snippet (D-265): under 170 characters, brand first, in each language. */
export const HOME_DESCRIPTION = {
  en: "Yolias, the AI sales agent for service businesses: describe your ideal customer and it finds the companies and decision makers, then emails them from your mailbox.",
  ar: "يولياس وكيل مبيعات بالذكاء الاصطناعي للشركات التي تبيع خدمات: صِف عميلك المثالي، فيجد لك الشركات وصنّاع القرار ويراسلهم من بريدك أنت.",
};
/** How people write the brand: Arabic spelling, the product name and what it is (schema.org alternateName). */
export const BRAND_NAMES = ["يولياس", "Yolias AI", "يولياس AI", "منصة يولياس", "Yolias AI Sales Agent"];
/** The one-line definition used everywhere Yolias is described (site, llms.txt, schema). */
export const DEFINITION = "Yolias is an AI customer discovery platform for businesses that sell services. You describe your ideal customer in plain language, in English or Arabic, and Yolias runs a search that finds matching companies, local businesses and decision makers, explains why each one fits, prepares the outreach campaign, and sends it from your own mailbox (Gmail or any IMAP/SMTP account) only after you approve it.";
export const OG_IMAGE = { url: "/og/yolias-og.png", width: 1200, height: 630, alt: "Yolias: AI customer discovery for businesses that sell services" };

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200").replace(/\/$/, "");
}

export function absolute(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Metadata for an indexable public page. `title` is used as is (pages add "| Yolias" themselves where wanted). */
export async function pageMetadata(p: { title: string; description: string; path: string; type?: "website" | "article"; absoluteTitle?: boolean; publishedTime?: string }): Promise<Metadata> {
  const { getLocale } = await import("@/lib/i18n/server");
  const locale = await getLocale();
  const title = p.absoluteTitle ? { absolute: p.title } : p.title;
  const canonical = localizedHref(p.path, locale);
  return {
    title,
    description: p.description,
    alternates: { canonical, languages: languageAlternates(p.path) },
    openGraph: {
      type: p.type ?? "website", siteName: SITE_NAME, title: p.title, description: p.description, url: canonical, images: [OG_IMAGE],
      locale: locale === "ar" ? "ar_AR" : "en_US", alternateLocale: locale === "ar" ? ["en_US"] : ["ar_AR"],
      ...(p.publishedTime ? { publishedTime: p.publishedTime } : {}),
    },
    twitter: { card: "summary_large_image", title: p.title, description: p.description, images: [OG_IMAGE.url] },
  };
}

/** hreflang: the English and Arabic URLs of a page; English is the default for other languages. */
export function languageAlternates(path: string): Record<string, string> {
  return { en: localizedHref(path, "en"), ar: localizedHref(path, "ar"), "x-default": localizedHref(path, "en") };
}

/** For pages that must never appear in search results (sign-in, checkout, the app). */
export const noindex: Metadata["robots"] = { index: false, follow: false };

// ───────────────────────── schema.org ─────────────────────────

type Thing = Record<string, unknown>;

export function organizationSchema(): Thing {
  return {
    "@type": "Organization",
    "@id": absolute("/#organization"),
    name: SITE_NAME,
    alternateName: BRAND_NAMES,
    url: absolute("/"),
    logo: { "@type": "ImageObject", url: absolute("/brand/logo-mark.png") },
    description: DEFINITION,
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", url: absolute("/contact"), availableLanguage: ["English", "Arabic"] },
  };
}

export function websiteSchema(): Thing {
  return { "@type": "WebSite", "@id": absolute("/#website"), url: absolute("/"), name: SITE_NAME, alternateName: BRAND_NAMES, description: DEFINITION, publisher: { "@id": absolute("/#organization") }, inLanguage: ["en", "ar"] };
}

/** The product, with the plans as offers: only prices the pricing page shows. */
export function softwareSchema(offers: { name: string; price: number; period: "month" | "year" }[]): Thing {
  return {
    "@type": "SoftwareApplication",
    "@id": absolute("/#software"),
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: absolute("/"),
    description: DEFINITION,
    inLanguage: ["en", "ar"],
    publisher: { "@id": absolute("/#organization") },
    ...(offers.length ? {
      offers: offers.map((o) => ({
        "@type": "Offer", name: o.name, price: o.price.toFixed(2), priceCurrency: "USD", url: absolute("/pricing"),
        ...(o.price > 0 ? { priceSpecification: { "@type": "UnitPriceSpecification", price: o.price.toFixed(2), priceCurrency: "USD", billingDuration: 1, unitCode: o.period === "month" ? "MON" : "ANN" } } : {}),
      })),
    } : {}),
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]): Thing {
  return { "@type": "BreadcrumbList", itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absolute(it.path) })) };
}

/** Only for questions and answers shown on the same page. */
export function faqSchema(faq: { q: string; a: string }[]): Thing {
  return { "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
}

export function articleSchema(a: { title: string; description: string; path: string; date: string }): Thing {
  return {
    "@type": "BlogPosting", headline: a.title, description: a.description, url: absolute(a.path), mainEntityOfPage: absolute(a.path),
    datePublished: a.date, dateModified: a.date, image: absolute(OG_IMAGE.url),
    author: { "@id": absolute("/#organization") }, publisher: { "@id": absolute("/#organization") },
  };
}

export function webPageSchema(p: { title: string; description: string; path: string; type?: "WebPage" | "CollectionPage" | "AboutPage" | "ContactPage" }): Thing {
  return { "@type": p.type ?? "WebPage", "@id": absolute(`${p.path}#page`), url: absolute(p.path), name: p.title, description: p.description, isPartOf: { "@id": absolute("/#website") } };
}

/** One JSON-LD document with every node of the page (`<` escaped so it can't close the script tag). */
export function jsonLd(...nodes: Thing[]): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replace(/</g, "\\u003c");
}
