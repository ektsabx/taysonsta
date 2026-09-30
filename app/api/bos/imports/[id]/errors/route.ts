import { NextResponse, type NextRequest } from "next/server";
import { getBosUser } from "@/lib/bos/auth";
import { errorReportCsv } from "@/services/bos/import-engine";

// Downloadable error report for an import (docs/bos/30 §27.2).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bos = await getBosUser();
  if (!bos) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  try {
    const csv = await errorReportCsv(bos, id);
    return new NextResponse("﻿" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="import-errors-${id.slice(0, 8)}.csv"`, "cache-control": "private, no-store" } });
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }
}
