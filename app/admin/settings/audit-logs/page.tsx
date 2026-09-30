import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { userNameMap } from "@/services/bos/shared";
import { entityHref } from "@/lib/bos/links";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDateTime } from "@/lib/bos/format";

// Immutable audit log viewer (§60, docs/bos/23).
export default async function AuditLogsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("audit.read");
  const sp = await readParams(searchParams);
  const page = pageOf(sp);
  let q = db().from("audit_logs").select("*", { count: "exact" });
  if (sp.action) q = q.ilike("action", `%${sp.action.replace(/[%_]/g, " ")}%`);
  if (sp.entity_type) q = q.eq("entity_type", sp.entity_type);
  if (sp.actor) q = q.eq("actor_user_id", sp.actor);
  if (sp.actor_type) q = q.eq("actor_type", sp.actor_type);
  if (sp.entity_id && /^[0-9a-f-]{36}$/.test(sp.entity_id)) q = q.eq("entity_id", sp.entity_id);
  if (sp.from) q = q.gte("created_at", `${sp.from}T00:00:00Z`);
  if (sp.to) q = q.lte("created_at", `${sp.to}T23:59:59Z`);
  const [{ data, count }, names] = await Promise.all([q.order("created_at", { ascending: false }).range((page - 1) * 50, page * 50 - 1), userNameMap()]);
  const pages = Math.max(1, Math.ceil((count ?? 0) / 50));
  const qs = (p: number) => `/admin/settings/audit-logs?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]), page: String(p) })}`;
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => typeof v === "string" && k !== "page") as [string, string][]).toString();
  return (
    <>
      <PageHeader title="سجل التدقيق" subtitle={<Tx vars={{ count: count ?? 0 }}>{"{count} سجل — غير قابل للتعديل أو الحذف"}</Tx>} actions={can(bos, "audit.export") ? <a className="admin-btn small secondary" href={`/api/bos/export/audit?${exportQs}`}><Tx>تصدير CSV</Tx></a> : null} />
      <FilterBar filters={[
        { key: "action", label: "الإجراء", type: "text" }, { key: "entity_type", label: "نوع السجل", type: "text" },
        { key: "actor", label: "المستخدم", type: "select", options: [...names.entries()].map(([value, label]) => ({ value, label })) },
        { key: "actor_type", label: "الفاعل", type: "select", options: [{ value: "user", label: "مستخدم" }, { value: "system", label: "النظام" }, { value: "client", label: "عميل" }, { value: "automation", label: "أتمتة" }] },
        { key: "from", label: "من", type: "date" }, { key: "to", label: "إلى", type: "date" },
      ]} />
      <Card flush>
        {(data ?? []).length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>الفاعل</Tx></th><th><Tx>الإجراء</Tx></th><th><Tx>السجل</Tx></th><th><Tx>القيمة القديمة → الجديدة</Tx></th><th><Tx>السبب</Tx></th><th>IP</th></tr></thead>
              <tbody>
                {(data ?? []).map((a) => {
                  const href = a.entity_id ? entityHref(a.entity_type, a.entity_id) : null;
                  return (
                    <tr key={a.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(a.created_at)}</td>
                      <td>{a.actor_user_id ? names.get(a.actor_user_id) ?? "—" : a.actor_type}</td>
                      <td dir="ltr" style={{ fontSize: 12 }}><Tx>{a.action}</Tx></td>
                      <td style={{ fontSize: 12 }}>{href ? <Link className="bos-link" href={href}><Tx>{a.entity_type}</Tx></Link> : a.entity_type}{a.entity_id ? <Link className="cell-sub" href={`/admin/settings/audit-logs?entity_id=${a.entity_id}`}><Tx>كل سجل هذا الكيان</Tx></Link> : null}</td>
                      <td style={{ maxWidth: 380 }}>
                        <details><summary className="bos-faint" style={{ fontSize: 12 }}><Tx>التفاصيل</Tx></summary><pre dir="ltr" style={{ fontSize: 11, whiteSpace: "pre-wrap", maxHeight: 240, overflow: "auto" }}>{JSON.stringify({ old: a.old_value, new: a.new_value, meta: a.metadata }, null, 2)}</pre></details>
                      </td>
                      <td>{a.reason ?? "—"}</td>
                      <td dir="ltr" style={{ fontSize: 11 }}>{a.ip ? String(a.ip) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد سجلات" />}
        {pages > 1 ? <div className="bos-row" style={{ justifyContent: "center", gap: 8, padding: 10 }}>{page > 1 ? <Link className="admin-btn small secondary" href={qs(page - 1)}><Tx>السابق</Tx></Link> : null}<span className="bos-faint">{page}/{pages}</span>{page < pages ? <Link className="admin-btn small secondary" href={qs(page + 1)}><Tx>التالي</Tx></Link> : null}</div> : null}
      </Card>
    </>
  );
}
