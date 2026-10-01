import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { listProspects, parseFilters } from "@/services/prospects";

// CSV export of saved prospects (respects the Prospects page filters).
const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection, then quote.
  // Phone numbers like "+966 5…" are data, not formulas.
  const isPhone = /^\+[\d\s()-]+$/.test(s);
  const safe = !isPhone && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const filters = parseFilters(Object.fromEntries(request.nextUrl.searchParams));
  const rows = await listProspects(session.workspace.id, filters, 10000);
  const h = (await getDictionary()).prospects.csv;
  const header = [h.name, h.title, h.company, h.employees, h.city, h.country, h.campaign, h.email, h.emailStatus, h.phone, h.whatsapp, h.linkedin, h.match];
  const lines = rows.map((p) =>
    [
      p.full_name, p.title, p.company?.name, p.company?.employee_count, p.city ?? p.company?.city, p.country ?? p.company?.country,
      p.campaign?.name, p.email, p.email ? p.email_status : "", p.phone, p.whatsapp, p.linkedin_url, p.match_score,
    ].map(csvCell).join(",")
  );
  const csv = "﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="yolias-prospects-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
