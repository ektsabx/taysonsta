import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { getSetting } from "@/lib/bos/settings";
import { siteUrl } from "@/lib/seo";
import { secretsConfigured } from "@/lib/bos/secrets";
import { categoryLabels, providers, type ProviderCategory } from "@/lib/bos/integrations/catalog";
import { listConnections, recentLogs, recentWebhooks } from "@/services/bos/integrations";
import { monthSpendMicros } from "@/services/bos/ai";
import { db } from "@/lib/bos/db";
import { PageHeader, Card, StatusBadge, EmptyState, Tabs, KpiCard } from "@/components/bos/ui";
import { formatDateTime } from "@/lib/bos/format";
import { SettingsNav } from "../SettingsNav";
import { SettingsForm } from "../SettingsForm";
import { AiPingButton, ConnectionActions, ConnectionButton, type ConnView } from "./HubControls";

// Integration Hub (docs/bos/30 §7, doc 31 Phase 4): every provider in one
// place — encrypted credentials, several accounts per provider, default
// account, connection tests, AI settings and usage, call and webhook logs.
export default async function IntegrationsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("integrations.manage", "all");
  const sp = await readParams(searchParams);
  const tab = ["connections", "ai", "logs", "webhooks", "system"].includes(sp.tab ?? "") ? (sp.tab as string) : "connections";
  const keyOk = secretsConfigured();
  const [conns, integrations, ai] = await Promise.all([listConnections(), getSetting("integrations"), getSetting("ai")]);
  const byProvider = new Map<string, ConnView[]>();
  for (const c of conns) (byProvider.get(c.provider) ?? byProvider.set(c.provider, []).get(c.provider)!).push({ id: c.id, label: c.label, status: c.status, is_default: c.is_default, config: c.config as Record<string, string>, secret_hint: c.secret_hint as Record<string, string> });
  const categories = [...new Set(providers.map((p) => p.category))] as ProviderCategory[];

  return (
    <>
      <PageHeader title="مركز التكاملات" subtitle="كل المزودات في مكان واحد — بيانات الاعتماد مشفّرة ولا تُعرض بعد الحفظ" breadcrumbs={[{ label: "الإعدادات" }, { label: "التكاملات" }]} />
      <SettingsNav active="integrations" />
      {!keyOk ? (
        <div className="bos-form-error" role="alert" style={{ marginBottom: 12 }}>
          <Tx>مفتاح التشفير BOS_SECRETS_KEY غير مضبوط على الخادم — لا يمكن حفظ أو قراءة بيانات الاعتماد حتى يُضبط (32 بايت بصيغة base64).</Tx>
        </div>
      ) : null}
      <Tabs param="tab" active={tab} baseHref="/admin/settings/integrations" tabs={[
        { key: "connections", label: "الحسابات", count: conns.length },
        { key: "ai", label: "الذكاء الاصطناعي" },
        { key: "logs", label: "سجل الاستدعاءات" },
        { key: "webhooks", label: "Webhooks" },
        { key: "system", label: "النظام" },
      ]} />

      {tab === "connections" ? categories.map((cat) => (
        <Card key={cat} title={categoryLabels[cat]}>
          <div className="bos-stack" style={{ gap: 14 }}>
            {providers.filter((p) => p.category === cat).map((p) => {
              const list = byProvider.get(p.key) ?? [];
              return (
                <div key={p.key} className="bos-hub-provider">
                  <div className="bos-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <strong>{p.name}</strong>
                      {p.phase > 4 ? <span className="bos-faint" style={{ fontSize: 11.5, marginInlineStart: 8 }}><Tx vars={{ phase: p.phase }}>{"تُستخدم ميزاته في المرحلة {phase}"}</Tx></span> : null}
                      <div className="bos-faint" style={{ fontSize: 12.5 }}><Tx>{p.description}</Tx></div>
                    </div>
                    {keyOk ? <ConnectionButton def={p} /> : null}
                  </div>
                  {list.length ? (
                    <table className="bos-table" style={{ marginTop: 8 }}>
                      <tbody>
                        {list.map((c) => {
                          const full = conns.find((x) => x.id === c.id)!;
                          return (
                            <tr key={c.id}>
                              <td className="cell-primary">{c.label}{c.is_default ? <span className="cell-sub"><Tx>الافتراضي</Tx></span> : null}</td>
                              <td><StatusBadge tone={c.status === "active" ? (full.last_test_ok === false ? "danger" : "success") : c.status === "error" ? "danger" : "neutral"} label={c.status === "disabled" ? "معطّل" : c.status === "error" ? "خطأ في الاتصال" : full.last_test_ok ? "يعمل" : "لم يُختبر"} /></td>
                              <td className="bos-faint" style={{ fontSize: 12 }} dir="ltr">{Object.entries(c.secret_hint).map(([k, v]) => `${k}: ${v}`).join(" · ")}</td>
                              <td className="bos-faint" style={{ fontSize: 12 }}>{full.last_tested_at ? formatDateTime(full.last_tested_at) : "—"}{full.last_error ? <span className="cell-sub bos-danger">{full.last_error.slice(0, 120)}</span> : null}</td>
                              <td><div className="bos-row" style={{ gap: 4, justifyContent: "flex-end" }}>{keyOk ? <ConnectionButton def={p} conn={c} /> : null}<ConnectionActions conn={c} testable={p.testable} /></div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : <div className="bos-faint" style={{ fontSize: 12, marginTop: 4 }}><Tx>غير مربوط</Tx></div>}
                </div>
              );
            })}
          </div>
        </Card>
      )) : null}

      {tab === "ai" ? <AiTab ai={ai} /> : null}
      {tab === "logs" ? <LogsTab provider={sp.provider} /> : null}
      {tab === "webhooks" ? <WebhooksTab /> : null}
      {tab === "system" ? (
        <Card title="تكاملات النظام">
          <p className="bos-faint" style={{ fontSize: 12.5 }}><Tx>إعدادات لا تحتاج بيانات اعتماد: المجدول، Push، Webhooks الأتمتة. البريد عبر متغيرات البيئة يبقى بديلاً إن لم يوجد حساب Resend في المركز.</Tx></p>
          <SettingsForm settingKey="integrations" value={integrations} fields={[
            { path: "email.enabled", label: "البريد (متغيرات البيئة): مفعّل", type: "boolean" }, { path: "email.provider", label: "مزود البريد", type: "select", options: [{ value: "", label: "—" }, { value: "resend", label: "Resend" }] }, { path: "email.from", label: "عنوان المرسل", type: "text" },
            { path: "scheduler.enabled", label: "المجدول: مفعّل", type: "boolean" }, { path: "push.enabled", label: "Push: مفعّل", type: "boolean" },
            { path: "webhooks.enabled", label: "Webhooks في الأتمتة: مفعّلة", type: "boolean" }, { path: "webhooks.allowed_domains", label: "النطاقات المسموحة للـ Webhooks", type: "list", hint: "example.com, hooks.zapier.com" },
          ]} />
        </Card>
      ) : null}
    </>
  );
}

async function AiTab({ ai }: { ai: Awaited<ReturnType<typeof getSetting<"ai">>> }) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [spent, { data: usage }] = await Promise.all([
    monthSpendMicros(),
    db().from("ai_usage_log").select("provider, model, feature, input_tokens, output_tokens, cost_micros, ok, fallback_from, error, created_at").gte("created_at", start.toISOString()).order("created_at", { ascending: false }).limit(200),
  ]);
  const rows = usage ?? [];
  const calls = rows.length;
  const failed = rows.filter((r) => !r.ok).length;
  const tokens = rows.reduce((s, r) => s + r.input_tokens + r.output_tokens, 0);
  return (
    <>
      <div className="bos-kpis">
        <KpiCard label="استدعاءات هذا الشهر" value={calls} sub={failed ? <Tx vars={{ failed }}>{"{failed} فاشلة"}</Tx> : undefined} />
        <KpiCard label="التوكنات" value={tokens.toLocaleString("en-US")} />
        <KpiCard label="التكلفة التقديرية" value={`$${(spent / 1_000_000).toFixed(4)}`} sub={ai.monthly_budget_usd ? <Tx vars={{ b: ai.monthly_budget_usd }}>{"من ميزانية ${b}"}</Tx> : <Tx>بدون حد</Tx>} />
      </div>
      <Card title="إعدادات الذكاء الاصطناعي" actions={<AiPingButton />}>
        <SettingsForm settingKey="ai" value={ai} fields={[
          { path: "fallback_order", label: "ترتيب المزودات (الأول يُجرّب أولاً)", type: "list", hint: "anthropic, openai, gemini" },
          { path: "monthly_budget_usd", label: "الميزانية الشهرية بالدولار (0 = بدون حد)", type: "number", min: 0 },
          { path: "prices", label: "أسعار النماذج لكل مليون توكن (للتكلفة التقديرية)", type: "json", hint: '[{"model":"claude-sonnet-5","input_per_mtok":3,"output_per_mtok":15}]' },
        ]} />
      </Card>
      <Card title="آخر الاستدعاءات" flush>
        {rows.length ? (
          <table className="bos-table responsive">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>المزود / النموذج</Tx></th><th><Tx>الميزة</Tx></th><th><Tx>التوكنات</Tx></th><th><Tx>التكلفة</Tx></th><th><Tx>النتيجة</Tx></th></tr></thead>
            <tbody>{rows.slice(0, 50).map((r, i) => <tr key={i}><td>{formatDateTime(r.created_at)}</td><td dir="ltr">{r.provider} / {r.model}</td><td dir="ltr">{r.feature}</td><td className="bos-num">{r.input_tokens} / {r.output_tokens}</td><td className="bos-num">{r.cost_micros ? `$${(Number(r.cost_micros) / 1_000_000).toFixed(5)}` : "—"}</td><td>{r.ok ? <StatusBadge tone="success" label="نجح" /> : <StatusBadge tone="danger" label={r.error?.slice(0, 60) ?? "فشل"} />}</td></tr>)}</tbody>
          </table>
        ) : <EmptyState title="لا توجد استدعاءات بعد" />}
      </Card>
    </>
  );
}

async function LogsTab({ provider }: { provider?: string }) {
  const logs = await recentLogs(150, provider && /^[a-z0-9_]+$/.test(provider) ? provider : undefined);
  return (
    <Card title="سجل الاستدعاءات" flush>
      {logs.length ? (
        <table className="bos-table responsive">
          <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>المزود</Tx></th><th><Tx>العملية</Tx></th><th><Tx>الاتجاه</Tx></th><th>HTTP</th><th><Tx>المدة</Tx></th><th><Tx>المحاولات</Tx></th><th><Tx>النتيجة</Tx></th></tr></thead>
          <tbody>{logs.map((l) => <tr key={l.id}><td>{formatDateTime(l.created_at)}</td><td dir="ltr">{l.provider}</td><td dir="ltr">{l.operation}</td><td><Tx>{l.direction === "inbound" ? "وارد" : l.direction === "test" ? "اختبار" : "صادر"}</Tx></td><td className="bos-num">{l.http_status ?? "—"}</td><td className="bos-num">{l.duration_ms != null ? `${l.duration_ms}ms` : "—"}</td><td className="bos-num">{l.attempts}</td><td>{l.ok ? <StatusBadge tone="success" label="نجح" /> : <StatusBadge tone="danger" label={l.error?.slice(0, 80) ?? "فشل"} />}</td></tr>)}</tbody>
        </table>
      ) : <EmptyState title="لا توجد سجلات بعد" />}
    </Card>
  );
}

async function WebhooksTab() {
  const events = await recentWebhooks(100);
  const withHooks = providers.filter((p) => p.webhook);
  return (
    <>
      <Card title="عناوين الاستقبال">
        <p className="bos-faint" style={{ fontSize: 12.5 }}><Tx>ضع العنوان في لوحة المزود مع سر التوقيع نفسه المحفوظ في حسابه هنا. الطلبات غير الموقّعة تُرفض، والمكررة تُتجاهل.</Tx></p>
        <table className="bos-table"><tbody>{withHooks.map((p) => <tr key={p.key}><td>{p.name}</td><td dir="ltr" style={{ fontSize: 12.5 }}>{`${siteUrl}/api/bos/webhooks/${p.key}`}</td></tr>)}</tbody></table>
      </Card>
      <Card title="آخر الأحداث الواردة" flush>
        {events.length ? (
          <table className="bos-table responsive">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>المزود</Tx></th><th><Tx>الحدث</Tx></th><th><Tx>التوقيع</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
            <tbody>{events.map((e) => <tr key={e.id}><td>{formatDateTime(e.received_at)}</td><td dir="ltr">{e.provider}</td><td dir="ltr">{e.event_type ?? "—"}</td><td>{e.signature_ok ? <StatusBadge tone="success" label="صحيح" /> : <StatusBadge tone="danger" label="مرفوض" />}</td><td><StatusBadge tone={e.status === "processed" ? "success" : e.status === "failed" ? "danger" : "neutral"} label={e.status} /></td></tr>)}</tbody>
          </table>
        ) : <EmptyState title="لا توجد أحداث بعد" />}
      </Card>
    </>
  );
}
