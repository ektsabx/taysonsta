import Link from "next/link";
import { nowMs } from "@/lib/bos/clock";
import { headers } from "next/headers";
import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { listTeams } from "@/services/bos/conversations";
import { listAgents } from "@/services/bos/ai-agents";
import { listWidgets } from "@/services/bos/widgets";
import { PageHeader, Card, StatusBadge, EmptyState, KeyValues } from "@/components/bos/ui";
import { EmbedCode, RotateKey, WidgetButton, type WidgetValues } from "./WidgetControls";

// Website support chat widget (docs/bos/30 §10.5), managed from Settings →
// Integrations (docs/bos/37 §5): embed code, allowed domains, look & feel,
// working hours, AI agent, team and visitor activity.
export default async function IntegrationWidgetsPage() {
  await requirePermission("conversations.manage", "all");
  const since = new Date(nowMs() - 30 * 86400_000).toISOString();
  const [widgets, agents, teams, { data: sessions }, { data: convs }, h] = await Promise.all([
    listWidgets(), listAgents(), listTeams(),
    db().from("widget_sessions").select("widget_id").gte("created_at", since),
    db().from("bos_conversations").select("widget_id, handed_off_at, ai_agent_id").not("widget_id", "is", null).gte("created_at", since),
    headers(),
  ]);
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3100"}`;
  const count = (rows: { widget_id: string | null }[] | null, id: string) => (rows ?? []).filter((r) => r.widget_id === id).length;
  const agentOpts = agents.map((a) => ({ value: a.id, label: a.is_active ? a.name : `${a.name} (معطّل)` }));
  const teamOpts = teams.map((t) => ({ value: t.id, label: t.name }));
  return (
    <>
      <PageHeader title="ويدجت الموقع" subtitle="أداة تضعها في موقعك لتصل رسائل الزوار إلى صندوق وارد الدعم" />
      <div className="bos-row" style={{ justifyContent: "space-between", margin: "4px 0 10px" }}>
        <h2 className="bos-section-title"><Tx>ويدجت محادثة الدعم</Tx></h2>
        <WidgetButton agents={agentOpts} teams={teamOpts} />
      </div>
      <p className="bos-faint" style={{ fontSize: 12.5, marginTop: 0 }}><Tx>الرسائل تصل إلى</Tx> <Link className="bos-link" href="/admin/support/inbox"><Tx>صندوق الوارد</Tx></Link> <Tx>ويرد</Tx> <Link className="bos-link" href="/admin/support/ai-agents"><Tx>وكيل الذكاء الاصطناعي</Tx></Link> <Tx>أولاً إن فعّلته.</Tx></p>
      {widgets.length ? widgets.map((w) => {
        const values: WidgetValues = { ...w, working_hours: (w.working_hours ?? {}) as WidgetValues["working_hours"] };
        const wc = (convs ?? []).filter((c) => c.widget_id === w.id);
        return (
          <Card key={w.id} title={<span className="bos-row" style={{ gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: w.primary_color, display: "inline-block" }} />{w.name}{w.is_active ? <StatusBadge tone="success" label="مفعّل" /> : <StatusBadge tone="neutral" label="معطّل" />}</span>}
            actions={<span className="bos-row" style={{ gap: 6 }}><RotateKey id={w.id} /><WidgetButton widget={values} agents={agentOpts} teams={teamOpts} /></span>}>
            <EmbedCode src={`${origin}/api/public/widget/${w.public_key}/embed.js`} />
            {!w.allowed_domains.length ? <p className="bos-hint" style={{ color: "var(--bos-danger, #c0392b)", marginTop: 8 }}><Tx>لم تُضف نطاقات مسموح بها — الويدجت لن يعمل في أي موقع حتى تضيفها.</Tx></p> : null}
            <div style={{ marginTop: 10 }}>
              <KeyValues items={[
                { label: "النطاقات", value: w.allowed_domains.length ? <span dir="ltr">{w.allowed_domains.join(", ")}</span> : "—" },
                { label: "وكيل الذكاء الاصطناعي", value: (w.ai_agents as { name: string } | null)?.name ?? <Tx>بدون</Tx> },
                { label: "الفريق", value: (w.support_teams as { name: string } | null)?.name ?? <Tx>الافتراضي</Tx> },
                { label: "الزوار (30 يوماً)", value: count(sessions, w.id) },
                { label: "المحادثات (30 يوماً)", value: wc.length },
                { label: "حُوّلت لموظف", value: wc.filter((c) => c.handed_off_at || !c.ai_agent_id).length },
              ]} />
            </div>
          </Card>
        );
      }) : <EmptyState title="لا يوجد ويدجت بعد" description="أنشئ ويدجت، أضف نطاق موقعك، ثم انسخ كود التضمين إلى صفحات الموقع." />}
    </>
  );
}
