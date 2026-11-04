import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { isAppKey } from "@/lib/app-listings";
import { appListings } from "@/services/app-listings";
import { AppDetail } from "@/components/app/integrations/AppDetail";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).settings.hub.title} | Yolias` };
}

export default async function IntegrationPage({ params }: { params: Promise<{ key: string }> }) {
  await requireViewer();
  const { key } = await params;
  if (!isAppKey(key)) notFound();
  const listing = (await appListings(await getLocale()))[key];
  return <AppDetail app={key} listing={listing} />;
}
