import { ImportButton } from "@/components/bos/ImportButton";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { PageHeader, EmptyState } from "@/components/bos/ui";
import { DataTable, type DataColumn } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { VendorForm } from "./VendorForm";
import { ModalButtonVendor } from "./ModalButtonVendor";
import { ExportLink } from "@/components/bos/ExportLink";

const columns: DataColumn[] = [
  { key: "name", label: "المورد", primary: true, alwaysVisible: true },
  { key: "type", label: "النوع" },
  { key: "contact", label: "جهة الاتصال" },
  { key: "services", label: "الخدمات" },
  { key: "spend", label: "إجمالي المصروفات", align: "end" },
];

export default async function VendorsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("vendors.read");
  const params = await readParams(searchParams);
  let q = db().from("vendors").select("*").is("archived_at", null).order("name");
  if (params.q) q = q.ilike("name", `%${params.q.replace(/[%_]/g, " ")}%`);
  const [{ data: vendors }, { data: expenses }] = await Promise.all([q, db().from("expenses").select("vendor_id, amount, currency").eq("approval_status", "approved").not("vendor_id", "is", null)]);
  const spend = new Map<string, Map<string, number>>();
  for (const e of expenses ?? []) {
    const m = spend.get(e.vendor_id!) ?? new Map<string, number>();
    m.set(e.currency, (m.get(e.currency) ?? 0) + Number(e.amount));
    spend.set(e.vendor_id!, m);
  }
  return (
    <>
      <PageHeader title="الموردون" actions={<span className="bos-row" style={{ gap: 6 }}>{can(bos, "vendors.export") ? <ExportLink href="/api/bos/export/vendors"><Tx>تصدير CSV</Tx></ExportLink> : null}<ImportButton bos={bos} type="vendors" />{can(bos, "vendors.create") ? <ModalButtonVendor><VendorForm vendorId={null} /></ModalButtonVendor> : null}</span>} />
      <FilterBar searchPlaceholder="اسم المورد..." />
      <DataTable
        tableId="vendors"
        columns={columns}
        total={vendors?.length ?? 0}
        page={1}
        pageSize={1000}
        empty={<EmptyState title="لا يوجد موردون" />}
        rows={(vendors ?? []).map((v) => ({
          id: v.id,
          cells: {
            name: <Link href={`/admin/finance/vendors/${v.id}`}>{v.name}</Link>,
            type: v.type ?? "—",
            contact: <span><Tx>{v.contact_name ?? "—"}</Tx><span className="cell-sub">{v.email ?? v.phone ?? ""}</span></span>,
            services: v.services ?? "—",
            spend: [...(spend.get(v.id)?.entries() ?? [])].map(([c, a]) => `${a.toLocaleString("en-US")} ${c}`).join(" · ") || "—",
          },
        }))}
      />
    </>
  );
}
