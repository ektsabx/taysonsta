import Link from "next/link";
import { can, requirePermission } from "@/lib/bos/auth";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { MessagingNotReady, NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { listAnnouncements } from "@/services/yolias/emails";
import { messagingReady, listCampaigns, listTemplates } from "@/services/yolias/messaging";
import { NewItemForm } from "../_ui/Forms";
import { campaignStatus, classLabel } from "../_ui/labels";

// Campaigns (D-243): one-off sends to a segment: drafts, scheduled, sent.
// Product update announcements sent before this system stay listed here.
export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الحملات" /><NotConnected /></>);
  if (!(await messagingReady())) return (<><PageHeader title="الحملات" /><MessagingNotReady /></>);
  const filter = (await searchParams).status ?? "all";
  const [campaigns, templates, announcements] = await Promise.all([listCampaigns(), listTemplates(), listAnnouncements().catch(() => [])]);
  const groups: Record<string, string[]> = { all: [], draft: ["draft"], scheduled: ["scheduled", "sending"], sent: ["sent"], canceled: ["canceled", "failed"] };
  const rows = filter === "all" ? campaigns : campaigns.filter((c) => groups[filter]?.includes(c.status));
  const tab = (k: string, label: string) => <Link key={k} className={`msg-pill${filter === k ? " active" : ""}`} href={`/admin/platform/messaging/campaigns${k === "all" ? "" : `?status=${k}`}`}><Tx>{label}</Tx></Link>;
  return (
    <>
      <PageHeader title="الحملات" subtitle="رسائل لمرة واحدة لشريحة من المستخدمين: إعلانات الميزات، التحديثات، إعادة التنشيط، دعوات الشركاء." />
      <div className="msg-pills">{[tab("all", "الكل"), tab("draft", "المسودات"), tab("scheduled", "المجدولة"), tab("sent", "المرسلة"), tab("canceled", "الملغاة")]}</div>
      <Card>
        {rows.length ? (
          <BosTable className="bos-table responsive stacked">
            <thead><tr><th><Tx>الحملة</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>النوع</Tx></th><th><Tx>الموعد</Tx></th><th><Tx>المستلمون</Tx></th><th><Tx>تُخطّي</Tx></th></tr></thead>
            <tbody>
              {rows.map((c) => {
                const st = campaignStatus[c.status as keyof typeof campaignStatus];
                return (
                  <tr key={c.id}>
                    <td data-label="الحملة"><Link className="bos-link" href={`/admin/platform/messaging/campaigns/${c.id}`}><strong>{c.name}</strong></Link><span className="cell-sub" dir="auto">{c.subject}</span></td>
                    <td data-label="الحالة"><StatusBadge tone={st.tone} label={st.label} /></td>
                    <td data-label="النوع"><Tx>{classLabel[c.category]}</Tx></td>
                    <td data-label="الموعد">{c.scheduled_at ? formatDateTime(c.scheduled_at) : "-"}</td>
                    <td data-label="المستلمون" className="bos-num">{c.status === "draft" ? (c.estimated != null ? <Tx vars={{ n: num(c.estimated) }}>{"متوقع {n}"}</Tx> : "-") : num(c.recipients)}</td>
                    <td data-label="تُخطّي" className="bos-num">{num(c.skipped)}</td>
                  </tr>
                );
              })}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد حملات هنا" />}
      </Card>
      {can(bos, "platform.manage", "all") && (
        <Card title="حملة جديدة">
          <NewItemForm kind="campaign" templates={templates.map((t) => ({ value: t.id, label: `${t.name} · ${classLabel[t.category]}` }))} />
        </Card>
      )}
      {announcements.length > 0 && (
        <Card title="إعلانات سابقة (قبل نظام الحملات)">
          <BosTable className="bos-table">
            <thead><tr><th><Tx>العنوان</Tx></th><th><Tx>المستلمون</Tx></th><th><Tx>التاريخ</Tx></th></tr></thead>
            <tbody>{announcements.map((a) => <tr key={a.id}><td>{a.title_en}<span className="cell-sub" dir="rtl">{a.title_ar}</span></td><td className="bos-num">{num(a.recipients)}</td><td>{formatDateTime(a.sent_at ?? a.created_at)}</td></tr>)}</tbody>
          </BosTable>
        </Card>
      )}
    </>
  );
}
