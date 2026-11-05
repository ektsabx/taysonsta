import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { EmailSettings } from "@/components/app/settings/EmailSettings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).settings.hub.title} | Yolias` };
}

// A mailbox's own page (owner, 2026-11-05): connect it and set its sending
// rules here; the integration's page only describes it.
export default async function ConnectPage({ params }: { params: Promise<{ key: string }> }) {
  await requireViewer();
  const { key } = await params;
  if (key !== "gmail" && key !== "imap") notFound();
  const t = await getDictionary();
  return (
    <div className="sdr-page">
      <Link className="app-back" href={`/integrations/${key}`}><ArrowLeft className="flip-rtl" />{t.settings.hub.apps.items[key].name}</Link>
      <EmailSettings card={key} />
    </div>
  );
}
