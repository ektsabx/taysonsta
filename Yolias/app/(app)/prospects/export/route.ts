import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { parseFilters, selectEntities, type ProspectFilters } from "@/services/prospects";

// CSV export of a Prospects tab (final spec phase 5). GET = every row
// matching the filters in the query string; POST (from the selection bar) =
// the selected ids, or all matching. Each entity has its own columns plus
// the standard intelligence fields. Exporting people reveals their contacts
// (recorded like a reveal).
const csvCell = (v: unknown) => {
  const s = v == null ? "" : Array.isArray(v) ? v.join("; ") : String(v);
  // Neutralise spreadsheet formula injection, then quote.
  // Phone numbers like "+966 5…" are data, not formulas.
  const isPhone = /^\+[\d\s()-]+$/.test(s);
  const safe = !isPhone && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

async function exportCsv(filters: ProspectFilters, ids: string[] | "all") {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const h = (await getDictionary()).prospects.csv;
  const page = await selectEntities(session.workspace.id, filters, ids);
  const intel = [h.match, h.confidence, h.lastUpdated, h.missing, h.source];
  const intelOf = (r: { match_score: number | null; confidence: number | null; last_updated: string; missing_fields: string[]; source: string }) =>
    [r.match_score, r.confidence, r.last_updated, r.missing_fields, r.source];

  let header: string[];
  let lines: unknown[][];
  if (page.tab === "people") {
    header = [h.name, h.title, h.company, h.employees, h.city, h.country, h.campaign, h.email, h.emailStatus, h.phone, h.linkedin, ...intel];
    lines = page.rows.map((p) => [
      p.full_name, p.title, p.company?.name, p.company?.employee_count, p.city ?? p.company?.city, p.country ?? p.company?.country,
      p.campaign?.name, p.email_status === "invalid" ? "" : p.email, p.email ? p.email_status : "", p.phone, p.linkedin_url, ...intelOf(p),
    ]);
    const unrevealed = page.rows.filter((p) => !p.revealed_at).map((p) => p.id);
    if (unrevealed.length) {
      const db = await createClient();
      await db.from("prospects").update({ revealed_at: new Date().toISOString(), revealed_by: session.userId }).eq("workspace_id", session.workspace.id).in("id", unrevealed).is("revealed_at", null);
    }
  } else if (page.tab === "jobs") {
    header = [h.title, h.department, h.company, h.city, h.country, h.postedAt, h.url, h.campaign, ...intel];
    lines = page.rows.map((j) => [j.title, j.department, j.company?.name, j.city, j.country, j.posted_at, j.url, j.campaign?.name, ...intelOf(j)]);
  } else if (page.tab === "local") {
    header = [h.name, h.category, h.address, h.city, h.country, h.phone, h.domain, h.rating, h.reviews, h.mapsUrl, h.campaign, ...intel];
    lines = page.rows.map((c) => [c.name, c.category, c.address, c.city, c.country, c.phone, c.website ?? c.domain, c.rating, c.reviews_count, c.maps_url, c.campaign?.name, ...intelOf(c)]);
  } else {
    header = [h.name, h.domain, h.industry, h.employees, h.city, h.country, h.campaign, ...intel];
    lines = page.rows.map((c) => [c.name, c.domain, c.industry, c.employee_count, c.city, c.country, c.campaign?.name, ...intelOf(c)]);
  }

  const csv = "﻿" + [header.map(csvCell).join(","), ...lines.map((l) => l.map(csvCell).join(","))].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="yolias-${filters.tab}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  return exportCsv(parseFilters(Object.fromEntries(request.nextUrl.searchParams)), "all");
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const filters = parseFilters(Object.fromEntries(new URLSearchParams(String(form.get("query") ?? ""))));
  const ids = form.get("all") === "1" ? "all" : form.getAll("id").map(String);
  return exportCsv(filters, ids);
}
