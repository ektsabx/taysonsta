import { can, type BosUser } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { importTypeMap } from "@/services/bos/import-types";
import { importSections } from "@/lib/bos/import-sections";
import { formatDateTime } from "@/lib/bos/format";
import { ImportDialog } from "@/app/admin/imports/ImportControls";

// Section-level import (docs/bos/39 §4): opens next to the section's export,
// limited to this section's data type and to the viewer's permissions.
export async function ImportButton({ bos, type }: { bos: BosUser; type: string }) {
  const def = importTypeMap.get(type);
  const section = importSections[type];
  if (!def || !section || !can(bos, "imports.create") || !can(bos, def.perm)) return null;
  let q = db().from("import_jobs").select("id, number, file_name, status, created_count, updated_count, failed_count, created_at").eq("data_type", type).order("created_at", { ascending: false }).limit(5);
  if (!can(bos, "imports.manage")) q = q.eq("created_by", bos.userId);
  const { data: recent } = await q;
  return (
    <ImportDialog type={type} label={def.label} after={section.after} recent={(recent ?? []).map((r) => ({ ...r, when: formatDateTime(r.created_at) }))} />
  );
}
