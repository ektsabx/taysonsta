import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { Card, EmptyState, PageHeader } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { MessagingNotReady, NotConnected, connected } from "@/components/yolias/PlatformUi";
import { messagingReady, activity, listCampaigns, listTemplates } from "@/services/yolias/messaging";
import { ydb } from "@/lib/yolias/db";
import { activityKind } from "../_ui/labels";

// Events & activity log (D-243): every entry, step, send, skip (with its
// reason), wait, exit, goal, error and retry, filterable.
export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="سجل الأحداث والتنفيذ" /><NotConnected /></>);
  if (!(await messagingReady())) return (<><PageHeader title="سجل الأحداث والتنفيذ" /><MessagingNotReady /></>);
  const sp = await searchParams;
  const f = { email: sp.email, flow: sp.flow, campaign: sp.campaign, template: sp.template, kind: sp.kind, from: sp.from, to: sp.to };
  const [{ rows, users }, { data: flows }, campaigns, templates] = await Promise.all([activity(f), ydb().from("msg_flows").select("id, name").order("name"), listCampaigns(), listTemplates(true)]);
  const flowName = new Map((flows ?? []).map((x) => [x.id, x.name]));
  const campName = new Map(campaigns.map((x) => [x.id, x.name]));
  return (
    <>
      <PageHeader title="سجل الأحداث والتنفيذ" subtitle="ما حدث مع كل مستخدم في كل مسار وحملة: الدخول، الرسائل، التخطي وسببه، الانتظار، الخروج، الأخطاء." />
      <Card>
        <form className="msg-filters" method="get">
          <label><span><Tx>بريد المستخدم</Tx></span><input name="email" type="email" dir="ltr" defaultValue={f.email ?? ""} /></label>
          <label><span><Tx>المسار</Tx></span><select name="flow" defaultValue={f.flow ?? ""}><option value="">{""}</option>{(flows ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label><span><Tx>الحملة</Tx></span><select name="campaign" defaultValue={f.campaign ?? ""}><option value="">{""}</option>{campaigns.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label><span><Tx>القالب</Tx></span><select name="template" defaultValue={f.template ?? ""}><option value="">{""}</option>{templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label><span><Tx>ما حدث</Tx></span><select name="kind" defaultValue={f.kind ?? ""}><option value="">{""}</option>{Object.entries(activityKind).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label><span><Tx>من</Tx></span><input name="from" type="date" defaultValue={f.from ?? ""} /></label>
          <label><span><Tx>إلى</Tx></span><input name="to" type="date" defaultValue={f.to ?? ""} /></label>
          <span className="msg-filter-actions"><button className="admin-btn" type="submit"><Tx>تصفية</Tx></button><Link className="admin-btn secondary" href="/admin/platform/messaging/activity"><Tx>مسح</Tx></Link></span>
        </form>
      </Card>
      <Card title="آخر 200">
        {rows.length ? (
          <BosTable className="bos-table responsive stacked">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>المستخدم</Tx></th><th><Tx>المسار أو الحملة</Tx></th><th><Tx>الخطوة</Tx></th><th><Tx>ما حدث</Tx></th><th><Tx>التفاصيل</Tx></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-label="الوقت" style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.created_at)}</td>
                  <td data-label="المستخدم" dir="ltr">{r.user_id ? <Link className="bos-link" href={`/admin/platform/users/${r.user_id}`}>{users.get(r.user_id) ?? r.user_id.slice(0, 8)}</Link> : "-"}</td>
                  <td data-label="المسار أو الحملة">{r.flow_id ? <Link className="bos-link" href={r.enrollment_id ? `/admin/platform/messaging/activity/${r.enrollment_id}` : `/admin/platform/messaging/flows/${r.flow_id}`}>{flowName.get(r.flow_id) ?? "-"}</Link> : r.campaign_id ? <Link className="bos-link" href={`/admin/platform/messaging/campaigns/${r.campaign_id}`}>{campName.get(r.campaign_id) ?? "-"}</Link> : "-"}</td>
                  <td data-label="الخطوة" dir="ltr">{r.step_id ?? "-"}</td>
                  <td data-label="ما حدث"><Tx>{activityKind[r.kind] ?? r.kind}</Tx></td>
                  <td data-label="التفاصيل" dir="auto">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا يوجد نشاط مطابق" />}
      </Card>
    </>
  );
}
