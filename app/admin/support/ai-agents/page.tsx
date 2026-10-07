import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { listCategories } from "@/services/bos/knowledge";
import { agentMonthSpendUsd, agentStats, listAgents } from "@/services/bos/ai-agents";
import { PageHeader, Card, StatusBadge, EmptyState, KpiCard } from "@/components/bos/ui";
import { RelTime } from "@/components/bos/RelTime";
import { AgentButton, AgentTester, type AgentValues } from "./AgentControls";

const toneLabels: Record<string, string> = { friendly: "ودود", formal: "رسمي", concise: "مختصر" };

// AI support agent (docs/bos/30 §10.6, reorganised in docs/bos/37 §7.4):
// status, settings, knowledge sources, behaviour, test console, activity.
// Everything shown is what the agent really uses at runtime.
export default async function AiAgentsPage() {
  await requirePermission("conversations.manage", "all");
  const [agents, categories, stats, { data: kb }, { count: aiConns }, { data: widgets }, { data: recent }] = await Promise.all([
    listAgents(), listCategories(), agentStats(30),
    db().from("kb_articles").select("id, category_id").eq("status", "published").eq("ai_allowed", true).eq("audience", "public"),
    db().from("integration_connections").select("id", { count: "exact", head: true }).in("provider", ["anthropic", "openai", "gemini"]).eq("status", "active"),
    db().from("support_widgets").select("id, name, ai_agent_id, is_active"),
    db().from("bos_conversations").select("id, number, ai_agent_id, ai_turns, handed_off_at, status, created_at, support_customers(name)").not("ai_agent_id", "is", null).order("created_at", { ascending: false }).limit(40),
  ]);
  const spend = new Map(await Promise.all(agents.map(async (a) => [a.id, await agentMonthSpendUsd(a.id)] as const)));
  const catOpts = categories.map((c) => ({ value: c.id, label: c.name }));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const kbRows = kb ?? [];
  return (
    <>
      <PageHeader title="وكيل الذكاء الاصطناعي" subtitle="يرد على زوار ويدجت الموقع من قاعدة المعرفة فقط، ويحوّل إلى موظف عند الحاجة" actions={<AgentButton categories={catOpts} />} />
      <div className="bos-kpis">
        <KpiCard label="مزود الذكاء الاصطناعي" value={aiConns ? <Tx>متصل</Tx> : <Tx>غير متصل</Tx>} href="/admin/settings/integrations?cat=ai" sub={aiConns ? undefined : <Tx>كل الرسائل تُحوّل للموظفين</Tx>} />
        <KpiCard label="مقالات متاحة للوكيل" value={kbRows.length} href="/admin/support/knowledge?ai=1&status=published" />
        <KpiCard label="ويدجت مربوطة بوكيل" value={(widgets ?? []).filter((w) => w.ai_agent_id && w.is_active).length} href="/admin/settings/integrations/widgets" />
      </div>
      {agents.length ? agents.map((a) => {
        const s = stats.get(a.id) ?? { total: 0, handedOff: 0, resolvedByAi: 0 };
        const values: AgentValues = { ...a, min_confidence: Number(a.min_confidence), monthly_cost_limit_usd: Number(a.monthly_cost_limit_usd) };
        const sources = a.kb_category_ids?.length ? kbRows.filter((k) => k.category_id && a.kb_category_ids!.includes(k.category_id)) : kbRows;
        const limit = Number(a.monthly_cost_limit_usd);
        const used = spend.get(a.id) ?? 0;
        const activity = (recent ?? []).filter((c) => c.ai_agent_id === a.id).slice(0, 8);
        return (
          <Card key={a.id} title={<span className="bos-row" style={{ gap: 8 }}>{a.name}{a.is_active ? <StatusBadge tone="success" label="مفعّل" /> : <StatusBadge tone="neutral" label="معطّل" />}{!aiConns ? <StatusBadge tone="warning" label="بلا مزود متصل" /> : null}</span>} actions={<AgentButton agent={values} categories={catOpts} />}>
            <div className="bos-ai-grid">
              <section>
                <h3 className="bos-card-subtitle"><Tx>الإعدادات والسلوك</Tx></h3>
                <dl className="cx-dl">
                  <dt><Tx>الأسلوب</Tx></dt><dd><Tx>{toneLabels[a.tone] ?? a.tone}</Tx></dd>
                  <dt><Tx>اللغة</Tx></dt><dd>{a.language}</dd>
                  <dt><Tx>المزود</Tx></dt><dd>{a.provider ?? <Tx>حسب ترتيب مركز التكاملات</Tx>}</dd>
                  <dt><Tx>أقصى ردود قبل التحويل</Tx></dt><dd>{a.max_ai_turns}</dd>
                  <dt><Tx>أقل ثقة للرد</Tx></dt><dd>{Math.round(Number(a.min_confidence) * 100)}%</dd>
                  <dt><Tx>كلمات التحويل لموظف</Tx></dt><dd>{a.handoff_keywords?.length ? a.handoff_keywords.join("، ") : "—"}</dd>
                  <dt><Tx>كلمات حساسة</Tx></dt><dd>{a.sensitive_keywords?.length ? a.sensitive_keywords.join("، ") : "—"}</dd>
                  <dt><Tx>التكلفة هذا الشهر</Tx></dt><dd>${used.toFixed(2)}{limit > 0 ? ` / $${limit.toFixed(2)}` : ""}</dd>
                </dl>
              </section>
              <section>
                <h3 className="bos-card-subtitle"><Tx>مصادر المعرفة</Tx></h3>
                <p className="bos-faint" style={{ fontSize: 12.5, margin: "0 0 6px" }}>
                  {a.kb_category_ids?.length ? <Tx>التصنيفات المحددة:</Tx> : <Tx>كل المقالات المنشورة والعامة المتاحة للوكيل.</Tx>} {a.kb_category_ids?.map((id) => catName.get(id)).filter(Boolean).join("، ")}
                </p>
                <div className="bos-kpis" style={{ marginBottom: 6 }}>
                  <KpiCard label="مقالات يقرأ منها" value={sources.length} />
                  <KpiCard label="محادثات (30 يوماً)" value={s.total} />
                  <KpiCard label="حلّها / حوّلها" value={`${s.resolvedByAi} / ${s.handedOff}`} />
                </div>
                <Link className="bos-link" style={{ fontSize: 12.5 }} href="/admin/support/knowledge"><Tx>إدارة قاعدة المعرفة</Tx></Link>
              </section>
            </div>
            <section style={{ marginTop: 14 }}>
              <h3 className="bos-card-subtitle"><Tx>تجربة الوكيل</Tx> <span className="bos-faint" style={{ fontWeight: 400, fontSize: 12 }}><Tx>(لا يُحفظ شيء)</Tx></span></h3>
              <AgentTester agentId={a.id} />
            </section>
            <section style={{ marginTop: 14 }}>
              <h3 className="bos-card-subtitle"><Tx>آخر النشاط</Tx></h3>
              {activity.length ? (
                <div className="bos-stack" style={{ gap: 4 }}>
                  {activity.map((c) => (
                    <Link key={c.id} href={`/admin/support/inbox?c=${c.id}`} className="cx-other">
                      <span className="bos-ellipsis">{(c.support_customers as unknown as { name: string } | null)?.name ?? c.number} · <Tx vars={{ n: c.ai_turns }}>{"{n} رد"}</Tx></span>
                      <span className="bos-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                        <StatusBadge tone={c.handed_off_at ? "warning" : ["resolved", "closed"].includes(c.status) ? "success" : "info"} label={c.handed_off_at ? "حُوّلت لموظف" : ["resolved", "closed"].includes(c.status) ? "حُلّت" : "جارية"} />
                        <span className="bos-faint" style={{ fontSize: 11 }}><RelTime value={c.created_at} /></span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : <p className="bos-faint" style={{ fontSize: 12.5 }}><Tx>لم يتولَّ هذا الوكيل محادثات بعد.</Tx></p>}
            </section>
          </Card>
        );
      }) : <EmptyState title="لا يوجد وكيل بعد" description="أنشئ وكيلاً، اختر مصادر المعرفة، ثم اربطه بويدجت الموقع من مركز التكاملات." />}
    </>
  );
}
