import type { Metadata } from "next";
import { localizedHref } from "@/lib/i18n/paths";
import { SOCIAL_PROFILES } from "@/lib/social";

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
// D-275 (owner, 2026-11-02): Yolias is an AI advertising platform for customer
// acquisition. Search titles are in one language each: Arabic pages say
// "يولياس" and carry no English brand (see localizeTitle).
export const HOME_TITLE = "Yolias - AI Advertising Platform for Customer Acquisition";
export const HOME_TITLE_AR = "يولياس - منصة إعلانات بالذكاء الاصطناعي لاكتساب العملاء";
/** The home page's search snippet: under 170 characters, brand first, in each language. */
export const HOME_DESCRIPTION = {
  en: "Yolias is an AI advertising platform: define the customers you want, and AI campaigns reach the decision makers and bring you meetings, leads and sales.",
  ar: "يولياس منصة إعلانات بالذكاء الاصطناعي: حدد العملاء الذين تريدهم، فتصل حملاته الذكية إلى صنّاع القرار وتأتيك باجتماعات وعملاء ومبيعات.",
};
/** Search titles and snippets that differ from the page's headline (D-265 audit: titles 15–65, descriptions 50–170). */
export const PAGE_META: Record<"product" | "about" | "pricing", Partial<Record<"en" | "ar", { title?: string; description?: string }>>> = {
  product: {
    en: { title: "AI Advertising Platform for Customer Acquisition | Yolias", description: "Campaigns like an ads manager: Yolias finds the customers you define, contacts each one, answers replies and books meetings, with conversions and revenue tracked." },
    ar: { title: "منصة إعلانات بالذكاء الاصطناعي لاكتساب العملاء | يولياس", description: "حملات مثل مدير الإعلانات: يجد يولياس العملاء الذين تحددهم، ويتواصل مع كل منهم، ويرد ويحجز الاجتماعات، مع حساب التحويلات والإيرادات." },
  },
  about: {
    en: { title: "About Yolias | AI Advertising Platform", description: "Why we built Yolias: advertising that starts from the customer you choose, and AI that reaches them and brings back meetings, leads and sales." },
    ar: { title: "عن يولياس | منصة إعلانات بالذكاء الاصطناعي", description: "لماذا بنينا يولياس: إعلان يبدأ من العميل الذي تختاره، وذكاء اصطناعي يصل إليه ويأتيك باجتماعات وعملاء ومبيعات." },
  },
  pricing: {
    en: { description: "Yolias pricing: pay as you go, or Growth and Scale plans billed monthly or annually at 20% off. All features and unlimited users on every option." },
    ar: { description: "أسعار يولياس: ادفع حسب استخدامك، أو خطتا النمو والتوسع شهريًا أو سنويًا بخصم 20%. كل الميزات ومستخدمون بلا حد في كل خيار." },
  },
};
/** How people write the brand: Arabic spelling, the product name and what it is (schema.org alternateName). */
export const BRAND_NAMES = ["يولياس", "Yolias AI", "يولياس AI", "منصة يولياس", "Yolias AI Advertising Platform", "منصة إعلانات يولياس", "Yolias AI Sales Agent"];
/** The one-line definition used everywhere Yolias is described (site, llms.txt, schema). */
export const DEFINITION = "Yolias is an AI advertising platform for customer acquisition. Instead of paying for reach and views, a business defines the customers it wants (campaign, audiences and message, like an ads manager), and Yolias's AI campaigns find the matching companies and decision makers, contact each one directly with a personal email from the business's own mailbox (Gmail or any IMAP/SMTP account), follow up, answer the replies and book the meetings. Each campaign works for one goal (meetings, sales, website leads or qualified leads) and tracks its conversions, revenue and cost per result. It adds an acquisition channel next to ads on Facebook, Google, TikTok, Snapchat and LinkedIn.";
export const OG_IMAGE = { url: "/og/yolias-og.png", width: 1200, height: 630, alt: "Yolias: the AI advertising platform for customer acquisition" };

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
  const pageTitle = localizeTitle(p.title, locale);
  const title = p.absoluteTitle ? { absolute: pageTitle } : pageTitle;
  const canonical = localizedHref(p.path, locale);
  return {
    title,
    description: p.description,
    alternates: { canonical, languages: languageAlternates(p.path) },
    openGraph: {
      type: p.type ?? "website", siteName: locale === "ar" ? "يولياس" : SITE_NAME, title: pageTitle, description: p.description, url: canonical, images: [OG_IMAGE],
      locale: locale === "ar" ? "ar_AR" : "en_US", alternateLocale: locale === "ar" ? ["en_US"] : ["ar_AR"],
      ...(p.publishedTime ? { publishedTime: p.publishedTime } : {}),
    },
    twitter: { card: "summary_large_image", title: pageTitle, description: p.description, images: [OG_IMAGE.url] },
  };
}

/**
 * A search title in one language (owner, 2026-11-02, D-275): on Arabic pages
 * the brand and the site sections are written in Arabic ("| يولياس", not
 * "| Yolias"), so an Arabic result reads fully in Arabic. Other products'
 * names (Calendly, Gmail…) stay as people search for them.
 */
export function localizeTitle(title: string, locale: string): string {
  // "Notes from the Yolias team | Yolias": the brand once is enough. A title
  // left too short for search ("Work on Yolias") says what Yolias is instead.
  const once = (t: string) => {
    const m = t.match(/^(.*(?:Yolias|يولياس).*) \| (?:Yolias|يولياس)$/);
    if (!m) return t;
    return m[1].length >= 20 ? m[1] : `${m[1]} | ${locale === "ar" ? "منصة إعلانات بالذكاء الاصطناعي" : "AI Advertising Platform"}`;
  };
  if (locale !== "ar") return once(title);
  return once(title
    .replace(/\s*\(Yolias\)/g, "")
    .replace(/Yolias Help Center/g, "مركز مساعدة يولياس")
    .replace(/Yolias Docs/g, "مستندات يولياس")
    .replace(/Yolias Blog/g, "مدونة يولياس")
    .replace(/Yolias AI/g, "يولياس AI")
    .replace(/\bYolias\b/g, "يولياس"));
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
    sameAs: SOCIAL_PROFILES.map((s) => s.href),
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
