import { nowIso } from "@/lib/bos/clock";
import { NextResponse, type NextRequest } from "next/server";
import { getBosSession } from "@/lib/bos/auth";
import type { PermissionKey, Scope } from "@/lib/bos/permissions";
import { audit } from "@/lib/bos/audit";
import { csvEscape, listLeads } from "@/services/bos/leads";
import { exporters } from "@/services/bos/exporters";
import { userNameMap } from "@/services/bos/shared";

// CSV export (§7, §70). Uses the same filters and record scope as the list
// page; each export is audited.
export async function GET(request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const session = await getBosSession();
  if (session.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bos = session.bos;

  const filters = Object.fromEntries(request.nextUrl.searchParams.entries());
  let header: string[];
  let rows: unknown[][];

  if (entity === "leads") {
    const scope = bos.permissions.get("leads.export");
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const readScope = bos.permissions.get("leads.read") as Scope;
    const names = await userNameMap();
    const all: Awaited<ReturnType<typeof listLeads>>["rows"] = [];
    for (let page = 1; page <= 50; page++) {
      const { rows: chunk, total } = await listLeads(bos, readScope, { ...filters, page, pageSize: 200 });
      all.push(...chunk);
      if (all.length >= total || !chunk.length) break;
    }
    header = ["Lead #", "Lead name", "Company", "Contact", "Email", "Phone", "Country", "Industry", "Source", "Assigned BD", "Stage", "Score", "Budget", "Currency", "Last activity", "Next activity", "Created", "Updated"];
    rows = all.map((l) => [
      l.lead_number, l.name, l.company_name, l.contact_name, l.email, l.phone, l.country, l.industry,
      (l.lead_sources as unknown as { name: string } | null)?.name, l.assigned_to ? names.get(l.assigned_to) : "",
      (l.pipeline_stages as unknown as { name: string }).name, l.total_score, l.estimated_budget, l.budget_currency,
      l.last_activity_at, l.next_activity_at, l.created_at, l.updated_at,
    ]);
  } else if (exporters[entity]) {
    const exporter = exporters[entity];
    if (!bos.permissions.get(exporter.permission as PermissionKey)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    ({ header, rows } = await exporter.run(bos, filters));
  } else {
    return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  }

  await audit({ actorId: bos.userId, action: "data.exported", entityType: entity, entityId: null, metadata: { filters, rows: rows.length } });

  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${entity}-${nowIso().slice(0, 10)}.csv"`,
    },
  });
}
