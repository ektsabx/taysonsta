import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can, getTeamUserIds } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { PageHeader, StatusBadge, EmptyState, Money } from "@/components/bos/ui";
import { DataTable, type DataColumn } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";

const columns: DataColumn[] = [
  { key: "number", label: "العقد", primary: true, alwaysVisible: true },
  { key: "client", label: "الحساب" },
  { key: "deal", label: "الصفقة" },
  { key: "value", label: "القيمة" },
  { key: "status", label: "الحالة" },
  { key: "start", label: "البداية" },
  { key: "end", label: "النهاية" },
  { key: "version", label: "الإصدار" },
];

export default async function ContractsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("contracts.read");
  const params = await readParams(searchParams);
  const page = pageOf(params);
  const pageSize = 25;
  let query = db()
    .from("contracts")
    .select("id, contract_number, title, status, value, currency, start_date, end_date, document_version, deal_id, created_by, clients(id, name, company_name), deals(deal_number, assigned_to)", { count: "exact" })
    .is("archived_at", null);
  if (scope !== "all") {
    const users = scope === "team" ? await getTeamUserIds(bos) : [bos.userId];
    const { data: deals } = await db().from("deals").select("id").in("assigned_to", users);
    const dealIds = (deals ?? []).map((d) => d.id);
    query = dealIds.length ? query.or(`created_by.in.(${users.join(",")}),deal_id.in.(${dealIds.join(",")})`) : query.in("created_by", users);
  }
  if (params.status) query = query.eq("status", params.status as "draft");
  if (params.q) query = query.or(`contract_number.ilike.%${params.q.replace(/[%_,()]/g, " ")}%,title.ilike.%${params.q.replace(/[%_,()]/g, " ")}%`);
  const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;

  return (
    <>
      <PageHeader title="العقود" actions={can(bos, "contracts.create") ? <Link href="/admin/sales/contracts/new" className="admin-btn small"><Tx>+ عقد</Tx></Link> : null} />
      <FilterBar searchPlaceholder="بحث برقم أو عنوان العقد..." filters={[{ key: "status", label: "الحالة", type: "select", options: statusOptions("contract_status") }]} />
      <DataTable
        tableId="contracts"
        columns={columns}
        total={count ?? 0}
        page={page}
        pageSize={pageSize}
        empty={<EmptyState title="لا توجد عقود" description="أنشئ العقد من الصفقة أو من المقترح المقبول." />}
        rows={(data ?? []).map((c) => {
          const client = c.clients as unknown as { id: string; name: string; company_name: string | null } | null;
          const deal = c.deals as unknown as { deal_number: string } | null;
          return {
            id: c.id,
            cells: {
              number: (
                <Link href={`/admin/sales/contracts/${c.id}`}>
                  {c.contract_number}
                  <span className="cell-sub"><Tx>{c.title}</Tx></span>
                </Link>
              ),
              client: client ? <Link href={`/admin/clients/${client.id}`}>{client.company_name ?? client.name}</Link> : "—",
              deal: deal ? <Link href={`/admin/sales/deals/${c.deal_id}`}>{deal.deal_number}</Link> : "—",
              value: <Money value={c.value} currency={c.currency} />,
              status: <StatusBadge map="contract_status" value={c.status} />,
              start: formatDate(c.start_date),
              end: formatDate(c.end_date),
              version: `v${c.document_version}`,
            },
          };
        })}
      />
    </>
  );
}
