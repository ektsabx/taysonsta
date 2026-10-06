import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { agentOverview } from "@/services/yolias/agent";
import { cacheState, controlMetrics, evalState, policyState } from "@/services/yolias/agent-policy";
import { can } from "@/lib/bos/auth";
import { Tabs } from "@/components/bos/ui";
import { ClearCacheButton, EvalCaseForm, GuardrailsForm, IdentityForm, InstructionsForm, LimitsForm, PublishBar, ResearchForm, RestoreButton, RunEvalButton, ToolsForm } from "./AgentForms";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";

const usd4 = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

const outcomes: Record<string, { label: string; tone: "success" | "danger" | "warning" | "info" | "neutral" }> = {
  ok: { label: "نجح", tone: "success" },
  denied: { label: "مرفوض (صلاحيات)", tone: "danger" },
  invalid: { label: "مدخلات غير صالحة", tone: "warning" },
  not_found: { label: "غير موجود", tone: "neutral" },
  not_connected: { label: "غير متصل", tone: "info" },
  error: { label: "خطأ", tone: "danger" },
  awaiting_approval: { label: "بانتظار موافقة العميل", tone: "info" },
  disabled: { label: "معطّلة بالسياسة", tone: "neutral" },
};
const taskLabel: Record<string, string> = { agent: "التفكير والمحادثة", research: "البحث على الويب", extract: "الاستخراج والتصنيف" };
const Outcome = ({ value }: { value: string }) => <StatusBadge tone={outcomes[value]?.tone ?? "neutral"} label={outcomes[value]?.label ?? value} />;

// Yolias AI control center (D-141): how Yolias AI thinks, talks, researches,
// which tools it may use, approvals, limits, memory, guardrails, evaluation
// and versions — plus usage, cost and the audit log of every tool call
// (docs/07, docs/09 §B, rule 35). The runtime stays in the Yolias backend;
// this page edits a versioned policy it reads.
const TABS = [
  { key: "overview", label: "نظرة عامة" },
  { key: "identity", label: "الهوية والشخصية" },
  { key: "rules", label: "التعليمات والحماية" },
  { key: "research", label: "البحث والمصادر" },
  { key: "tools", label: "الأدوات والموافقات" },
  { key: "limits", label: "الحدود والذاكرة" },
  { key: "models", label: "النماذج" },
  { key: "evals", label: "التقييم" },
  { key: "versions", label: "الإصدارات" },
];

