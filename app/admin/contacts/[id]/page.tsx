import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { NotFoundError } from "@/lib/bos/errors";
import { db } from "@/lib/bos/db";
import { getContact } from "@/services/bos/contacts";
import { listCommunications } from "@/services/bos/communications";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, Summary, Card, KeyValues, StatusBadge, Money, EmptyState } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { ActivityComposer } from "@/components/bos/ActivityComposer";
import { MeetingScheduler } from "@/components/bos/MeetingScheduler";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { ContactModalButton } from "../ContactForm";
import { CommunicationList } from "@/app/admin/communications/CommunicationList";
import { ArchiveContactButton } from "@/app/admin/clients/[id]/AccountControls";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("contacts.read");
  const { id } = await params;
  if (!(await canAccessEntity(bos, "contact", id))) notFound();
  let contact;
  try {
    contact = await getContact(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const account = contact.clients as unknown as { id: string; name: string; company_name: string | null; account_manager_id: string | null } | null;
  const c = db();
  const [deals, meetings, approvals, contracts, portal, comms, names, staff, primary] = await Promise.all([
    can(bos, "deals.read") ? c.from("deals").select("id, deal_number, name, value, currency, pipeline_stages(name)").eq("contact_id", id).order("created_at", { ascending: false }).then((r) => r.data ?? []) : Promise.resolve([]),
    c.from("meeting_attendees").select("meetings(id, title, start_at, status)").eq("contact_id", id).then(async (r) => {
      const attended = (r.data ?? []).map((x) => x.meetings as unknown as { id: string; title: string; start_at: string; status: string }).filter(Boolean);
      const { data: direct } = await c.from("meetings").select("id, title, start_at, status").eq("contact_id", id);
      const all = new Map([...attended, ...(direct ?? [])].map((m) => [m.id, m]));
      return [...all.values()].sort((a, b) => (a.start_at < b.start_at ? 1 : -1));
    }),
    c.from("approvals").select("id, title, approval_type, status, requested_at, decided_at, entity_type, entity_id").or(`approver_contact_id.eq.${id},decided_by_contact_id.eq.${id}`).order("requested_at", { ascending: false }).then((r) => r.data ?? []),
    can(bos, "contracts.read") ? c.from("contract_signatures").select("signed_at, contracts(id, contract_number, title, status)").eq("contact_id", id).then((r) => r.data ?? [], () => []) : Promise.resolve([]),
    c.from("client_portal_users").select("status, invited_at, last_login_at").eq("contact_id", id).maybeSingle().then((r) => r.data),
    can(bos, "communications.read") ? listCommunications(bos, "all", { contact: id }) : Promise.resolve(null),
    userNameMap(),
    listActiveStaff(),
    account ? c.from("clients").select("primary_contact_id").eq("id", account.id).single().then((r) => r.data?.primary_contact_id === id) : Promise.resolve(false),
  ]);
  const projectIds = [...new Set((deals as { id: string }[]).map((d) => d.id))];
  const { data: projects } = projectIds.length && can(bos, "projects.read") ? await c.from("projects").select("id, name, project_number, status").in("deal_id", projectIds) : { data: [] };
  const staffOptions = staff.map((s) => ({ value: s.userId, label: s.name }));

  return (
    <>
      <PageHeader
        title={contact.full_name}
        subtitle={
          <span className="bos-row" style={{ gap: 8 }}>
            {contact.position ? <span>{contact.position}</span> : null}
            {primary ? <StatusBadge tone="accent" label="جهة الاتصال الرئيسية" /> : null}
            {contact.is_decision_maker ? <StatusBadge tone="info" label="صاحب قرار" /> : null}
            {contact.archived_at ? <StatusBadge tone="neutral" label="مؤرشفة" /> : null}
          </span>
        }
        breadcrumbs={[{ label: "العملاء" }, { label: "جهات الاتصال", href: "/admin/contacts" }, { label: contact.full_name }]}
        actions={
          <>
            {can(bos, "contacts.update") && !contact.archived_at ? <ContactModalButton label="تعديل" initial={{ ...contact, isPrimary: primary }} account={account ? { id: account.id, label: account.company_name ?? account.name } : null} lockAccount={!!account} /> : null}
            {can(bos, "activities.create") ? <ActivityComposer related={{ contact_id: id, client_id: contact.client_id }} staff={staffOptions} /> : null}
            {can(bos, "meetings.create") ? <MeetingScheduler related={{ contact_id: id, client_id: contact.client_id }} staff={staffOptions} defaultTitle={`Meeting with ${contact.full_name}`} /> : null}
            {can(bos, "contacts.delete") ? <ArchiveContactButton id={id} archived={!!contact.archived_at} /> : null}
          </>
        }
      />
      <Summary
        items={[
          { label: "الحساب", value: account ? <Link href={`/admin/clients/${account.id}`}>{account.company_name ?? account.name}</Link> : "—" },
          { label: "البريد", value: contact.email ? <a className="bos-link" dir="ltr" href={`mailto:${contact.email}`}>{contact.email}</a> : "—" },
          { label: "الهاتف", value: contact.phone ? <a className="bos-link" dir="ltr" href={`tel:${contact.phone}`}>{contact.phone}</a> : "—" },
          { label: "واتساب", value: contact.whatsapp ? <a className="bos-link" dir="ltr" href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><Tx>{contact.whatsapp}</Tx></a> : "—" },
          { label: "بوابة العميل", value: portal ? <StatusBadge tone={portal.status === "active" ? "success" : portal.status === "disabled" ? "neutral" : "warning"} label={portal.status === "active" ? "نشط" : portal.status === "disabled" ? "معطّل" : "مدعو"} /> : "—" },
        ]}
      />
      <div className="bos-grid main-side">
        <div>
          <Card title="الصفقات">
            {deals.length ? (
              <table className="bos-table responsive"><tbody>
                {(deals as { id: string; deal_number: string; name: string; value: number; currency: string; pipeline_stages: unknown }[]).map((d) => (
                  <tr key={d.id}>
                    <td className="cell-primary"><Link href={`/admin/sales/deals/${d.id}`}>{d.name}</Link><span className="cell-sub">{d.deal_number}</span></td>
                    <td>{(d.pipeline_stages as { name: string } | null)?.name}</td>
                    <td><Money value={d.value} currency={d.currency} /></td>
                  </tr>
                ))}
              </tbody></table>
            ) : <EmptyState title="لا توجد صفقات مرتبطة" />}
          </Card>
          {projects?.length ? (
            <Card title="المشاريع">
              {projects.map((p) => (
                <div key={p.id} style={{ marginBottom: 6 }}><Link href={`/admin/projects/${p.id}`}>{p.name}</Link> <StatusBadge map="project_status" value={p.status} /></div>
              ))}
            </Card>
          ) : null}
          {comms ? <Card title="التواصل"><CommunicationList items={comms.rows.slice(0, 30)} names={Object.fromEntries(names)} /></Card> : null}
          <Card title="السجل الزمني"><ActivityTimeline entityType="contact" entityId={id} limit={50} /></Card>
        </div>
        <div>
          <Card title="البيانات">
            <KeyValues items={[{ label: "لينكدإن", value: contact.linkedin_url ? <a className="bos-link" href={contact.linkedin_url} target="_blank" rel="noreferrer"><Tx>الملف الشخصي</Tx></a> : null }, { label: "أُضيفت", value: formatDate(contact.created_at) }, { label: "بواسطة", value: contact.created_by ? names.get(contact.created_by) : null }]} />
            {contact.notes ? <div className="bos-prose" style={{ marginTop: 8 }}>{contact.notes}</div> : null}
          </Card>
          <Card title="الاجتماعات">
            {meetings.length ? meetings.slice(0, 10).map((m) => (
              <div key={m.id} style={{ marginBottom: 6 }}>
                <Link href={`/admin/communication/meetings/${m.id}`}><Tx>{m.title}</Tx></Link>
                <div className="bos-faint" style={{ fontSize: 12 }}>{formatDateTime(m.start_at)} · <StatusBadge map="meeting_status" value={m.status} /></div>
              </div>
            )) : <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لا توجد اجتماعات.</Tx></div>}
          </Card>
          <Card title="الموافقات">
            {approvals.length ? approvals.map((a) => (
              <div key={a.id} style={{ marginBottom: 6, fontSize: 13 }}>
                <Tx>{a.title}</Tx> <StatusBadge map="approval_status" value={a.status} />
                <div className="bos-faint" style={{ fontSize: 12 }}>{formatDate(a.requested_at)}</div>
              </div>
            )) : <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لا توجد موافقات.</Tx></div>}
          </Card>
          {contracts.length ? (
            <Card title="العقود الموقعة">
              {(contracts as { signed_at: string | null; contracts: unknown }[]).map((s, i) => {
                const k = s.contracts as { id: string; contract_number: string; title: string; status: string } | null;
                return k ? <div key={i} style={{ marginBottom: 6 }}><Link href={`/admin/sales/contracts/${k.id}`}><Tx>{k.title}</Tx></Link><div className="bos-faint" style={{ fontSize: 12 }}>{k.contract_number} · {formatDate(s.signed_at)}</div></div> : null;
              })}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
