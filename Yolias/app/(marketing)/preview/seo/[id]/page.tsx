import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { checkPreview, previewPage } from "@/lib/content/seo-store";
import { renderSeoPage } from "@/lib/content/seo-route";
import { noindex } from "@/lib/seo";

// A draft SEO page as the site will show it, opened from Yolias Admin with a
// link signed for 30 minutes (D-257). Never indexed, never cached.
export const metadata: Metadata = { title: "Preview | Yolias", robots: noindex };

export default async function PreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const { exp, sig } = await searchParams;
  if (!checkPreview(id, exp, sig)) notFound();
  const page = await previewPage(id);
  if (!page) notFound();
  return renderSeoPage(page, { preview: true });
}
