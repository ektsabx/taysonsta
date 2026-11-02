import type { Metadata } from "next";
import { requireViewer, canManageTeam } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { RANGE_PRESETS, rangeBounds, type RangePreset } from "@/lib/campaigns/metrics";
import { eventsOverview } from "@/services/events";
import { pixelSnippet } from "@/lib/pixel";
import { EventsManager, type EventsTab } from "@/components/app/events/EventsManager";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ag.rx.ev.title} | Yolias` };
}

// Events Manager (owner, 2026-11-02, D-274), after Facebook's: the pixel,
// its events, a test view of what arrives, and its settings.
export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireViewer();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const range = (RANGE_PRESETS as string[]).includes(one("range")) ? (one("range") as RangePreset) : "30d";
  const tab = (["overview", "test", "setup", "settings"].includes(one("tab")) ? one("tab") : "overview") as EventsTab;
  const data = await eventsOverview(session.workspace.id, rangeBounds(range, new Date(), { from: one("from"), to: one("to") }));
  const active = Boolean(data.pixel.lastEventAt && Date.parse(data.pixel.lastEventAt) > Date.parse(new Date().toISOString()) - 86_400_000);
  return <EventsManager active={active} data={data} tab={tab} range={range} from={one("from")} to={one("to")} snippet={pixelSnippet(data.pixel.id)} canManage={canManageTeam(session)} timeZone={session.profile.timezone ?? null} />;
}
