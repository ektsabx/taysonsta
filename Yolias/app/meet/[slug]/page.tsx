import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { noindex } from "@/lib/seo";
import { getLocale } from "@/lib/i18n/server";
import { pageBySlug, slotsByType } from "@/lib/meetings";
import { BookingForm } from "./BookingForm";

// A member's public booking page (D-267): yolias.com/meet/<slug>. Shared by
// their agent in replies and by them anywhere; not indexed by search engines.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await pageBySlug((await params).slug);
  return { title: page ? `${page.title} · ${page.host.name}` : "Booking", robots: noindex };
}

export default async function MeetPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ l?: string }> }) {
  const page = await pageBySlug((await params).slug);
  if (!page) notFound();
  const l = (await searchParams).l;
  const locale = l === "ar" || l === "en" ? l : await getLocale();
  const types = page.enabled ? await slotsByType(page) : [];
  return (
    <BookingForm
      locale={locale}
      slug={page.slug}
      host={page.host}
      title={page.title}
      location={page.location}
      timezone={page.timezone}
      enabled={page.enabled}
      types={types}
    />
  );
}
