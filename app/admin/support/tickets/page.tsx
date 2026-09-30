import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { listTickets } from "@/services/bos/support";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, StatusBadge, EmptyState } from "@/components/bos/ui";
import { DataTable } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusOptions, statusDef } from "@/lib/bos/labels";

const statusLabel = (s: string) => statusDef("ticket_status", s)?.label ?? s;
import { SlaIndicator } from "../SlaIndicator";
import { ticketCategories, priorities } from "../SupportControls";
import { bulkAssignTicketsAction } from "../actions";

export default async function TicketsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("tickets.read");
  const sp = await readParams(searchParams);
  const params = { ...sp, status: sp.status ?? "open_all" };
  const statuses = ["open", "in_progress", "waiting_for_client", "resolved", "closed"] as const;
  const [result, staff, names, ...counts] = await Promise.all([
    listTickets(bos, scope, { ...params, page: pageOf(sp) }), listActiveStaff(), userNameMap(),
    // Status summary within the viewer's scope (same query as the list).
    ...statuses.map((st) => listTickets(bos, scope, { status: st, page: 1 }).then((r) => r.total)),
  ]);
  const qsFor = (status: string) => { const p = new URLSearchParams(Object.entries({ ...sp, status }).filter(([, v]) => v) as [string, string][]); p.delete("page"); return `/admin/support/tickets?${p}`; };
  const catLabel = new Map(ticketCategories.map((c) => [c.value, c.label]));
  return (
    <>
      <PageHeader title="تذاكر الدعم" subtitle={<Tx vars={{ total: result.total }}>{"{total} تذكرة"}</Tx>} actions={can(bos, "tickets.create") ? <Link className="admin-btn small" href="/admin/support/tickets/new"><Tx>+ تذكرة</Tx></Link> : null} />
      <nav className="bos-chips" aria-label="ticket status">
        <Link href={qsFor("open_all")} className={params.status === "open_all" ? "on" : undefined}><Tx>كل المفتوحة</Tx> {counts.slice(0, 3).reduce((a, b) => a + b, 0)}</Link>
        {statuses.map((st, i) => <Link key={st} href={qsFor(st)} className={params.status === st ? "on" : undefined}><Tx>{statusLabel(st)}</Tx> {counts[i]}</Link>)}
      </nav>
      <FilterBar
        searchPlaceholder="رقم أو موضوع التذكرة..."
        filters={[
          { key: "status", label: "الحالة", type: "select", options: [{ value: "open_all", label: "كل المفتوحة" }, ...statusOptions("ticket_status")] },
          { key: "priority", label: "الأولوية", type: "select", options: priorities },
          { key: "category", label: "التصنيف", type: "select", options: ticketCategories },
          { key: "assigned", label: "المسؤول", type: "select", options: [{ value: "me", label: "أنا" }, { value: "none", label: "غير معيّن" }, ...staff.map((s) => ({ value: s.userId, label: s.name }))] },
          { key: "sla", label: "SLA", type: "select", options: [{ value: "breached", label: "متجاوز" }, { value: "at_risk", label: "معرض للخطر (4 س)" }] },
        ]}
      />
      <DataTable
        tableId="tickets"
        columns={[
          { key: "subject", label: "التذكرة", primary: true, alwaysVisible: true },
          { key: "client", label: "العميل" },
          { key: "project", label: "المشروع", defaultHidden: true },
          { key: "category", label: "التصنيف", defaultHidden: true },
          { key: "priority", label: "الأولوية" },
          { key: "assignee", label: "المسؤول" },
          { key: "status", label: "الحالة" },
          { key: "sla", label: "SLA" },
          { key: "conversation", label: "المحادثة", defaultHidden: true },
          { key: "created", label: "أُنشئت" },
          { key: "updated", label: "آخر تحديث", defaultHidden: true },
        ]}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        exportHref={can(bos, "tickets.export") ? "/api/bos/export/tickets" : undefined}
        bulkActions={can(bos, "tickets.assign") ? [{ key: "assign", label: "تعيين", action: bulkAssignTicketsAction, optionLabel: "المسؤول", options: [{ value: "none", label: "— غير معيّن —" }, ...staff.map((s) => ({ value: s.userId, label: s.name }))] }] : undefined}
        empty={<EmptyState title="لا توجد تذاكر" />}
        rows={result.rows.map((t) => {
          const c = t.clients as unknown as { id: string; name: string; company_name: string | null } | null;
          const ct = t.contacts as unknown as { full_name: string } | null;
          const p = t.projects as unknown as { id: string; name: string } | null;
          return {
            id: t.id,
            cells: {
              subject: <Link href={`/admin/support/tickets/${t.id}`}><Tx>{t.subject}</Tx><span className="cell-sub">{t.ticket_number}{t.source === "portal" ? " · من البوابة" : ""}</span></Link>,
              client: c ? <Link href={`/admin/clients/${c.id}?tab=tickets`}>{c.company_name ?? c.name}{ct ? <span className="cell-sub">{ct.full_name}</span> : null}</Link> : "—",
              project: p ? <Link href={`/admin/projects/${p.id}`}>{p.name}</Link> : "—",
              category: catLabel.get(t.category) ?? t.category,
              priority: <StatusBadge map="priority" value={t.priority} />,
              assignee: t.assigned_to ? names.get(t.assigned_to) ?? "—" : <span className="bos-faint"><Tx>غير معيّن</Tx></span>,
              status: <StatusBadge map="ticket_status" value={t.status} />,
              sla: <SlaIndicator t={t} compact />,
              conversation: t.conversation_id ? <Link className="bos-link" href={`/admin/support/inbox?c=${t.conversation_id}`}><Tx>فتح المحادثة</Tx></Link> : "—",
              created: formatDate(t.created_at),
              updated: formatDate(t.updated_at),
            },
          };
        })}
      />
    </>
  );
}
