import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/bos/auth";
import { Card, EmptyState, KeyValues, KpiCard, PageHeader, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { MessagingNotReady, NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { NotFoundError } from "@/lib/bos/errors";
import { yoliasSiteUrl } from "@/lib/yolias/db";
import type { Rule } from "../../../../../../Yolias/lib/messaging/rules";
import { messagingReady, activity, analytics, getCampaign, getSettings, listSegments } from "@/services/yolias/messaging";
import { ContentEditor } from "../../_ui/ContentEditor";
import { CampaignTools } from "../../_ui/Forms";
import { activityKind, campaignStatus, classLabel, pct } from "../../_ui/labels";
import { saveCampaignAction } from "../../actions";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الحملة" /><NotConnected /></>);
  if (!(await messagingReady())) return (<><PageHeader title="الحملة" /><MessagingNotReady /></>);
  const { id } = await params;
  const c = await getCampaign(id).catch((e) => { if (e instanceof NotFoundError) notFound(); throw e; });
  const [segments, settings, log, a] = await Promise.all([listSegments(), getSettings(), activity({ campaign: id }, 100), c.status === "draft" ? null : analytics(90)]);
  const canManage = can(bos, "platform.manage", "all");
  const st = campaignStatus[c.status as keyof typeof campaignStatus];
  const r = a?.campaigns.find((x) => x.id === c.id);
  return (
    <>
      <PageHeader title={c.name} subtitle="حملة" actions={<Link className="admin-btn secondary" href="/admin/platform/messaging/campaigns"><Tx>كل الحملات</Tx></Link>} />
      <Card>
        <KeyValues items={[
          { label: "الحالة", value: <StatusBadge tone={st.tone} label={st.label} /> },
          { label: "النوع", value: <Tx>{classLabel[c.category]}</Tx> },
          { label: "المستلمون المتوقعون", value: c.estimated != null ? num(c.estimated) : <Tx>لم يُحسب بعد</Tx> },
          { label: "الموعد", value: c.scheduled_at ? formatDateTime(c.scheduled_at) : "-" },
          { label: "أكّدها", value: c.confirmed_by ?? "-" },
          { label: "في الطابور / تُخطّي", value: `${num(c.recipients)} / ${num(c.skipped)}` },
        ]} />
      </Card>
      {r && (
        <div className="bos-kpis">
          <KpiCard label="قبلها Resend" value={num(r.mail.sent)} />
          <KpiCard label="وصلت" value={num(r.mail.delivered)} sub={pct(r.mail.delivered, r.mail.sent)} />
          <KpiCard label="ارتدت أو بلاغات" value={num(r.mail.bounced + r.mail.complained)} />
          <KpiCard label="اشتراكات بعدها" value={num(r.conversions)} sub="آخر رسالة قبل الاشتراك" />
        </div>
      )}
      <ContentEditor action={saveCampaignAction} siteUrl={yoliasSiteUrl().replace(/\/$/, "")} readOnly={!canManage || c.status !== "draft"} submitLabel="حفظ المسودة"
        value={c} audience={{ segments: segments.map((s) => ({ value: s.id, label: s.name })), segmentId: c.segment_id, rules: (c.audience_rules ?? []) as Rule[] }} />
      {canManage && <Card title="اختبار وإرسال"><CampaignTools id={c.id} status={c.status} me={bos.email} estimated={c.estimated} confirmOver={settings.campaign_confirm_over} /></Card>}
      <Card title="السجل (آخر 100)">
        {log.rows.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>المستخدم</Tx></th><th><Tx>ما حدث</Tx></th><th><Tx>التفاصيل</Tx></th></tr></thead>
            <tbody>{log.rows.map((x) => <tr key={x.id}><td style={{ whiteSpace: "nowrap" }}>{formatDateTime(x.created_at)}</td><td dir="ltr">{x.user_id ? log.users.get(x.user_id) ?? x.user_id : "-"}</td><td><Tx>{activityKind[x.kind] ?? x.kind}</Tx></td><td dir="auto">{x.detail}</td></tr>)}</tbody>
          </BosTable>
        ) : <EmptyState title="لا نشاط بعد" />}
      </Card>
    </>
  );
}
