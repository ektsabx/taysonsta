import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listCommunications } from "@/services/bos/communications";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, Card } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { ActivityComposer } from "@/components/bos/ActivityComposer";
import { CommunicationList, communicationKindLabels } from "./CommunicationList";

export default async function CommunicationsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("communications.read");
  const params = await readParams(searchParams);
  const page = pageOf(params);
  const [result, names, staff] = await Promise.all([listCommunications(bos, scope, { ...params, page }), userNameMap(), listActiveStaff()]);

  const clientIds = [...new Set(result.rows.map((r) => r.clientId).filter(Boolean))] as string[];
  const contactIds = [...new Set(result.rows.map((r) => r.contactId).filter(Boolean))] as string[];
  const [{ data: clients }, { data: contacts }, filterClient] = await Promise.all([
    clientIds.length ? db().from("clients").select("id, name, company_name").in("id", clientIds) : Promise.resolve({ data: [] as { id: string; name: string; company_name: string | null }[] }),
    contactIds.length ? db().from("contacts").select("id, full_name").in("id", contactIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    params.client ? db().from("clients").select("id, name, company_name").eq("id", params.client).maybeSingle().then((r) => r.data) : Promise.resolve(null),
  ]);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(params).filter(([k, v]) => k !== "page" && typeof v === "string") as [string, string][]);
    q.set("page", String(p));
    return `/admin/communications?${q.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="سجل التواصل"
        subtitle={filterClient ? `الحساب: ${filterClient.company_name ?? filterClient.name}` : "المكالمات والرسائل والبريد والاجتماعات في مكان واحد"}
        breadcrumbs={[{ label: "العملاء" }, { label: "سجل التواصل" }]}
        actions={can(bos, "activities.create") && params.client ? <ActivityComposer related={{ client_id: params.client }} staff={staff.map((s) => ({ value: s.userId, label: s.name }))} label="+ تسجيل تواصل" defaultType="client_communication" /> : null}
      />
      <FilterBar
        searchPlaceholder="بحث في العنوان والمحتوى..."
        filters={[
          { key: "kind", label: "النوع", type: "select", options: Object.entries(communicationKindLabels).map(([value, label]) => ({ value, label })) },
          { key: "direction", label: "الاتجاه", type: "select", options: [{ value: "inbound", label: "وارد" }, { value: "outbound", label: "صادر" }, { value: "internal", label: "داخلي" }] },
          { key: "from", label: "من", type: "date" },
          { key: "to", label: "إلى", type: "date" },
        ]}
      />
      {params.client || params.contact || params.deal || params.lead || params.project ? (
        <div className="bos-faint" style={{ fontSize: 12.5, marginBottom: 8 }}>
          <Tx>مفلتر حسب سجل مرتبط.</Tx> <Link className="bos-link" href="/admin/communications"><Tx>إزالة الفلتر</Tx></Link>
        </div>
      ) : null}
      <Card>
        <CommunicationList
          items={result.rows}
          names={Object.fromEntries(names)}
          labels={{
            clients: Object.fromEntries((clients ?? []).map((c) => [c.id, c.company_name ?? c.name])),
            contacts: Object.fromEntries((contacts ?? []).map((c) => [c.id, c.full_name])),
          }}
        />
        {pages > 1 ? (
          <div className="bos-row" style={{ justifyContent: "center", gap: 8, marginTop: 12 }}>
            {page > 1 ? <Link className="admin-btn small secondary" href={href(page - 1)}><Tx>السابق</Tx></Link> : null}
            <span className="bos-faint" style={{ fontSize: 13 }}><Tx vars={{ page, pages }}>{"صفحة {page} من {pages}"}</Tx></span>
            {page < pages ? <Link className="admin-btn small secondary" href={href(page + 1)}><Tx>التالي</Tx></Link> : null}
          </div>
        ) : null}
        {result.truncated ? <div className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>يتم عرض أحدث السجلات فقط؛ استخدم الفلاتر لتضييق النتائج.</Tx></div> : null}
      </Card>
    </>
  );
}