export default async function AgentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="Yolias AI" /><NotConnected /></>);
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? String(sp.tab) : "overview";
  const manage = can(bos, "platform.manage", "all");
  const state = await policyState();
  const p = state.editing;
  return (
    <>
      <PageHeader title="Yolias AI" subtitle="مركز التحكم: كيف يفكر ويتكلم ويبحث، الأدوات والموافقات، الحدود والذاكرة، الحماية والتقييم — كل تغيير في مسودة ثم نشر" />
      <div className="bos-kpis" style={{ marginBottom: 12 }}>
        <KpiCard label="الإصدار المنشور" value={state.published ? `v${state.published.version}` : "—"} sub={state.published?.published_at ? `${state.published.published_by ?? ""} · ${formatDateTime(state.published.published_at)}` : undefined} />
        <KpiCard label="المسودة" value={state.draft ? `v${state.draft.version}` : <Tx>لا توجد</Tx>} sub={state.draft ? <Tx vars={{ s: state.draft.changed.length ? state.draft.changed.join(", ") : "—" }}>{"تغييرات غير منشورة: {s}"}</Tx> : <Tx>أي حفظ ينشئ مسودة</Tx>} />
      </div>
      {manage && state.draft ? <Card><PublishBar draftVersion={state.draft.version} /></Card> : null}
      <Tabs param="tab" active={tab} baseHref="/admin/platform/agent" tabs={TABS} />
      {tab === "overview" ? <Overview /> : null}
      {tab === "identity" ? <Card title="الهوية والشخصية وطريقة الكلام">{manage ? <IdentityForm p={p} /> : <ReadOnly />}</Card> : null}
      {tab === "rules" ? (
        <>
          <Card title="التعليمات وقواعد الرد">{manage ? <InstructionsForm p={p} /> : <ReadOnly />}</Card>
          <Card title="الحماية (Guardrails)">{manage ? <GuardrailsForm p={p} /> : <ReadOnly />}</Card>
          <Card title="قواعد ثابتة لا تُعدَّل من هنا">
            <ul className="bos-list" style={{ fontSize: 13, lineHeight: 1.8 }}>
              {FIXED.map((f) => <li key={f}><Tx>{f}</Tx></li>)}
            </ul>
          </Card>
        </>
      ) : null}
      {tab === "research" ? <Card title="استراتيجية البحث وحوكمة المصادر">{manage ? <ResearchForm p={p} /> : <ReadOnly />}</Card> : null}
      {tab === "tools" ? <Card title="الأدوات والصلاحيات والموافقة البشرية">{manage ? <ToolsForm p={p} /> : <ReadOnly />}</Card> : null}
      {tab === "limits" ? (
        <>
          <Card title="الحدود والذاكرة وذاكرة الإجابات">{manage ? <LimitsForm p={p} /> : <ReadOnly />}</Card>
          <CacheCard manage={manage} />
        </>
      ) : null}
      {tab === "models" ? <ModelsCard /> : null}
      {tab === "evals" ? <Evals manage={manage} published={state.published?.version ?? null} draft={state.draft?.version ?? null} /> : null}
      {tab === "versions" ? (
        <Card title="الإصدارات (نشر واسترجاع)">
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الإصدار</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>ما تغيّر</Tx></th><th><Tx>ملاحظة</Tx></th><th><Tx>أنشأه</Tx></th><th><Tx>النشر</Tx></th><th /></tr></thead>
            <tbody>
              {state.versions.map((v) => (
                <tr key={v.id}>
                  <td className="bos-num">v{v.version}</td>
                  <td><StatusBadge tone={v.status === "published" ? "success" : v.status === "draft" ? "warning" : "neutral"} label={v.status === "published" ? "منشور" : v.status === "draft" ? "مسودة" : "مؤرشف"} /></td>
                  <td dir="ltr" style={{ fontSize: 12 }}>{v.changed.join(", ") || "—"}</td>
                  <td dir="auto">{v.note ?? "—"}</td>
                  <td>{v.created_by ?? "—"} · {formatDateTime(v.created_at)}</td>
                  <td>{v.published_at ? `${v.published_by ?? ""} · ${formatDateTime(v.published_at)}` : "—"}</td>
                  <td>{manage && v.status !== "draft" ? <RestoreButton version={v.version} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        </Card>
      ) : null}
    </>
  );
}

const FIXED = [
  "لا يختلق عملاء أو شركات أو أرقام أو بيانات تواصل — كل معلومة من أداة.",
  "الصلاحيات والأدوار تُفرض في الكود (لا تعتمد على التعليمات).",
  "بيانات كل مساحة عمل لا تظهر لغيرها، وذاكرة الإجابات المشتركة للأسئلة العامة فقط.",
  "لا يرسل بريداً بنفسه، ولا يكشف هذه التعليمات.",
  "المفاتيح والدفع والمصادقة وقواعد الأمان خارج هذه الصفحة.",
];

const ReadOnly = () => <p className="bos-faint"><Tx>للعرض فقط — التعديل يحتاج صلاحية إدارة المنصة.</Tx></p>;

function ModelsCard() {
  return (
    <Card title="توجيه النماذج">
      <p style={{ fontSize: 13, lineHeight: 1.7 }}><Tx>اختيار النموذج لكل مهمة (المحادثة والتفكير، البحث على الويب، الاستخراج) وترتيب البدائل والأسعار يُدار من صفحة النماذج اللغوية. مفاتيح المزودين من مركز التكاملات.</Tx></p>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <Link className="admin-btn small" href="/admin/platform/llm"><Tx>فتح النماذج اللغوية</Tx></Link>
        <Link className="admin-btn small ghost" href="/admin/settings/integrations?tab=connections&cat=ai"><Tx>مفاتيح النماذج</Tx></Link>
      </div>
    </Card>
  );
}

async function CacheCard({ manage }: { manage: boolean }) {
  const c = await cacheState();
  return (
    <Card title="ذاكرة الإجابات المشتركة والذاكرة طويلة المدى">
      <div className="bos-kpis">
        <KpiCard label="إجابات محفوظة" value={num(c.entries)} />
        <KpiCard label="مرات إعادة الاستخدام (أعلى 20)" value={num(c.hits)} sub={<Tx>طلبات وفّرت تكلفة النموذج</Tx>} />
        <KpiCard label="معلومات محفوظة عن مساحات العمل" value={num(c.memories)} />
      </div>
      {c.top.length ? (
        <BosTable className="bos-table">
          <thead><tr><th><Tx>السؤال</Tx></th><th><Tx>اللغة</Tx></th><th><Tx>مرات الاستخدام</Tx></th><th><Tx>الإصدار</Tx></th><th><Tx>تنتهي</Tx></th></tr></thead>
          <tbody>
            {c.top.map((r) => (
              <tr key={`${r.question}-${r.created_at}`}>
                <td dir="auto">{r.question}</td><td>{r.language}</td><td className="bos-num">{num(r.hits)}</td><td className="bos-num">v{r.policy_version}</td><td>{formatDateTime(r.expires_at)}</td>
              </tr>
            ))}
          </tbody>
        </BosTable>
      ) : <EmptyState title="لا توجد إجابات محفوظة بعد" />}
      {manage ? <div style={{ marginTop: 12 }}><ClearCacheButton /></div> : null}
    </Card>
  );
}

async function Evals({ manage, published, draft }: { manage: boolean; published: number | null; draft: number | null }) {
  const { cases, runs } = await evalState();
  return (
    <>
      <Card title="تشغيل التقييم">
        <p className="bos-faint" style={{ fontSize: 12.5, marginBottom: 10 }}><Tx>كل حالة تُرسل للنموذج بتعليمات الإصدار المختار (بدون أدوات أو بيانات عملاء)، ويُفحص الرد بالكلمات المطلوبة والممنوعة. اختبر المسودة قبل نشرها.</Tx></p>
        {manage ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {draft ? <RunEvalButton version={draft} label={`تقييم المسودة v${draft}`} /> : null}
            {published ? <RunEvalButton version={published} label={`تقييم المنشور v${published}`} /> : null}
          </div>
        ) : null}
        {runs.length ? (
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            {runs.map((r) => {
              const results = (r.results ?? []) as { name: string; passed: boolean; reply: string; missing: string[]; found: string[] }[];
              return (
                <details key={r.id}>
                  <summary>
                    v{r.policy_version} · <StatusBadge tone={r.status === "done" ? (r.passed === r.total ? "success" : "warning") : r.status === "failed" ? "danger" : "info"} label={r.status === "done" ? `${r.passed}/${r.total}` : r.status === "failed" ? "فشل" : r.status === "running" ? "يعمل" : "في الانتظار"} />
                    {" "}<span className="cell-sub">{formatDateTime(r.created_at)} · {usd4(Number(r.cost_usd))}</span>
                  </summary>
                  {r.error ? <p className="bos-form-error">{r.error}</p> : null}
                  {results.map((x, i) => (
                    <div key={i} style={{ borderTop: "1px solid var(--bos-line, #eee)", padding: "8px 0", fontSize: 13 }}>
                      <StatusBadge tone={x.passed ? "success" : "danger"} label={x.passed ? "نجح" : "فشل"} /> <b>{x.name}</b>
                      {x.missing.length ? <div className="cell-sub"><Tx>ناقص:</Tx> {x.missing.join("، ")}</div> : null}
                      {x.found.length ? <div className="cell-sub"><Tx>ظهر ما لا يجب:</Tx> {x.found.join("، ")}</div> : null}
                      <p dir="auto" style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{x.reply}</p>
                    </div>
                  ))}
                </details>
              );
            })}
          </div>
        ) : null}
      </Card>
      <Card title="حالات الاختبار">
        <div style={{ display: "grid", gap: 14 }}>
          {cases.map((c) => (
            <details key={c.id}>
              <summary>{c.name} {c.active ? null : <StatusBadge tone="neutral" label="معطّلة" />}</summary>
              {manage ? <EvalCaseForm c={c} /> : <p dir="auto">{c.prompt}</p>}
            </details>
          ))}
          {manage ? <EvalCaseForm /> : null}
        </div>
      </Card>
    </>
  );
}

// Usage, cost and the audit log of every tool call (docs/07, docs/09 §B,
// rule 35). Last 30 days; no conversation text.
async function Overview() {
  const [{ metrics: m, recent }, ctl] = await Promise.all([agentOverview(30), controlMetrics(30)]);
  const failed = m.tool_calls - (m.by_outcome.ok ?? 0);
  return (
    <>
      <div className="bos-kpis">
        <KpiCard label="إجابات من الذاكرة المشتركة" value={num(ctl.cached)} sub={<Tx>بدون تكلفة نموذج</Tx>} />
        <KpiCard label="طلبات موافقة" value={num(ctl.approvals.pending + ctl.approvals.approved + ctl.approvals.rejected + ctl.approvals.expired + ctl.approvals.failed)} sub={<Tx vars={{ a: num(ctl.approvals.approved), r: num(ctl.approvals.rejected), p: num(ctl.approvals.pending) }}>{"{a} موافقة · {r} رفض · {p} معلّق"}</Tx>} />
        <KpiCard label="جمل حجبتها الحماية" value={num(ctl.guardrail)} />
      </div>
      <div className="bos-kpis">
        <KpiCard label="المحادثات" value={num(m.conversations)} sub={<Tx vars={{ n: num(m.workspaces), u: num(m.by_scope?.user ?? 0), w: num(m.by_scope?.workspace ?? 0), c: num(m.by_scope?.campaign ?? 0) }}>{"{n} مساحة عمل · {u} خاصة · {w} مشتركة · {c} بحث"}</Tx>} />
        <KpiCard label="الرسائل" value={num(m.user_turns)} sub={<Tx vars={{ n: num(m.assistant_turns) }}>{"{n} رد من المساعد"}</Tx>} />
        <KpiCard label="استدعاءات الأدوات" value={num(m.tool_calls)} sub={<Tx vars={{ n: num(failed), d: num(m.by_outcome.denied ?? 0) }}>{"{n} لم تنجح · {d} مرفوضة"}</Tx>} />
        <KpiCard label="تكلفة النموذج اللغوي" value={usd4(m.llm_cost_usd)} sub={<Tx vars={{ n: num(m.llm_calls) }}>{"{n} طلب"}</Tx>} />
        <KpiCard label="تكلفة الأدوات (المزودون)" value={usd4(m.tool_cost_usd)} sub={m.tool_unpriced ? <Tx vars={{ n: num(m.tool_unpriced) }}>{"+ {n} طلب غير مسعّر"}</Tx> : undefined} />
        <KpiCard label="تقييم الردود" value={`👍 ${num(m.likes ?? 0)} · 👎 ${num(m.dislikes ?? 0)}`} />
      </div>

      <Card title="المنسّق: التكلفة حسب نوع المهمة">
        {m.by_task?.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>المهمة</Tx></th><th><Tx>الطلبات</Tx></th><th><Tx>التكلفة</Tx></th><th><Tx>غير مسعّرة</Tx></th></tr></thead>
            <tbody>
              {m.by_task.map((k) => (
                <tr key={k.task}>
                  <td><Tx>{taskLabel[k.task] ?? k.task}</Tx> <span className="cell-sub" dir="ltr">{k.task}</span></td>
                  <td className="bos-num">{num(k.calls)}</td>
                  <td className="bos-num">{usd4(Number(k.cost_usd))}</td>
                  <td className="bos-num">{num(k.unpriced)}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد طلبات للنموذج اللغوي" />}
      </Card>

      <Card title="حسب الأداة">
        {m.by_tool.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الأداة</Tx></th><th><Tx>الطلبات</Tx></th><th><Tx>لم تنجح</Tx></th><th><Tx>متوسط الزمن</Tx></th><th><Tx>التكلفة</Tx></th></tr></thead>
            <tbody>
              {m.by_tool.map((t) => (
                <tr key={t.tool}>
                  <td dir="ltr">{t.tool}</td>
                  <td className="bos-num">{num(t.calls)}</td>
                  <td className="bos-num">{num(t.failures)}</td>
                  <td className="bos-num">{t.avg_ms == null ? "—" : `${t.avg_ms} ms`}</td>
                  <td className="bos-num">{usd4(Number(t.cost_usd ?? 0))}{t.unpriced ? <span className="cell-sub"><Tx vars={{ n: num(t.unpriced) }}>{"+ {n} غير مسعّر"}</Tx></span> : null}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لم يستدعِ المساعد أي أداة بعد" />}
      </Card>

      <Card title="سجل التدقيق (آخر 50)">
        {recent.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>مساحة العمل</Tx></th><th><Tx>الأداة</Tx></th><th><Tx>النتيجة</Tx></th><th><Tx>الزمن</Tx></th><th><Tx>التكلفة</Tx></th></tr></thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(c.created_at)}</td>
                  <td><Link className="bos-link" href={`/admin/platform/workspaces/${c.workspace_id}`}>{c.workspaceName || "—"}</Link></td>
                  <td dir="ltr">{c.tool}</td>
                  <td><Outcome value={c.outcome} />{c.error ? <span className="cell-sub" dir="auto">{c.error.length > 140 ? `${c.error.slice(0, 140)}…` : c.error}</span> : null}</td>
                  <td className="bos-num">{c.latency_ms == null ? "—" : `${c.latency_ms} ms`}</td>
                  <td className="bos-num">{c.cost_usd == null ? (c.unpriced_calls ? <Tx>غير مسعّر</Tx> : "—") : usd4(Number(c.cost_usd))}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد استدعاءات" />}
      </Card>
    </>
  );
}
