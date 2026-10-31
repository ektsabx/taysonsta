import type { Metadata } from "next";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { IntegrationsHub } from "@/components/app/settings/IntegrationsHub";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).settings.hub.title} | Yolias` };
}

// Integrations (owner, 2026-10-31, D-271): its own page in the sidebar, out of
// Settings. The same cards: mailboxes, sending rules, Google Calendar.
export default async function IntegrationsPage() {
  await requireViewer();
  const t = await getDictionary();
  return (
    <div className="sdr-page">
      <header className="sdr-head"><div><h2>{t.settings.hub.title}</h2></div></header>
      <section className="sdr-panel"><div className="sdr-panel-body pad"><IntegrationsHub /></div></section>
    </div>
  );
}
