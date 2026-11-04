import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { AppStore } from "@/components/app/integrations/AppStore";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).settings.hub.title} | Yolias` };
}

// Integrations (owner, 2026-11-05): every integration and add-on as one card,
// opening one detail page (components/app/integrations).
export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireViewer();
  const q = await searchParams;
  // Back from Google Calendar, and older links, land on its own page.
  if (q.card === "calendar") redirect(`/integrations/google-calendar${q.calendar ? `?calendar=${encodeURIComponent(q.calendar)}` : ""}`);
  return <AppStore />;
}
