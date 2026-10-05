import { Tx } from "@/components/bos/I18n";
import { nowMs } from "@/lib/bos/clock";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { db } from "@/lib/bos/db";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Summary, Card, KeyValues, StatusBadge } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { Comments } from "@/components/bos/Comments";
import { formatDateTime } from "@/lib/bos/format";
import { MeetingOutcomeForm, MeetingCancelButtons } from "./MeetingOutcome";

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("meetings.read");
  const { id } = await params;
  if (!(await canAccessEntity(bos, "meeting", id))) notFound();
  const { data: meeting, error } = await db()
    .from("meetings")
    .select("*, clients(id, name), leads(id, name), deals(id, name), contacts(id, full_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!meeting) notFound();
  const { data: attendees } = await db().from("meeting_attendees").select("*, contacts(full_name)").eq("meeting_id", id);
  const names = await userNameMap();
  const past = new Date(meeting.start_at).getTime() < nowMs();
  const canUpdate = can(bos, "meetings.update");

  const rel = (label: string, href: string, name: string | undefined) => (name ? { label, value: <Link className="bos-link" href={href}>{name}</Link> } : { label, value: null, hidden: true });

  return (
    <>
      <PageHeader
        title={meeting.title}
        subtitle={<StatusBadge map="meeting_status" value={meeting.status} />}
       
        actions={
          <>
            {meeting.meeting_link && meeting.status === "scheduled" ? (
              <a className="admin-btn small" href={meeting.meeting_link} target="_blank" rel="noreferrer">
                <Tx>انضمام للاجتماع</Tx>
              </a>
            ) : null}
            {canUpdate && meeting.status === "scheduled" ? <MeetingCancelButtons meetingId={id} /> : null}
          </>
        }
      />
      <Summary
        items={[
          { label: "الموعد", value: formatDateTime(meeting.start_at) },
          { label: "المدة", value: `${meeting.duration_minutes} دقيقة` },
          { label: "المنظم", value: meeting.organizer_id ? names.get(meeting.organizer_id) : "—" },
          { label: "المكان", value: meeting.location ?? (meeting.meeting_link ? "عن بُعد" : "—") },
        ]}
      />
      <div className="bos-grid main-side">
        <div>
          {meeting.status === "scheduled" && canUpdate ? (
            <Card title={past ? "سجّل نتيجة الاجتماع" : "بعد الاجتماع: سجّل النتيجة"}>
              <MeetingOutcomeForm meetingId={id} defaultNotes={meeting.notes ?? ""} />
            </Card>
          ) : null}
          {meeting.status === "completed" ? (
            <Card title="النتيجة">
              <div className="bos-prose"><Tx>{meeting.outcome}</Tx></div>
              {meeting.next_action ? (
                <>
                  <div className="bos-divider" />
                  <div className="bos-kv-label"><Tx>الإجراء التالي</Tx></div>
                  <div className="bos-prose"><Tx>{meeting.next_action}</Tx></div>
                </>
              ) : null}
            </Card>
          ) : null}
          {meeting.notes ? (
            <Card title="جدول الأعمال / الملاحظات">
              <div className="bos-prose">{meeting.notes}</div>
            </Card>
          ) : null}
          <Card title="ملاحظات الفريق">
            <Comments entityType="meeting" entityId={id} viewerId={bos.userId} />
          </Card>
        </div>
        <div>
          <Card title="مرتبط بـ">
            <KeyValues
              items={[
                rel("الحساب", `/admin/clients/${meeting.client_id}`, (meeting.clients as unknown as { name: string } | null)?.name),
                rel("العميل المحتمل", `/admin/sales/leads/${meeting.lead_id}`, (meeting.leads as unknown as { name: string } | null)?.name),
                rel("الصفقة", `/admin/sales/deals/${meeting.deal_id}`, (meeting.deals as unknown as { name: string } | null)?.name),
                rel("جهة الاتصال", `/admin/contacts/${meeting.contact_id}`, (meeting.contacts as unknown as { full_name: string } | null)?.full_name),
              ]}
            />
          </Card>
          <Card title="الحضور">
            <ul style={{ listStyle: "none", fontSize: 13, lineHeight: 2 }}>
              {(attendees ?? []).map((a) => (
                <li key={a.id}>
                  {a.user_id ? names.get(a.user_id) : a.contact_id ? `${(a.contacts as unknown as { full_name: string } | null)?.full_name} (العميل)` : a.email}
                  <span className="bos-faint"> · {a.response === "accepted" ? "مؤكد" : a.response === "declined" ? "اعتذر" : "بانتظار الرد"}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="السجل الزمني">
            <ActivityTimeline entityType="meeting" entityId={id} limit={20} />
          </Card>
        </div>
      </div>
    </>
  );
}
