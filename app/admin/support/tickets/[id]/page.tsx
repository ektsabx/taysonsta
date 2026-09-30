import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { NotFoundError } from "@/lib/bos/errors";
import { db } from "@/lib/bos/db";
import { getTicket, listTicketConversation } from "@/services/bos/support";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, Summary, Card, StatusBadge } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { FileManager } from "@/components/bos/FileManager";
import { formatDateTime } from "@/lib/bos/format";
import { SlaIndicator } from "../../SlaIndicator";
import { AssignSelect, MergeTicketButton, ReplyForm, TicketMetaForm, TicketStatusButtons, ticketCategories } from "../../SupportControls";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("tickets.read");
  const { id } = await params;
  if (!(await canAccessEntity(bos, "ticket", id))) notFound();
  let t;
  try {
    t = await getTicket(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const canUpdate = can(bos, "tickets.update") && (await canAccessEntity(bos, "ticket", id, "update"));
  const [conversation, names, staff] = await Promise.all([
    listTicketConversation(id, true),
    userNameMap(),
    listActiveStaff(),
  ]);
  const { data: contactNames } = await db().from("contacts").select("id, full_name").in("id", [...new Set(conversation.map((c) => c.author_contact_id).filter(Boolean))] as string[]);
  const cName = new Map((contactNames ?? []).map((c) => [c.id, c.full_name]));
  const client = t.clients as unknown as { id: string; name: string; company_name: string | null };
  const contact = t.contacts as unknown as { id: string; full_name: string; email: string | null } | null;
  const project = t.projects as unknown as { id: string; name: string; support_until: string | null } | null;
  const catLabel = ticketCategories.find((c) => c.value === t.category)?.label ?? t.category;
  return (
    <>
      <PageHeader
        title={t.subject}
        subtitle={<span className="bos-row" style={{ gap: 8 }}><span>{t.ticket_number}</span><StatusBadge map="ticket_status" value={t.status} /><StatusBadge map="priority" value={t.priority} />{t.source === "portal" ? <StatusBadge tone="accent" label="من البوابة" /> : null}</span>}
       
        actions={
          canUpdate ? (
            <>
              <TicketStatusButtons id={id} status={t.status} />
              {t.status !== "closed" && t.client_id ? <MergeTicketButton id={id} clientId={t.client_id} /> : null}
            </>
          ) : null
        }
      />
      <Summary
        items={[
          { label: "العميل", value: <Link href={`/admin/clients/${client.id}?tab=tickets`}>{client.company_name ?? client.name}</Link> },
          { label: "جهة الاتصال", value: contact ? <Link href={`/admin/contacts/${contact.id}`}>{contact.full_name}</Link> : "—" },
          { label: "المشروع", value: project ? <Link href={`/admin/projects/${project.id}`}>{project.name}</Link> : "—" },
          { label: "التصنيف", value: catLabel },
          { label: "المسؤول", value: can(bos, "tickets.assign") ? <AssignSelect id={id} current={t.assigned_to} staff={staff.map((s) => ({ value: s.userId, label: s.name }))} /> : t.assigned_to ? names.get(t.assigned_to) : "—" },
          { label: "SLA", value: <SlaIndicator t={t} /> },
        ]}
      />
      <div className="bos-grid main-side">
        <div>
          <Card title="الوصف">
            <div className="bos-prose"><Tx>{t.description}</Tx></div>
            <div className="bos-faint" style={{ fontSize: 12, marginTop: 6 }}>{formatDateTime(t.created_at)} · {t.created_by_contact_id ? cName.get(t.created_by_contact_id) ?? "العميل" : t.created_by_user_id ? names.get(t.created_by_user_id) : "—"}</div>
          </Card>
          <Card title="المحادثة">
            <div className="bos-stack" style={{ gap: 10 }}>
              {conversation.length ? conversation.map((c) => (
                <div key={c.id} className={`bos-ticket-msg${c.is_internal ? " internal" : ""}${c.author_contact_id ? " client" : ""}`}>
                  <div className="bos-row" style={{ gap: 8, fontSize: 12.5 }}>
                    <strong><Tx>{c.author_contact_id ? cName.get(c.author_contact_id) ?? "العميل" : c.author_user_id ? names.get(c.author_user_id) ?? "—" : "النظام"}</Tx></strong>
                    {c.is_internal ? <span className="bos-badge tone-warning plain"><Tx>ملاحظة داخلية</Tx></span> : c.author_contact_id ? <span className="bos-badge tone-accent plain"><Tx>العميل</Tx></span> : <span className="bos-badge tone-info plain"><Tx>رد للعميل</Tx></span>}
                    <span className="bos-faint">{formatDateTime(c.created_at)}</span>
                  </div>
                  <div className="bos-prose" style={{ marginTop: 4 }}>{c.body}</div>
                </div>
              )) : <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لا توجد ردود بعد.</Tx></div>}
            </div>
          </Card>
          {canUpdate ? <Card title="إضافة رد"><ReplyForm id={id} disabled={t.status === "closed"} /></Card> : null}
        </div>
        <div>
          {canUpdate ? <Card title="بيانات التذكرة"><TicketMetaForm id={id} category={t.category} priority={t.priority} clientId={t.client_id ?? ""} projectInit={project ? { id: project.id, label: project.name } : null} /></Card> : null}
          <Card title="المرفقات"><FileManager entityType="ticket" entityId={id} canUpload={can(bos, "files.create")} allowClientVisible /></Card>
          <Card title="السجل"><ActivityTimeline entityType="ticket" entityId={id} limit={40} /></Card>
        </div>
      </div>
    </>
  );
}
