import { NextResponse, type NextRequest } from "next/server";
import { getBosUser } from "@/lib/bos/auth";
import { exportAdsCsv } from "@/services/bos/ads";
import { ForbiddenError } from "@/lib/bos/errors";

// Download the ads report as CSV (docs/bos/30 §14) — per campaign, in each
// account's own currency (no conversion in exports). Requires ads.export.
export async function GET(request: NextRequest) {
  const bos = await getBosUser();
  if (!bos) return new NextResponse("Unauthorized", { status: 401 });
  const sp = request.nextUrl.searchParams;
  const d = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = d(sp.get("from")) ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const to = d(sp.get("to")) ?? new Date().toISOString().slice(0, 10);
  const uuid = (v: string | null) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
  try {
    const csv = await exportAdsCsv(bos, { from, to, platform: sp.get("platform") || null, account_id: uuid(sp.get("account")), campaign_id: uuid(sp.get("campaign")) });
    return new NextResponse("﻿" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="ads-${from}-${to}.csv"`, "cache-control": "private, no-store" } });
  } catch (e) {
    return new NextResponse(e instanceof ForbiddenError ? "Forbidden" : "Error", { status: e instanceof ForbiddenError ? 403 : 500 });
  }
}
