"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { capture } from "@/lib/analytics/server";
import { importFields, MAX_IMPORT_ROWS, toImportRow, type ImportField, type ImportKind } from "@/lib/csv-import";
import type { Json } from "@/types/database";

// Import CSV (owner brief 2026-10-12): contacts the member already has go into
// Prospects. The browser sends the parsed cells and the column mapping; the
// server validates every row again and the database inserts the whole file in
// one transaction (import_contacts), under the plan's monthly uploaded-
// contacts limit, as the member (RLS + membership check).

export type ImportResult = { ok: true; imported: number; message: string } | { ok: false; error: string };

export async function importContacts(input: { fileName: string; kind: ImportKind; mapping: Record<ImportField, number>; rows: string[][] }): Promise<ImportResult> {
  const session = await requireSession();
  const t = await getDictionary();
  const e = t.prospects.import.errors;
  const kinds: ImportKind[] = ["person", "company", "local_business"];
  if (!kinds.includes(input.kind) || !Array.isArray(input.rows)) return { ok: false, error: e.failed };
  if (input.rows.length > MAX_IMPORT_ROWS) return { ok: false, error: e.tooMany };
  const mapping = Object.fromEntries(importFields.map((f) => {
    const v = Number(input.mapping?.[f]);
    return [f, Number.isInteger(v) && v >= 0 && v < 200 ? v : -1];
  })) as Record<ImportField, number>;
  if (mapping.name < 0) return { ok: false, error: e.name };

  const rows = input.rows
    .filter((r) => Array.isArray(r))
    .map((r) => toImportRow(r.slice(0, 200).map((c) => String(c ?? "").slice(0, 2000)), mapping, input.kind))
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (!rows.length) return { ok: false, error: e.empty };

  const db = await createClient();
  const { data, error } = await db.rpc("import_contacts", { p_ws: session.workspace.id, p_name: input.fileName.slice(0, 200) || "CSV import", p_rows: rows as unknown as Json });
  const r = (data ?? null) as { ok?: boolean; error?: string; available?: number; imported?: number } | null;
  if (error || !r) {
    console.error("[import] failed", error?.code);
    return { ok: false, error: e.failed };
  }
  if (!r.ok) {
    if (r.error === "limit") return { ok: false, error: fmt(e.limit, { count: String(r.available ?? 0) }) };
    if (r.error === "forbidden") return { ok: false, error: e.forbidden };
    return { ok: false, error: e.failed };
  }
  await capture(session.userId, "contacts_imported", { workspace_id: session.workspace.id, rows: r.imported ?? rows.length, kind: input.kind });
  revalidatePath("/prospects", "layout");
  return { ok: true, imported: r.imported ?? rows.length, message: fmt(t.prospects.import.done, { count: String(r.imported ?? rows.length) }) };
}
