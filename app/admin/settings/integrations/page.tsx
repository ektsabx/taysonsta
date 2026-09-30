import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
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
import { SettingsForm } from "../SettingsForm";
import Link from "next/link";
import { AiPingButton, ConnectionButton, ProviderManage, type ConnView } from "./HubControls";
import { connState } from "@/lib/bos/integrations/state";

// Integration Hub (docs/bos/30 §7, doc 31 Phase 4): every provider in one
// place — encrypted credentials, several accounts per provider, default
// account, connection tests, AI settings and usage, call and webhook logs.
export default async function IntegrationsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("integrations.manage", "all");
  const sp = await readParams(searchParams);
  const tab = ["connections", "ai", "logs", "webhooks", "system"].includes(sp.tab ?? "") ? (sp.tab as string) : "connections";
  const keyOk = secretsConfigured();
  const [conns, integrations, ai] = await Promise.all([listConnections(), getSetting("integrations"), getSetting("ai")]);
  const byProvider = new Map<string, ConnView[]>();
  for (const c of conns) (byProvider.get(c.provider) ?? byProvider.set(c.provider, []).get(c.provider)!).push({ id: c.id, label: c.label, status: c.status, is_default: c.is_default, config: c.config as Record<string, string>, secret_hint: c.secret_hint as Record<string, string>, last_test_ok: c.last_test_ok, last_tested_at: c.last_tested_at, last_error: c.last_error });
  const categories = [...new Set(providers.map((p) => p.category))] as ProviderCategory[];
  // Provider status = best account status; "connected" needs a passed live test.
  const provState = (key: string, testable: boolean) => {
    const list = byProvider.get(key) ?? [];
    if (!list.length) return "available" as const;
    const states = list.map((c) => connState(c, testable).tone);
    if (states.includes("success")) return "connected" as const;
    if (states.includes("danger")) return "error" as const;
    return "pending" as const;
  };
  // Identity colour per provider for the card mark (no third-party logos bundled).
  const brandHue: Record<string, string> = { resend: "#111827", openai: "#10a37f", gemini: "#4285f4", anthropic: "#d97757", whatsapp_cloud: "#25d366", twilio: "#f22f46", google_maps: "#34a853", google_workspace: "#4285f4", meta: "#0866ff", telegram: "#27a7e7", linkedin: "#0a66c2", tiktok: "#111111", google_ads: "#fbbc04", docusign: "#4c00ff" };
  const stateMeta = { connected: { tone: "success", label: "متصل" }, error: { tone: "danger", label: "يحتاج إصلاح" }, pending: { tone: "warning", label: "محفوظ — لم يُتحقق" }, available: { tone: "neutral", label: "غير مربوط" } } as const;
  const counts = { connected: 0, error: 0, pending: 0, available: 0 };
  for (const p of providers) counts[provState(p.key, p.testable)]++;
  const cat = categories.includes(sp.cat as ProviderCategory) ? (sp.cat as ProviderCategory) : null;
  const statusFilter = ["connected", "error", "pending", "available"].includes(sp.status ?? "") ? (sp.status as keyof typeof counts) : null;
  const shown = providers.filter((p) => (!cat || p.category === cat) && (!statusFilter || provState(p.key, p.testable) === statusFilter));
  const fmt: Record<string, string> = Object.fromEntries(conns.filter((c) => c.last_tested_at).map((c) => [c.id, formatDateTime(c.last_tested_at)]));
  const qs = (patch: Record<string, string | null>) => {
    const u = new URLSearchParams({ tab: "connections", ...(cat ? { cat } : {}), ...(statusFilter ? { status: statusFilter } : {}) });
    for (const [k, v] of Object.entries(patch)) { if (v) u.set(k, v); else u.delete(k); }
    return `/admin/settings/integrations?${u.toString()}`;
  };

  return (
    <>
      <PageHeader title="مركز التكاملات" subtitle="اربط خدماتك الخارجية وتحقق من حالتها — المفاتيح تُحفظ مشفّرة ولا تُعرض بعد الحفظ" />
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

      {tab === "connections" ? (
        <>
          <div className="bos-int-grid" style={{ marginBottom: 14 }}>
            {[
              { href: "/admin/settings/integrations/widgets", title: "ويدجت الموقع", desc: "نافذة محادثة الدعم وزر واتساب لموقعك — أكواد التضمين والنطاقات المسموحة.", show: can(bos, "conversations.manage", "all") || can(bos, "messaging.manage") },
              { href: "/admin/settings/integrations/social", title: "الحسابات الاجتماعية", desc: "صفحات وحسابات النشر المربوطة بالمنصات الاجتماعية.", show: can(bos, "social.manage") },
              { href: "/admin/settings/integrations/ads", title: "الحسابات الإعلانية", desc: "حسابات Meta وGoogle Ads للقراءة، وحسابات الاستيراد من CSV.", show: can(bos, "ads.manage") },
            ].filter((x) => x.show).map((x) => (
              <Link key={x.href} href={x.href} className="bos-int-tile bos-report-tile">
                <strong>{<Tx>{x.title}</Tx>}</strong>
                <p className="bos-int-desc"><Tx>{x.desc}</Tx></p>
                <span className="bos-link" style={{ fontSize: 12.5 }}><Tx>إدارة</Tx></span>
              </Link>
            ))}
          </div>
          <div className="bos-kpis">
            {(["connected", "error", "pending", "available"] as const).map((k) => (
              <Link key={k} href={qs({ status: statusFilter === k ? null : k })} className={`bos-int-kpi${statusFilter === k ? " on" : ""}`}>
                <span className={`bos-int-dot tone-${stateMeta[k].tone}`} />
                <span className="bos-int-kpi-label"><Tx>{stateMeta[k].label}</Tx></span>
                <strong>{counts[k]}</strong>
              </Link>
            ))}
          </div>
          <nav className="bos-chips" aria-label="categories">
            <Link href={qs({ cat: null })} className={!cat ? "on" : undefined}><Tx>الكل</Tx></Link>
            {categories.map((c) => <Link key={c} href={qs({ cat: c })} className={cat === c ? "on" : undefined}><Tx>{categoryLabels[c]}</Tx></Link>)}
          </nav>
          {shown.length ? (
            <div className="bos-int-grid">
              {shown.map((p) => {
                const list = byProvider.get(p.key) ?? [];
                const st = provState(p.key, p.testable);
                return (
                  <article key={p.key} className="bos-int-tile">
                    <div className="bos-int-tile-head">
                      <span className="bos-int-mark" style={{ background: brandHue[p.key] ?? "var(--bos-secondary)" }} aria-hidden>{p.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || p.name.slice(0, 1)}</span>
                      <div style={{ minWidth: 0 }}>
                        <strong>{p.name}</strong>
                        <div className="bos-faint" style={{ fontSize: 11.5 }}><Tx>{categoryLabels[p.category]}</Tx></div>
                      </div>
                    </div>
                    <p className="bos-int-desc"><Tx>{p.description}</Tx></p>
                    <div className="bos-int-tile-foot">
                      <span className="bos-int-state"><span className={`bos-int-dot tone-${stateMeta[st].tone}`} /><Tx>{stateMeta[st].label}</Tx>{list.length > 1 ? <> · <Tx vars={{ n: list.length }}>{"{n} حساب"}</Tx></> : null}</span>
                      {list.length ? <ProviderManage def={p} conns={list} keyOk={keyOk} fmt={fmt} /> : keyOk ? <ConnectionButton def={p} label="ربط" /> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <Card><EmptyState title="لا توجد تكاملات بهذا الفلتر" /></Card>}
        </>
      ) : null}

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
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>المزود / النموذج</Tx></th><th><Tx>الميزة</Tx></th><th><Tx>التوكنات</Tx></th><th><Tx>التكلفة</Tx></th><th><Tx>النتيجة</Tx></th></tr></thead>
            <tbody>{rows.slice(0, 50).map((r, i) => <tr key={i}><td>{formatDateTime(r.created_at)}</td><td dir="ltr">{r.provider} / {r.model}</td><td dir="ltr">{r.feature}</td><td className="bos-num">{r.input_tokens} / {r.output_tokens}</td><td className="bos-num">{r.cost_micros ? `$${(Number(r.cost_micros) / 1_000_000).toFixed(5)}` : "—"}</td><td>{r.ok ? <StatusBadge tone="success" label="نجح" /> : <StatusBadge tone="danger" label={r.error?.slice(0, 60) ?? "فشل"} />}</td></tr>)}</tbody>
          </BosTable>
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
        <BosTable className="bos-table responsive">
          <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>المزود</Tx></th><th><Tx>العملية</Tx></th><th><Tx>الاتجاه</Tx></th><th>HTTP</th><th><Tx>المدة</Tx></th><th><Tx>المحاولات</Tx></th><th><Tx>النتيجة</Tx></th></tr></thead>
          <tbody>{logs.map((l) => <tr key={l.id}><td>{formatDateTime(l.created_at)}</td><td dir="ltr">{l.provider}</td><td dir="ltr">{l.operation}</td><td><Tx>{l.direction === "inbound" ? "وارد" : l.direction === "test" ? "اختبار" : "صادر"}</Tx></td><td className="bos-num">{l.http_status ?? "—"}</td><td className="bos-num">{l.duration_ms != null ? `${l.duration_ms}ms` : "—"}</td><td className="bos-num">{l.attempts}</td><td>{l.ok ? <StatusBadge tone="success" label="نجح" /> : <StatusBadge tone="danger" label={l.error?.slice(0, 80) ?? "فشل"} />}</td></tr>)}</tbody>
        </BosTable>
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
        <BosTable className="bos-table"><tbody>{withHooks.map((p) => <tr key={p.key}><td>{p.name}</td><td dir="ltr" style={{ fontSize: 12.5 }}>{`${siteUrl}/api/bos/webhooks/${p.key}`}</td></tr>)}</tbody></BosTable>
      </Card>
      <Card title="آخر الأحداث الواردة" flush>
        {events.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>المزود</Tx></th><th><Tx>الحدث</Tx></th><th><Tx>التوقيع</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
            <tbody>{events.map((e) => <tr key={e.id}><td>{formatDateTime(e.received_at)}</td><td dir="ltr">{e.provider}</td><td dir="ltr">{e.event_type ?? "—"}</td><td>{e.signature_ok ? <StatusBadge tone="success" label="صحيح" /> : <StatusBadge tone="danger" label="مرفوض" />}</td><td><StatusBadge tone={e.status === "processed" ? "success" : e.status === "failed" ? "danger" : "neutral"} label={e.status} /></td></tr>)}</tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد أحداث بعد" />}
      </Card>
    </>
  );
}
