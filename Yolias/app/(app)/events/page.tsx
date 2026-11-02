import type { Metadata } from "next";
import { requireViewer, canManageTeam } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { pixelCards } from "@/services/events";
import { PixelList } from "@/components/app/events/PixelList";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ag.rx.ev.title} | Yolias` };
}

// Events Manager (owner, 2026-11-02, D-274), after Facebook's: the workspace's pixels as cards, like Integrations.
export default async function EventsPage() {
  const session = await requireViewer();
  const cards = await pixelCards(session.workspace.id);
  const now = Date.parse(new Date().toISOString());
  return <PixelList cards={cards.map((c) => ({ ...c, active: Boolean(c.lastEventAt && Date.parse(c.lastEventAt) > now - 86_400_000) }))} canManage={canManageTeam(session)} />;
}
