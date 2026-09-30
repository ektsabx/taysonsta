import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { listCategories } from "@/services/bos/knowledge";
import { agentMonthSpendUsd, agentStats, listAgents } from "@/services/bos/ai-agents";
import { PageHeader, Card, StatusBadge, EmptyState, KeyValues } from "@/components/bos/ui";
import { SubNav } from "@/components/bos/SubNav";
import { supportNav } from "../support-nav";
import { AgentButton, AgentTester, type AgentValues } from "./AgentControls";

const toneLabels: Record<string, string> = { friendly: "ودود", formal: "رسمي", concise: "مختصر" };

// AI support agents (docs/bos/30 §10.6): persona, knowledge sources,
// hand-off rules, cost limit, test console, 30-day performance.
export default async function AiAgentsPage() {
  const { bos } = await requirePermission("conversations.manage", "all");
  const [agents, categories, stats, { count: kbCount }, { count: aiConns }] = await Promise.all([
    listAgents(), listCategories(), agentStats(30),
    db().from("kb_articles").select("id", { count: "exact", head: true }).eq("status", "published").eq("ai_allowed", true).eq("audience", "public"),
    db().from("integration_connections").select("id", { count: "exact", head: true }).in("provider", ["anthropic", "openai", "gemini"]).eq("status", "active"),
  ]);
  const spend = new Map(await Promise.all(agents.map(async (a) => [a.id, await agentMonthSpendUsd(a.id)] as const)));
  const catOpts = categories.map((c) => ({ value: c.id, label: c.name }));
  return (
    <>
      <PageHeader title="وكلاء الذكاء الاصطناعي" subtitle="يرد على عملاء الويدجت من قاعدة المعرفة فقط، ويحوّل إلى موظف عند الحاجة" breadcrumbs={[{ label: "الدعم" }, { label: "وكلاء الذكاء الاصطناعي" }]} actions={<AgentButton categories={catOpts} />} />
      <SubNav items={supportNav(bos)} active="ai-agents" label="الدعم" />
      {!aiConns ? <Card><p className="bos-hint"><Tx>لا يوجد مزود ذكاء اصطناعي متصل. أضف مفتاح Claude أو OpenAI أو Gemini من</Tx> <Link href="/admin/settings/integrations"><Tx>مركز التكاملات</Tx></Link> — <Tx>حتى ذلك الحين تُحوّل كل الرسائل إلى الموظفين.</Tx></p></Card> : null}
      <Card><p className="bos-hint" style={{ margin: 0 }}><Tx>مقالات متاحة للمساعد:</Tx> <b>{kbCount ?? 0}</b> · <Tx>فعّل «متاح لوكلاء الذكاء الاصطناعي» واجعل الجمهور «عام» في محرر المقال.</Tx> <Link href="/admin/knowledge"><Tx>قاعدة المعرفة</Tx></Link></p></Card>
      {agents.length ? agents.map((a) => {
        const s = stats.get(a.id) ?? { total: 0, handedOff: 0, resolvedByAi: 0 };
        const values: AgentValues = { ...a, min_confidence: Number(a.min_confidence), monthly_cost_limit_usd: Number(a.monthly_cost_limit_usd) };
        return (
          <Card key={a.id} title={<span className="bos-row" style={{ gap: 8 }}>{a.name}{a.is_active ? <StatusBadge tone="success" label="مفعّل" /> : <StatusBadge tone="neutral" label="معطّل" />}</span>} actions={<AgentButton agent={values} categories={catOpts} />}>
            <KeyValues items={[
              { label: "الأسلوب", value: <Tx>{toneLabels[a.tone]}</Tx> },
              { label: "المزود", value: a.provider ?? <Tx>حسب ترتيب مركز التكاملات</Tx> },
              { label: "أقصى ردود / أقل ثقة", value: `${a.max_ai_turns} / ${Math.round(Number(a.min_confidence) * 100)}%` },
              { label: "التكلفة هذا الشهر", value: `$${(spend.get(a.id) ?? 0).toFixed(2)}${Number(a.monthly_cost_limit_usd) > 0 ? ` / $${Number(a.monthly_cost_limit_usd).toFixed(2)}` : ""}` },
              { label: "محادثات (30 يوماً)", value: s.total },
              { label: "حُلّت بالمساعد / حُوّلت", value: `${s.resolvedByAi} / ${s.handedOff}` },
            ]} />
            <div style={{ marginTop: 12 }}><div className="bos-faint" style={{ fontSize: 12, marginBottom: 4 }}><Tx>تجربة الوكيل (لا يُحفظ شيء)</Tx></div><AgentTester agentId={a.id} /></div>
          </Card>
        );
      }) : <EmptyState title="لا يوجد وكلاء" />}
    </>
  );
}
