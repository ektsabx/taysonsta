import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { randomBytes } from "node:crypto";
import { requireViewer, canManageTeam } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { RANGE_PRESETS, rangeBounds, type RangePreset } from "@/lib/campaigns/metrics";
import { pixelOverview } from "@/services/events";
import { pixelSnippet } from "@/lib/pixel";
import { EventsManager, type EventsTab } from "@/components/app/events/EventsManager";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ag.rx.ev.title} | Yolias` };
}

// One pixel in Events Manager (D-274): Overview, Test events, Set up, Settings.
export default async function PixelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireViewer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const range = (RANGE_PRESETS as string[]).includes(one("range")) ? (one("range") as RangePreset) : "30d";
  const tab = (["overview", "test", "setup", "settings"].includes(one("tab")) ? one("tab") : "overview") as EventsTab;
  const data = await pixelOverview(session.workspace.id, id, rangeBounds(range, new Date(), { from: one("from"), to: one("to") }));
  if (!data) notFound();
  const active = Boolean(data.pixel.lastEventAt && Date.parse(data.pixel.lastEventAt) > Date.parse(new Date().toISOString()) - 86_400_000);
  // A fresh test code for this visit (like Facebook's TEST12345), made on the server so the page renders the same everywhere.
  const testCode = `TEST${randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`;
  return <EventsManager testCode={testCode} active={active} data={data} tab={tab} range={range} from={one("from")} to={one("to")} snippet={pixelSnippet(data.pixel.publicId)} canManage={canManageTeam(session)} timeZone={session.profile.timezone ?? null} />;
}
