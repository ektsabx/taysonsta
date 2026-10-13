import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ServiceStatus, StatusComponentRow, StatusIncidentRow, StatusIncidentUpdateRow } from "@/types/database";
import { statusSettings, type StatusSettings } from "./checks";

// What the public status page shows (D-181), from the stored checks and the
// incidents published in Yolias Admin:
//  - measured state: the latest check, but a failure only counts after
//    `failThreshold` checks in a row (one blip isn't an outage);
//  - no recent check (the checker itself stopped) → "no data", never green;
//  - an open incident or maintenance on a component sets at least its impact.

export type PublicStatus = ServiceStatus | "maintenance";
const rank: Record<PublicStatus, number> = { no_data: -1, operational: 0, maintenance: 1, degraded: 2, partial_outage: 3, major_outage: 4 };
export const worst = (xs: PublicStatus[]): PublicStatus => xs.reduce<PublicStatus>((a, b) => (rank[b] > rank[a] ? b : a), xs.length ? "no_data" : "no_data");

export function measured(c: Pick<StatusComponentRow, "last_status" | "last_checked_at" | "fail_streak" | "check_kind" | "check_enabled">, s: StatusSettings, now = Date.now()): ServiceStatus {
  if (c.check_kind === "manual" || !c.check_enabled) return "operational";
  if (!c.last_status || !c.last_checked_at) return "no_data";
  const staleMs = Math.max(3 * s.intervalMinutes, 20) * 60_000;
  if (now - Date.parse(c.last_checked_at) > staleMs) return "no_data";
  if (c.last_status !== "operational" && c.last_status !== "no_data" && c.fail_streak < s.failThreshold) return "operational";
  return c.last_status;
}

export function incidentActive(i: Pick<StatusIncidentRow, "status" | "kind" | "scheduled_for" | "scheduled_until">, now = Date.now()): boolean {
  if (i.kind === "incident") return i.status !== "resolved";
  if (i.status === "in_progress") return true;
  if (i.status === "scheduled" && i.scheduled_for && Date.parse(i.scheduled_for) <= now && (!i.scheduled_until || Date.parse(i.scheduled_until) > now)) return true;
  return false;
}

export interface StatusPageData {
  overall: PublicStatus;
  updatedAt: string | null;
  components: { id: string; name: string; description: string | null; status: PublicStatus; uptime: number | null; days: { day: string; status: PublicStatus | "none"; uptime: number | null }[] }[];
  active: (StatusIncidentRow & { updates: StatusIncidentUpdateRow[] })[];
  upcoming: (StatusIncidentRow & { updates: StatusIncidentUpdateRow[] })[];
  past: (StatusIncidentRow & { updates: StatusIncidentUpdateRow[] })[];
}

export async function statusPage(locale: "en" | "ar", days = 90): Promise<StatusPageData> {
  const db = createAdminClient();
  const from = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const recentSince = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [s, { data: comps }, { data: daily }, { data: incidents }] = await Promise.all([
    statusSettings(),
    db.from("status_components").select("*").eq("is_public", true).order("sort"),
    db.from("status_daily").select("*").gte("day", from),
    db.from("status_incidents").select("*").or(`status.not.in.(resolved,completed),resolved_at.gte.${recentSince},scheduled_for.gte.${recentSince}`).order("started_at", { ascending: false }).limit(50),
  ]);
  const ids = (incidents ?? []).map((i) => i.id);
  const { data: updates } = ids.length ? await db.from("status_incident_updates").select("*").in("incident_id", ids).order("created_at", { ascending: false }) : { data: [] as StatusIncidentUpdateRow[] };
  const withUpdates = (i: StatusIncidentRow) => ({ ...i, updates: (updates ?? []).filter((u) => u.incident_id === i.id) });
  const now = Date.now();
  const active = (incidents ?? []).filter((i) => incidentActive(i, now));
  const impactOf = (cid: string): PublicStatus | null => {
    const hits = active.filter((i) => i.components.includes(cid)).map((i) => (i.impact === "maintenance" ? "maintenance" : i.impact) as PublicStatus);
    return hits.length ? worst(hits) : null;
  };
  const dayList = Array.from({ length: days }, (_, k) => new Date(Date.now() - (days - 1 - k) * 86_400_000).toISOString().slice(0, 10));
  const components = (comps ?? []).map((c) => {
    const m = measured(c, s, now);
    const inc = impactOf(c.id);
    const status: PublicStatus = inc ? worst([m === "no_data" ? "operational" : m, inc]) : m;
    const rows = (daily ?? []).filter((d) => d.component_id === c.id);
    const byDay = new Map(rows.map((d) => [d.day, d]));
    const total = rows.reduce((a, d) => a + d.total, 0);
    const ok = rows.reduce((a, d) => a + d.ok, 0);
    return {
      id: c.id,
      name: locale === "ar" ? c.name_ar : c.name_en,
      description: locale === "ar" ? c.description_ar : c.description_en,
      status,
      uptime: total ? Math.round((ok / total) * 10000) / 100 : null,
      days: dayList.map((day) => {
        const d = byDay.get(day);
        if (!d || !d.total) return { day, status: "none" as const, uptime: null };
        const st: PublicStatus = d.outage ? "partial_outage" : d.degraded ? "degraded" : "operational";
        return { day, status: st, uptime: Math.round((d.ok / d.total) * 10000) / 100 };
      }),
    };
  });
  const measuredOnes = components.filter((c) => c.status !== "no_data").map((c) => c.status);
  return {
    overall: measuredOnes.length ? worst(measuredOnes) : "no_data",
    updatedAt: (comps ?? []).map((c) => c.last_checked_at).filter((x): x is string => !!x).sort().at(-1) ?? null,
    components,
    active: active.map(withUpdates),
    upcoming: (incidents ?? []).filter((i) => i.kind === "maintenance" && i.status === "scheduled" && !incidentActive(i, now) && i.scheduled_for && Date.parse(i.scheduled_for) > now).map(withUpdates),
    past: (incidents ?? []).filter((i) => !incidentActive(i, now) && (i.status === "resolved" || i.status === "completed")).map(withUpdates),
  };
}
