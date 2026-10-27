import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSeoPage, renderSeoPage, seoMetadata } from "@/lib/content/seo-route";

// One compare page, edited in Yolias Admin → SEO → Pages (D-257).
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return seoMetadata(await loadSeoPage("compare", (await params).slug));
}

export default async function Page({ params }: Props) {
  const page = await loadSeoPage("compare", (await params).slug);
  if (!page) notFound();
  return renderSeoPage(page);
}
