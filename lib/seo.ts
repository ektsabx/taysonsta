import type { Metadata } from "next";
import { localizedPath, locales, type Locale } from "@/lib/i18n";
import { storageUrl } from "@/lib/storage";

export const siteUrl = "https://taysonsta.net";

interface BuildMetadataInput {
  locale: Locale;
  path: string;
  title: string;
  description: string;
}

export function buildMetadata({ locale, path, title, description }: BuildMetadataInput): Metadata {
  const canonical = `${siteUrl}${localizedPath(locale, path)}`;
  const languages = Object.fromEntries(locales.map((l) => [l, `${siteUrl}${localizedPath(l, path)}`]));
  const ogImage = storageUrl("img/logo.png");

  return {
    title,
    description,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Taysonsta",
      locale: locale === "ar" ? "ar_AR" : "en_US",
      type: "website",
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}
