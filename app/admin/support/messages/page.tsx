import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, EmptyState, StatusBadge, Summary } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected, Pager, qsFor, num } from "@/components/yolias/PlatformUi";
import { listMessages, messageCounts, notifyAddress } from "@/services/yolias/support-messages";
import { NotifyForm, StatusForm } from "./MessageForms";
import { kindLabel, statusLabel, statusTone } from "./labels";


// Website messages (2026-10-12): the Yolias Contact form and the in-app
// "Feedback / Report a Bug" button, kept apart by type. Support staff read
// them and move them New → In progress → Resolved (audited).
export default async function SupportMessagesPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("conversations.read");
  if (!connected()) return (<><PageHeader title="رسائل الموقع والبلاغات" /><NotConnected /></>);
  const sp = await readParams(searchParams);
  const page = pageOf(sp);
  const canUpdate = can(bos, "conversations.update");
  const [{ rows, total, pages }, counts, notify] = await Promise.all([
    listMessages({ q: sp.q, kind: sp.kind, status: sp.status, page }),
    messageCounts(),
    can(bos, "conversations.manage", "all") ? notifyAddress() : Promise.resolve(null),
  ]);
  return (
    <>
      <PageHeader title="رسائل الموقع والبلاغات" subtitle={<Tx vars={{ n: num(total) }}>{"{n} رسالة"}</Tx>} />
      <Summary items={[
        { label: "رسائل تواصل جديدة", value: num(counts.contactNew) },
        { label: "بلاغات جديدة", value: num(counts.bugNew) },
        { label: "قيد المعالجة", value: num(counts.inProgress) },
      ]} />
      <FilterBar
        searchPlaceholder="بحث بالاسم أو البريد أو النص"
        filters={[
          { key: "kind", label: "النوع", type: "select", options: [{ value: "contact", label: "رسالة تواصل" }, { value: "bug_report", label: "بلاغ / ملاحظة" }] },
          { key: "status", label: "الحالة", type: "select", options: Object.entries(statusLabel).map(([value, label]) => ({ value, label })) },
        ]}
      />
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>النوع</Tx></th><th><Tx>المرسل</Tx></th><th><Tx>الموضوع</Tx></th><th><Tx>التاريخ</Tx></th><th><Tx>الحالة</Tx></th>{canUpdate ? <th /> : null}</tr></thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td><StatusBadge tone={m.kind === "bug_report" ? "warning" : "info"} label={kindLabel[m.kind]} /></td>
                    <td>
                      {m.name}
                      <span className="cell-sub" dir="ltr">{m.email}</span>
                    </td>
                    <td>
                      <Link className="bos-link" href={`/admin/support/messages/${m.id}`}>{(m.subject || m.message).slice(0, 90)}</Link>
                      <span className="cell-sub">{m.kind === "bug_report" ? m.page_path ?? "" : m.topic}</span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(m.created_at)}</td>
                    <td><StatusBadge tone={statusTone[m.status]} label={statusLabel[m.status]} /></td>
                    {canUpdate ? <td><StatusForm id={m.id} status={m.status} /></td> : null}
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد رسائل" description="تظهر هنا رسائل نموذج «تواصل معنا» في موقع يولياس وبلاغات «ملاحظات / الإبلاغ عن مشكلة» من داخل التطبيق." />}
        <Pager page={page} pages={pages} href={qsFor("/admin/support/messages", sp)} />
      </Card>
      {notify !== null && (
        <Card title="الإشعارات">
          <NotifyForm email={notify} />
          <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>يُرسل البريد عبر Resend، ويُسجَّل وقت الإشعار فقط عندما يقبل مزود البريد الرسالة.</Tx></p>
        </Card>
      )}
    </>
  );
}
