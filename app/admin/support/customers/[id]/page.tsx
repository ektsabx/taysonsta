import Link from "next/link";
import { notFound } from "next/navigation";
import { Tx } from "@/components/bos/I18n";
import { requirePermission, can } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { duplicateCandidates } from "@/services/bos/conversations";
import { listActiveStaff } from "@/services/bos/shared";
import { PageHeader, Card, StatusBadge, EmptyState, KeyValues } from "@/components/bos/ui";
import { SubNav } from "@/components/bos/SubNav";
import { formatDateTime } from "@/lib/bos/format";
import { supportNav } from "../../support-nav";
import { CustomerEditButton, CustomerLinkControls, MergeCustomerButton } from "./CustomerControls";

const channelLabels: Record<string, string> = { web_widget: "الموقع", email: "بريد", whatsapp: "واتساب", sms: "SMS", portal: "البوابة", phone: "مكالمة", manual: "أخرى" };

// Customer profile (docs/bos/30 §10.3): details, conversations, tickets,
// related deals when linked to an account, notes/tags, dedupe + merge.
export default async function SupportCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("conversations.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const c = db();
  const { data: cust } = await c.from("support_customers").select("*").eq("id", id).maybeSingle();
  if (!cust) notFound();
  const [{ data: convs }, { data: tickets }, deals, dups, staff, { data: contact }, { data: client }] = await Promise.all([
    c.from("conversations").select("id, number, subject, channel, status, last_message_at").eq("customer_id", id).order("last_message_at", { ascending: false }).limit(50),
    c.from("tickets").select("id, ticket_number, subject, status, created_at").or([`support_customer_id.eq.${id}`, cust.contact_id ? `contact_id.eq.${cust.contact_id}` : null].filter(Boolean).join(",")).order("created_at", { ascending: false }).limit(50),
    cust.client_id && can(bos, "deals.read") ? c.from("deals").select("id, deal_number, name, value, currency").eq("client_id", cust.client_id).is("archived_at", null).order("created_at", { ascending: false }).limit(10).then((r) => r.data ?? []) : Promise.resolve([]),
    duplicateCandidates(id),
    listActiveStaff(),
    cust.contact_id ? c.from("contacts").select("id, full_name").eq("id", cust.contact_id).maybeSingle() : Promise.resolve({ data: null }),
    cust.client_id ? c.from("clients").select("id, name, company_name").eq("id", cust.client_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const canEdit = can(bos, "conversations.update");
  return (
    <>
      <PageHeader title={cust.name} subtitle={cust.merged_into ? <Tx>مدموج في ملف آخر</Tx> : cust.company ?? undefined} breadcrumbs={[{ label: "الدعم" }, { label: "العملاء", href: "/admin/support/customers" }, { label: cust.name }]}
        actions={canEdit && !cust.merged_into ? <CustomerEditButton customer={{ id: cust.id, name: cust.name, email: cust.email, phone: cust.phone, whatsapp: cust.whatsapp, company: cust.company, country: cust.country, priority: cust.priority, tags: cust.tags.join(", "), notes: cust.notes, owner_id: cust.owner_id }} staff={staff.map((s) => ({ value: s.userId, label: s.name }))} /> : null} />
      <SubNav items={supportNav(bos)} active="customers" label="الدعم" />
      {cust.merged_into ? <div className="bos-form-error"><Link href={`/admin/support/customers/${cust.merged_into}`}><Tx>فتح الملف الذي دُمج فيه</Tx></Link></div> : null}
      <Card>
        <KeyValues items={[
          { label: "البريد", value: cust.email ? <span dir="ltr">{cust.email}</span> : null },
          { label: "الهاتف", value: cust.phone ? <span dir="ltr">{cust.phone}</span> : null },
          { label: "واتساب", value: cust.whatsapp ? <span dir="ltr">{cust.whatsapp}</span> : null },
          { label: "الدولة", value: cust.country },
          { label: "المصدر", value: cust.source },
          { label: "أول قناة", value: cust.first_channel ? channelLabels[cust.first_channel] ?? cust.first_channel : null },
          { label: "الأولوية", value: cust.priority },
          { label: "الوسوم", value: cust.tags.length ? cust.tags.map((t) => <span key={t} className="bos-tag">{t}</span>) : null },
          { label: "جهة الاتصال", value: contact ? <Link className="bos-link" href={`/admin/contacts/${contact.id}`}>{contact.full_name}</Link> : null },
          { label: "الحساب", value: client ? <Link className="bos-link" href={`/admin/clients/${client.id}`}>{client.company_name ?? client.name}</Link> : null },
          { label: "ملاحظات الدعم", value: cust.notes },
        ]} />
        {canEdit && !cust.merged_into ? <div style={{ marginTop: 10 }}><CustomerLinkControls id={cust.id} contactLabel={contact?.full_name ?? null} clientLabel={client ? client.company_name ?? client.name : null} /></div> : null}
      </Card>
      {dups.length && canEdit && !cust.merged_into ? (
        <Card title="ملفات محتملة التكرار">
          <table className="bos-table"><tbody>{dups.map((d) => <tr key={d.id}><td><Link href={`/admin/support/customers/${d.id}`}>{d.name}</Link><span className="cell-sub" dir="ltr">{[d.email, d.phone].filter(Boolean).join(" · ")}</span></td><td>{d.company ?? "—"}</td><td><MergeCustomerButton sourceId={d.id} targetId={cust.id} sourceName={d.name} /></td></tr>)}</tbody></table>
        </Card>
      ) : null}
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12 }}>
        <Card title="المحادثات" flush>
          {(convs ?? []).length ? <table className="bos-table"><tbody>{(convs ?? []).map((v) => <tr key={v.id}><td className="cell-primary"><Link href={`/admin/support/inbox?c=${v.id}`}>{v.number}</Link><span className="cell-sub">{v.subject ?? ""}</span></td><td><span className="bos-tag"><Tx>{channelLabels[v.channel] ?? v.channel}</Tx></span></td><td><StatusBadge tone={v.status === "resolved" || v.status === "closed" ? "neutral" : "info"} label={v.status} /></td><td>{formatDateTime(v.last_message_at)}</td></tr>)}</tbody></table> : <EmptyState title="لا توجد محادثات" />}
        </Card>
        <Card title="التذاكر" flush>
          {(tickets ?? []).length ? <table className="bos-table"><tbody>{(tickets ?? []).map((t) => <tr key={t.id}><td className="cell-primary"><Link href={`/admin/support/tickets/${t.id}`}>{t.ticket_number}</Link><span className="cell-sub">{t.subject}</span></td><td><StatusBadge map="ticket_status" value={t.status} /></td><td>{formatDateTime(t.created_at)}</td></tr>)}</tbody></table> : <EmptyState title="لا توجد تذاكر" />}
        </Card>
        {deals.length ? (
          <Card title="صفقات الحساب" flush>
            <table className="bos-table"><tbody>{deals.map((d) => <tr key={d.id}><td className="cell-primary"><Link href={`/admin/sales/deals/${d.id}`}>{d.deal_number}</Link><span className="cell-sub">{d.name}</span></td></tr>)}</tbody></table>
          </Card>
        ) : null}
      </div>
    </>
  );
}
