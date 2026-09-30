import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { listMeetings } from "@/services/bos/meetings";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, StatusBadge, EmptyState, Tabs } from "@/components/bos/ui";
import { DataTable, type DataColumn } from "@/components/bos/DataTable";
import { formatDateTime } from "@/lib/bos/format";

const columns: DataColumn[] = [
  { key: "title", label: "الاجتماع", primary: true, alwaysVisible: true },
  { key: "when", label: "الموعد" },
  { key: "related", label: "مرتبط بـ" },
  { key: "organizer", label: "المنظم" },
  { key: "status", label: "الحالة" },
  { key: "link", label: "", align: "end" },
];

export default async function MeetingsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("meetings.read");
  const params = await readParams(searchParams);
  const view = params.view ?? "upcoming";
  const [result, names] = await Promise.all([listMeetings(bos, scope, { view, q: params.q, page: pageOf(params) }), userNameMap()]);

  return (
    <>
      <PageHeader
        title="الاجتماعات"
       
        actions={can(bos, "meetings.create") ? <Link href="/admin/communication/meetings/new" className="admin-btn small"><Tx>+ اجتماع</Tx></Link> : null}
      />
      <Tabs
        param="view"
        active={view}
        baseHref="/admin/communication/meetings"
        tabs={[
          { key: "upcoming", label: "القادمة" },
          { key: "needs_outcome", label: "تحتاج نتيجة" },
          { key: "past", label: "السابقة" },
          { key: "all", label: "الكل" },
        ]}
      />
      <DataTable
        tableId="meetings"
        columns={columns}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        empty={<EmptyState title="لا توجد اجتماعات" actions={can(bos, "meetings.create") ? <Link href="/admin/communication/meetings/new" className="admin-btn small"><Tx>جدولة اجتماع</Tx></Link> : null} />}
        rows={result.rows.map((m) => {
          const client = m.clients as unknown as { name: string } | null;
          const lead = m.leads as unknown as { name: string } | null;
          const deal = m.deals as unknown as { name: string } | null;
          const project = m.projects as unknown as { name: string } | null;
          return {
            id: m.id,
            cells: {
              title: <Link href={`/admin/communication/meetings/${m.id}`}><Tx>{m.title}</Tx></Link>,
              when: `${formatDateTime(m.start_at)} · ${m.duration_minutes}د`,
              related: deal?.name ?? lead?.name ?? project?.name ?? client?.name ?? "—",
              organizer: m.organizer_id ? names.get(m.organizer_id) ?? "—" : "—",
              status: <StatusBadge map="meeting_status" value={m.status} />,
              link: m.meeting_link && m.status === "scheduled" ? <a className="admin-btn small ghost" href={m.meeting_link} target="_blank" rel="noreferrer"><Tx>انضمام</Tx></a> : null,
            },
          };
        })}
      />
    </>
  );
}
