import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { listBugs } from "@/services/bos/support";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, StatusBadge, EmptyState, Tabs, Card } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { KanbanBoard } from "@/components/bos/KanbanBoard";
import { formatDate } from "@/lib/bos/format";
import { bugStatusAction } from "../actions";

const columns = [
  { key: "reported", title: "مُبلّغ" },
  { key: "triaged", title: "تم الفرز" },
  { key: "in_progress", title: "قيد العمل" },
  { key: "ready_for_qa", title: "جاهز للاختبار" },
  { key: "qa", title: "قيد الاختبار" },
  { key: "fixed", title: "تم الإصلاح" },
  { key: "closed", title: "مغلق" },
];

export default async function BugsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("bugs.read");
  const sp = await readParams(searchParams);
  const view = sp.view ?? "board";
  const [bugs, staff, names] = await Promise.all([listBugs(bos, scope, sp), listActiveStaff(), userNameMap()]);
  const sevTone: Record<string, "danger" | "warning" | "info" | "neutral"> = { critical: "danger", major: "warning", minor: "info", trivial: "neutral" };
  const sevLabel: Record<string, string> = { critical: "حرجة", major: "كبيرة", minor: "صغيرة", trivial: "بسيطة" };
  return (
    <>
      <PageHeader title="الأخطاء البرمجية" subtitle={<Tx vars={{ bugs_count: bugs.length }}>{"{bugs_count} خطأ"}</Tx>} actions={can(bos, "bugs.create") ? <Link className="admin-btn small" href="/admin/support/bugs/new"><Tx>+ خطأ</Tx></Link> : null} />
      <Tabs param="view" active={view} baseHref="/admin/support/bugs" tabs={[{ key: "board", label: "لوحة" }, { key: "list", label: "قائمة" }]} />
      <FilterBar
        searchPlaceholder="رقم أو عنوان..."
        filters={[
          { key: "severity", label: "الخطورة", type: "select", options: Object.entries(sevLabel).map(([value, label]) => ({ value, label })) },
          { key: "assigned", label: "المطوّر", type: "select", options: [{ value: "me", label: "أنا" }, ...staff.map((s) => ({ value: s.userId, label: s.name }))] },
          { key: "qa", label: "QA", type: "select", options: [{ value: "not_tested", label: "لم يُختبر" }, { value: "passed", label: "نجح" }, { value: "failed", label: "فشل" }] },
        ]}
      />
      {view === "board" ? (
        can(bos, "bugs.update") ? (
          <KanbanBoard
            columns={columns.map((c) => ({ ...c, meta: <span className="bos-faint">{bugs.filter((b) => b.status === c.key).length}</span> }))}
            onMove={bugStatusAction}
            cards={bugs.map((b) => ({
              id: b.id,
              column: b.status,
              content: (
                <div>
                  <Link href={`/admin/support/bugs/${b.id}`} style={{ fontWeight: 600 }}><Tx>{b.title}</Tx></Link>
                  <div className="bos-faint" style={{ fontSize: 11.5 }}>{b.bug_number} · {(b.projects as unknown as { name: string } | null)?.name ?? ""}</div>
                  <div className="bos-row" style={{ gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                    <StatusBadge tone={sevTone[b.severity]} label={sevLabel[b.severity]} />
                    {b.environment === "production" ? <StatusBadge tone="neutral" label="Prod" /> : null}
                    {b.assigned_to ? <span className="bos-faint" style={{ fontSize: 11 }}>{names.get(b.assigned_to)}</span> : null}
                  </div>
                </div>
              ),
            }))}
          />
        ) : <EmptyState title="العرض كلوحة يتطلب صلاحية التعديل" />
      ) : (
        <Card flush>
          {bugs.length ? (
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>الخطأ</Tx></th><th><Tx>المشروع</Tx></th><th><Tx>الخطورة</Tx></th><th><Tx>البيئة</Tx></th><th><Tx>المطوّر</Tx></th><th><Tx>الحالة</Tx></th><th>QA</th><th><Tx>التاريخ</Tx></th></tr></thead>
              <tbody>
                {bugs.map((b) => (
                  <tr key={b.id}>
                    <td className="cell-primary"><Link href={`/admin/support/bugs/${b.id}`}><Tx>{b.title}</Tx></Link><span className="cell-sub">{b.bug_number}</span></td>
                    <td>{(b.projects as unknown as { id: string; name: string } | null)?.name ?? "—"}</td>
                    <td><StatusBadge tone={sevTone[b.severity]} label={sevLabel[b.severity]} /></td>
                    <td><Tx>{b.environment}</Tx></td>
                    <td>{b.assigned_to ? names.get(b.assigned_to) ?? "—" : "—"}</td>
                    <td><StatusBadge map="bug_status" value={b.status} /></td>
                    <td>{b.qa_status === "passed" ? "✓" : b.qa_status === "failed" ? "✗" : "—"}</td>
                    <td>{formatDate(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          ) : <EmptyState title="لا توجد أخطاء" />}
        </Card>
      )}
    </>
  );
}
