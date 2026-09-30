import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { db } from "@/lib/bos/db";
import { userNameMap } from "@/services/bos/shared";
import { formatDateTime } from "@/lib/bos/format";

function summarize(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value !== "object") return String(value);
  return Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "—")}`)
    .join(" · ");
}

// Audit log component (§98): immutable history for one entity.
export async function AuditLogPanel({ entityType, entityId, limit = 50 }: { entityType: string; entityId: string; limit?: number }) {
  const { data } = await db()
    .from("audit_logs")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const names = await userNameMap();
  if (!data?.length) return <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لا توجد سجلات تدقيق.</Tx></div>;
  return (
    <div className="bos-table-scroll">
      <BosTable className="bos-table responsive">
        <thead>
          <tr>
            <th><Tx>الوقت</Tx></th>
            <th><Tx>المستخدم</Tx></th>
            <th><Tx>الإجراء</Tx></th>
            <th><Tx>القيمة السابقة</Tx></th>
            <th><Tx>القيمة الجديدة</Tx></th>
            <th><Tx>السبب</Tx></th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id}>
              <td data-label="الوقت">{formatDateTime(row.created_at)}</td>
              <td data-label="المستخدم">{row.actor_user_id ? names.get(row.actor_user_id) ?? "—" : row.actor_type}</td>
              <td data-label="الإجراء"><Tx>{row.action}</Tx></td>
              <td data-label="السابقة" className="bos-faint" style={{ fontSize: 12, maxWidth: 260 }}>{summarize(row.old_value)}</td>
              <td data-label="الجديدة" style={{ fontSize: 12, maxWidth: 260 }}>{summarize(row.new_value)}</td>
              <td data-label="السبب">{row.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </BosTable>
    </div>
  );
}
