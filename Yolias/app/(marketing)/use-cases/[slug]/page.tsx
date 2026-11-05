import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { useCasesPage } from "@/lib/content/use-cases";
import { getLocale } from "@/lib/i18n/server";
import { breadcrumbSchema, pageMetadata, webPageSchema } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";
import { WorkflowView } from "@/components/marketing/WorkflowView";
import { allWorkflows } from "@/services/workflows";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const w = (await allWorkflows()).find((x) => x.slug === slug);
  if (!w) return { title: "Yolias" };
  return pageMetadata({ title: w.text[locale].seoTitle, description: w.text[locale].seoDescription, path: `/use-cases/${slug}` });
}

// Use cases as working guides (owner, 2026-11-05).
export default async function UseCasePage({ params }: Props) {
  const { slug } = await params;
  const all = await allWorkflows();
  const w = all.find((x) => x.slug === slug);
  if (!w) notFound();
  const locale = await getLocale();
  const c = useCasesPage[locale];
  const x = w.text[locale];
  return (
    <>
      <JsonLd nodes={[
        webPageSchema({ title: x.seoTitle, description: x.seoDescription, path: `/use-cases/${slug}` }),
        breadcrumbSchema([{ name: "Yolias", path: "/" }, { name: c.title, path: "/use-cases" }, { name: x.name, path: `/use-cases/${slug}` }]),
      ]} />
      <WorkflowView w={w} locale={locale} all={all} />
    </>
  );
}
