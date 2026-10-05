import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { PageHeader, Card, StatusBadge, Money, EmptyState } from "@/components/bos/ui";
import { FileManager } from "@/components/bos/FileManager";
import { formatDate } from "@/lib/bos/format";
import { VendorForm } from "../VendorForm";

// Vendor profile (§54): contacts, services, contracts (files),
// costs/invoices (expenses) and payments.
export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("vendors.read");
  const { id } = await params;
  const { data: v } = await db().from("vendors").select("*").eq("id", id).maybeSingle();
  if (!v) notFound();
  const { data: expenses } = await db().from("expenses").select("id, description, amount, currency, expense_date, approval_status").eq("vendor_id", id).order("expense_date", { ascending: false });
  return (
    <>
      <PageHeader title={v.name} subtitle={v.type} />
      <div className="bos-grid main-side">
        <div>
          <Card title="التكاليف والفواتير">
            {expenses?.length ? (
              <BosTable className="bos-table responsive">
                <thead><tr><th><Tx>البند</Tx></th><th><Tx>التاريخ</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="cell-primary cell-primary-mobile" data-label="البند"><Link href={`/admin/finance/expenses/${e.id}`}><Tx>{e.description}</Tx></Link></td>
                      <td data-label="التاريخ">{formatDate(e.expense_date)}</td>
                      <td data-label="المبلغ"><Money value={e.amount} currency={e.currency} /></td>
                      <td data-label="الحالة"><StatusBadge map="simple_approval" value={e.approval_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </BosTable>
            ) : (
              <EmptyState title="لا توجد تكاليف مسجلة لهذا المورد" />
            )}
          </Card>
          <Card title="العقود والمستندات">
            <FileManager entityType="vendor" entityId={id} canUpload={can(bos, "vendors.update")} />
          </Card>
        </div>
        <Card title="بيانات المورد">{can(bos, "vendors.update") ? <VendorForm vendorId={id} initial={v} /> : <div className="bos-prose">{[v.contact_name, v.email, v.phone, v.services].filter(Boolean).join("\n")}</div>}</Card>
      </div>
    </>
  );
}
