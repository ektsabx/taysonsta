import Link from "next/link";
import { nowMs } from "@/lib/bos/clock";
import { headers } from "next/headers";
import { Tx } from "@/components/bos/I18n";
import { can, requireBosUser } from "@/lib/bos/auth";
import { redirect } from "next/navigation";
import { listWaWidgets, waClicks } from "@/services/bos/whatsapp-widgets";
import { WaWidgetButton } from "@/app/admin/communication/messaging/MessagingControls";
import { db } from "@/lib/bos/db";
import { listTeams } from "@/services/bos/conversations";
import { listAgents } from "@/services/bos/ai-agents";
import { listWidgets } from "@/services/bos/widgets";
import { PageHeader, Card, StatusBadge, EmptyState, KeyValues } from "@/components/bos/ui";
import { EmbedCode, RotateKey, WidgetButton, type WidgetValues } from "./WidgetControls";

// Website widgets (docs/bos/30 §10.5, §11), managed from Settings →
// Integrations (docs/bos/37 §5): the support chat widget (embed code, allowed
// domains, look & feel, working hours, AI agent, team, visitor activity) and
// the click-to-WhatsApp button. One management page, same data as before.
export default async function IntegrationWidgetsPage() {
  const bos = await requireBosUser();
  const support = can(bos, "conversations.manage", "all");
  const whatsapp = can(bos, "messaging.manage");
  if (!support && !whatsapp) redirect("/admin/forbidden");
  const since = new Date(nowMs() - 30 * 86400_000).toISOString();
  const [widgets, agents, teams, { data: branches }, { data: sessions }, { data: convs }, h] = await Promise.all([
    support ? listWidgets() : Promise.resolve([] as Awaited<ReturnType<typeof listWidgets>>), listAgents(), listTeams(),
    db().from("branches").select("id, name").eq("status", "active").order("name"),
    db().from("widget_sessions").select("widget_id").gte("created_at", since),
    db().from("conversations").select("widget_id, handed_off_at, ai_agent_id").not("widget_id", "is", null).gte("created_at", since),
    headers(),
  ]);
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3100"}`;
  const count = (rows: { widget_id: string | null }[] | null, id: string) => (rows ?? []).filter((r) => r.widget_id === id).length;
  const agentOpts = agents.map((a) => ({ value: a.id, label: a.is_active ? a.name : `${a.name} (معطّل)` }));
  const teamOpts = teams.map((t) => ({ value: t.id, label: t.name }));
  const branchOpts = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));
  return (
    <>
      <PageHeader title="ويدجت الموقع" subtitle="أدوات تضعها في موقعك لتصل رسائل الزوار إلى صندوق وارد الدعم أو إلى واتساب" />
      {support ? <>
      <div className="bos-row" style={{ justifyContent: "space-between", margin: "4px 0 10px" }}>
        <h2 className="bos-section-title"><Tx>ويدجت محادثة الدعم</Tx></h2>
        <WidgetButton agents={agentOpts} teams={teamOpts} branches={branchOpts} />
      </div>
      <p className="bos-faint" style={{ fontSize: 12.5, marginTop: 0 }}><Tx>الرسائل تصل إلى</Tx> <Link className="bos-link" href="/admin/support/inbox"><Tx>صندوق الوارد</Tx></Link> <Tx>ويرد</Tx> <Link className="bos-link" href="/admin/support/ai-agents"><Tx>وكيل الذكاء الاصطناعي</Tx></Link> <Tx>أولاً إن فعّلته.</Tx></p>
      {widgets.length ? widgets.map((w) => {
        const values: WidgetValues = { ...w, working_hours: (w.working_hours ?? {}) as WidgetValues["working_hours"] };
        const wc = (convs ?? []).filter((c) => c.widget_id === w.id);
        return (
          <Card key={w.id} title={<span className="bos-row" style={{ gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: w.primary_color, display: "inline-block" }} />{w.name}{w.is_active ? <StatusBadge tone="success" label="مفعّل" /> : <StatusBadge tone="neutral" label="معطّل" />}</span>}
            actions={<span className="bos-row" style={{ gap: 6 }}><RotateKey id={w.id} /><WidgetButton widget={values} agents={agentOpts} teams={teamOpts} branches={branchOpts} /></span>}>
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
      </> : null}
      {whatsapp ? <><h2 className="bos-section-title" style={{ marginTop: 22 }}><Tx>زر واتساب للموقع</Tx></h2><WaButtons origin={origin} /></> : null}
    </>
  );
}

async function WaButtons({ origin }: { origin: string }) {
  const [widgets, clicks] = await Promise.all([listWaWidgets(), waClicks(30)]);
  return (
    <>
      <Card title="زر واتساب مقابل محادثة واتساب للأعمال" actions={<WaWidgetButton />}>
        <p className="bos-hint" style={{ margin: 0 }}><Tx>زر واتساب يفتح تطبيق واتساب لدى الزائر برسالة مكتوبة مسبقاً إلى رقمك (wa.me) — لا يحتاج API، والمحادثة تتم في واتساب. أما «واتساب للأعمال (API)» فيجعل الرسائل تصل إلى صندوق وارد الدعم هنا ويرد عليها الفريق بتتبع حالة التسليم. إذا كان رقم الزر هو نفس رقم الـAPI المتصل، تظهر المحادثات في صندوق الوارد تلقائياً.</Tx></p>
      </Card>
      {widgets.length ? widgets.map((w) => (
        <Card key={w.id} title={<span className="bos-row" style={{ gap: 8 }}>{w.name}{w.is_active ? <StatusBadge tone="success" label="مفعّل" /> : <StatusBadge tone="neutral" label="معطّل" />}</span>} actions={<WaWidgetButton w={w} />}>
          <EmbedCode src={`${origin}/api/public/whatsapp/${w.public_key}/embed.js`} />
          <div style={{ marginTop: 10 }}>
            <KeyValues items={[
              { label: "الرقم", value: <span dir="ltr">+{w.phone}</span> },
              { label: "نص الزر", value: w.label },
              { label: "الرسالة المكتوبة مسبقاً", value: w.greeting || "—" },
              { label: "النقرات (30 يوماً)", value: clicks.get(w.id) ?? 0 },
              { label: "معاينة", value: <a href={`https://wa.me/${w.phone}?text=${encodeURIComponent(w.greeting)}`} target="_blank" rel="noreferrer"><Tx>فتح الرابط</Tx></a> },
            ]} />
          </div>
        </Card>
      )) : <EmptyState title="لا يوجد زر واتساب بعد" />}
    </>
  );
}
