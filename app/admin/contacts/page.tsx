import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { listContacts } from "@/services/bos/contacts";
import { PageHeader, EmptyState, StatusBadge } from "@/components/bos/ui";
import { DataTable } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { ContactModalButton } from "./ContactForm";

export default async function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("contacts.read");
  const params = await readParams(searchParams);
  const result = await listContacts(bos, scope, { ...params, page: pageOf(params) });
  return (
    <>
      <PageHeader
        title="جهات الاتصال"
        subtitle={<Tx vars={{ total: result.total }}>{"{total} جهة اتصال"}</Tx>}
       
        actions={can(bos, "contacts.create") ? <ContactModalButton label="+ جهة اتصال" className="admin-btn small" /> : null}
      />
      <FilterBar
        searchPlaceholder="بحث بالاسم أو البريد أو الهاتف أو المنصب..."
        filters={[
          { key: "decision", label: "صاحب قرار", type: "select", options: [{ value: "1", label: "نعم" }] },
          { key: "archived", label: "المؤرشفة", type: "select", options: [{ value: "1", label: "عرض المؤرشفة" }] },
        ]}
      />
      <DataTable
        tableId="contacts"
        columns={[
          { key: "name", label: "الاسم", primary: true, alwaysVisible: true },
          { key: "position", label: "المنصب" },
          { key: "account", label: "الحساب" },
          { key: "email", label: "البريد" },
          { key: "phone", label: "الهاتف" },
          { key: "whatsapp", label: "واتساب", defaultHidden: true },
          { key: "decision", label: "صاحب قرار" },
          { key: "last", label: "آخر نشاط" },
        ]}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        exportHref={can(bos, "contacts.export") ? "/api/bos/export/contacts" : undefined}
        empty={<EmptyState title="لا توجد جهات اتصال" />}
        rows={result.rows.map((c) => {
          const a = c.clients as unknown as { id: string; name: string; company_name: string | null } | null;
          return {
            id: c.id,
            cells: {
              name: <Link href={`/admin/contacts/${c.id}`}>{c.full_name}{c.archived_at ? <span className="cell-sub"><Tx>مؤرشفة</Tx></span> : null}</Link>,
              position: c.position ?? "—",
              account: a ? <Link href={`/admin/clients/${a.id}`}>{a.company_name ?? a.name}</Link> : <span className="bos-faint"><Tx>بدون حساب</Tx></span>,
              email: c.email ? <span dir="ltr">{c.email}</span> : "—",
              phone: c.phone ? <span dir="ltr">{c.phone}</span> : "—",
              whatsapp: c.whatsapp ? <span dir="ltr"><Tx>{c.whatsapp}</Tx></span> : "—",
              decision: c.is_decision_maker ? <StatusBadge tone="info" label="نعم" /> : "—",
              last: formatDate(c.lastActivityAt),
            },
          };
        })}
      />
    </>
  );
}
