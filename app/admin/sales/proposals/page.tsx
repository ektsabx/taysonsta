import { Tx } from "@/components/bos/I18n";
import { nowIso } from "@/lib/bos/clock";
import Link from "next/link";
import { requirePermission, can, getTeamUserIds } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, StatusBadge, EmptyState, Money } from "@/components/bos/ui";
import { DataTable, type DataColumn } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";

const columns: DataColumn[] = [
  { key: "title", label: "المقترح", primary: true, alwaysVisible: true },
  { key: "client", label: "الحساب" },
  { key: "deal", label: "الصفقة" },
  { key: "total", label: "الإجمالي" },
  { key: "status", label: "الحالة" },
  { key: "sent", label: "أُرسل" },
  { key: "views", label: "المشاهدات" },
  { key: "valid", label: "صالح حتى" },
  { key: "owner", label: "المسؤول" },
];

export default async function ProposalsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("proposals.read");
  const params = await readParams(searchParams);
  const page = pageOf(params);
  const pageSize = 25;

  let query = db()
    .from("proposals")
    .select("id, title, status, total_amount, currency, sent_at, view_count, valid_until, owner_id, created_by, is_archived, deal_id, clients(id, name, company_name), deals(name, deal_number)", { count: "exact" })
    .eq("is_archived", params.archived === "1");
  if (scope !== "all") {
    const users = scope === "team" ? await getTeamUserIds(bos) : [bos.userId];
    query = query.or(`owner_id.in.(${users.join(",")}),created_by.in.(${users.join(",")})`);
  }
  if (params.status) query = query.eq("status", params.status as "draft");
  if (params.q) query = query.ilike("title", `%${params.q.replace(/[%_]/g, " ")}%`);
  const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  const names = await userNameMap();

  return (
    <>
      <PageHeader
        title="المقترحات"
       
        actions={can(bos, "proposals.create") ? <Link href="/admin/sales/proposals/new" className="admin-btn small"><Tx>+ مقترح</Tx></Link> : null}
      />
      <FilterBar
        searchPlaceholder="بحث بالعنوان..."
        filters={[
          { key: "status", label: "الحالة", type: "select", options: statusOptions("proposal_status") },
          { key: "archived", label: "المؤرشفة", type: "select", options: [{ value: "1", label: "عرض المؤرشفة" }] },
        ]}
      />
      <DataTable
        tableId="proposals"
        columns={columns}
        total={count ?? 0}
        page={page}
        pageSize={pageSize}
        empty={<EmptyState title="لا توجد مقترحات" description="أنشئ المقترح من صفحة الصفقة ليُملأ تلقائياً بالعميل والأسعار وشروط الدفع." actions={can(bos, "proposals.create") ? <Link href="/admin/sales/proposals/new" className="admin-btn small"><Tx>مقترح جديد</Tx></Link> : null} />}
        rows={(data ?? []).map((p) => {
          const client = p.clients as unknown as { id: string; name: string; company_name: string | null } | null;
          const deal = p.deals as unknown as { name: string; deal_number: string } | null;
          const expired = p.valid_until && p.valid_until < nowIso().slice(0, 10) && ["published", "viewed"].includes(p.status);
          return {
            id: p.id,
            cells: {
              title: <Link href={`/admin/sales/proposals/${p.id}`}><Tx>{p.title}</Tx></Link>,
              client: client ? <Link href={`/admin/clients/${client.id}`}>{client.company_name ?? client.name}</Link> : "—",
              deal: deal ? <Link href={`/admin/sales/deals/${p.deal_id}`}>{deal.deal_number}</Link> : "—",
              total: p.total_amount ? <Money value={p.total_amount} currency={p.currency} /> : "—",
              status: <StatusBadge map="proposal_status" value={p.status} />,
              sent: formatDate(p.sent_at),
              views: p.view_count,
              valid: <span style={expired ? { color: "var(--bos-danger)" } : undefined}>{formatDate(p.valid_until)}</span>,
              owner: p.owner_id ? names.get(p.owner_id) ?? "—" : "—",
            },
          };
        })}
      />
    </>
  );
}
