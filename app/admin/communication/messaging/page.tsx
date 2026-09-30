import Link from "next/link";
import { headers } from "next/headers";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { formatDateTime } from "@/lib/bos/format";
import { listMessages } from "@/services/bos/messaging";
import { listWaWidgets, waClicks } from "@/services/bos/whatsapp-widgets";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, StatusBadge, EmptyState, Tabs, KeyValues } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { EmbedCode } from "@/app/admin/support/widgets/WidgetControls";
import { ConsentForm, RetryMessage, SendMessageForm, SyncTemplates, TemplateButton, WaWidgetButton, type TemplateOpt } from "./MessagingControls";

const statusTone = { queued: "info", sent: "info", delivered: "success", read: "success", failed: "danger", skipped: "neutral" } as const;
const statusLabels: Record<string, string> = { queued: "بالانتظار", sent: "أُرسل", delivered: "وصل", read: "قُرئ", failed: "فشل", skipped: "لم يُرسل" };
const providerStatus: Record<string, string> = { local: "محلي", pending: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض", paused: "موقوف مؤقتاً", disabled: "معطّل" };
const mask = (p: string) => `+${p.slice(0, Math.max(0, p.length - 7))}•••${p.slice(-4)}`;

// WhatsApp & SMS (docs/bos/30 §11): send log with delivery states and retry,
// compose, templates (synced from Meta), consent/opt-out, click-to-WhatsApp.
export default async function MessagingPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("messaging.read");
  const sp = await readParams(searchParams);
  const manage = can(bos, "messaging.manage");
  const tabs = ["log", ...(can(bos, "messaging.create") ? ["send"] : []), "templates", ...(can(bos, "messaging.create") ? ["consent"] : []), ...(manage ? ["whatsapp_button"] : [])];
  const tab = tabs.includes(sp.tab ?? "") ? (sp.tab as string) : "log";
  const [{ data: tpls }, { count: waConn }, { count: smsConn }] = await Promise.all([
    db().from("message_templates").select("id, channel, name, language, body, variables, provider_status, category, is_active, synced_at").order("channel").order("name"),
    db().from("integration_connections").select("id", { count: "exact", head: true }).eq("provider", "whatsapp_cloud").eq("status", "active"),
    db().from("integration_connections").select("id", { count: "exact", head: true }).eq("provider", "twilio").eq("status", "active"),
  ]);
  const templates = (tpls ?? []) as TemplateOpt[];
  return (
    <>
      <PageHeader title="واتساب و SMS" subtitle="رسائل للعملاء والموظفين عبر مزوّدي مركز التكاملات، مع حالة التسليم والموافقات" breadcrumbs={[{ label: "التواصل" }, { label: "واتساب و SMS" }]} />
      {!waConn || !smsConn ? (
        <Card><p className="bos-hint" style={{ margin: 0 }}>{!waConn ? <><Tx>واتساب للأعمال غير متصل.</Tx> </> : null}{!smsConn ? <><Tx>Twilio SMS غير متصل.</Tx> </> : null}<Tx>الرسائل على قناة غير متصلة تُسجّل كـ«لم يُرسل». اربطها من</Tx> <Link href="/admin/settings/integrations"><Tx>مركز التكاملات</Tx></Link>.</p></Card>
      ) : null}
      <Tabs param="tab" active={tab} baseHref="/admin/communication/messaging" tabs={[
        { key: "log", label: "سجل الرسائل" },
        { key: "send", label: "إرسال", hidden: !tabs.includes("send") },
        { key: "templates", label: "القوالب" },
        { key: "consent", label: "الموافقات وإلغاء الاشتراك", hidden: !tabs.includes("consent") },
        { key: "whatsapp_button", label: "زر واتساب للموقع", hidden: !manage },
      ]} />
      {tab === "log" ? <Log bos={bos} sp={sp} /> : null}
      {tab === "send" ? <Card title="رسالة جديدة"><SendMessageForm templates={templates} canMarketing={manage} defaults={{ to: sp.to ?? "", channel: sp.channel ?? undefined }} /></Card> : null}
      {tab === "templates" ? <Templates templates={templates} manage={manage} /> : null}
      {tab === "consent" ? <Consent /> : null}
      {tab === "whatsapp_button" ? <WaButtons /> : null}
    </>
  );
}

async function Log({ bos, sp }: { bos: Awaited<ReturnType<typeof requirePermission>>["bos"]; sp: Record<string, string | undefined> }) {
  const [rows, names] = await Promise.all([listMessages(bos, { status: sp.status, channel: sp.channel, q: sp.q }), userNameMap()]);
  return (
    <>
      <FilterBar searchPlaceholder="بحث بالرقم..." filters={[
        { key: "channel", label: "القناة", type: "select", options: [{ value: "whatsapp", label: "واتساب" }, { value: "sms", label: "SMS" }] },
        { key: "status", label: "الحالة", type: "select", options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })) },
      ]} />
      <Card flush>
        {rows.length ? (
          <table className="bos-table">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>القناة</Tx></th><th><Tx>إلى</Tx></th><th><Tx>الرسالة</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>بواسطة</Tx></th><th /></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="bos-nowrap">{formatDateTime(m.created_at)}</td>
                  <td><Tx>{m.channel === "whatsapp" ? "واتساب" : "SMS"}</Tx>{m.purpose === "marketing" ? <> · <span className="bos-tag"><Tx>تسويقي</Tx></span></> : null}</td>
                  <td dir="ltr" className="bos-nowrap">{mask(m.to_phone)}</td>
                  <td style={{ maxWidth: 360 }}><div className="bos-truncate" dir="auto" title={m.body}>{(m.message_templates as { name: string } | null)?.name ? <span className="bos-tag" style={{ marginInlineEnd: 4 }}>{(m.message_templates as { name: string }).name}</span> : null}{m.body}</div></td>
                  <td><StatusBadge tone={statusTone[m.status as keyof typeof statusTone] ?? "neutral"} label={statusLabels[m.status] ?? m.status} />{m.error ? <div className="bos-faint" style={{ fontSize: 11 }} title={m.error}>{m.error.slice(0, 80)}</div> : null}</td>
                  <td>{m.created_by ? names.get(m.created_by) ?? "—" : <Tx>النظام</Tx>}</td>
                  <td>{["failed", "skipped"].includes(m.status) ? <RetryMessage id={m.id} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد رسائل" />}
      </Card>
    </>
  );
}

function Templates({ templates, manage }: { templates: (TemplateOpt & { synced_at?: string | null })[]; manage: boolean }) {
  return (
    <Card title="قوالب الرسائل" actions={manage ? <span className="bos-row" style={{ gap: 6 }}><SyncTemplates /><TemplateButton /></span> : null} flush>
      <p className="bos-hint" style={{ padding: "8px 14px 0" }}><Tx>قوالب واتساب تُنشأ وتُعتمد في WhatsApp Manager لدى Meta ثم تُزامن هنا؛ الرسائل خارج نافذة الـ24 ساعة والرسائل التسويقية تُرسل بقالب معتمد فقط. قوالب SMS محلية.</Tx> <Tx>للإشعارات عبر واتساب أنشئ قالباً باسم</Tx> <code dir="ltr">bos_notification</code> <Tx>بمتغيرين: العنوان والتفاصيل.</Tx></p>
      {templates.length ? (
        <table className="bos-table">
          <thead><tr><th><Tx>الاسم</Tx></th><th><Tx>القناة</Tx></th><th><Tx>اللغة</Tx></th><th><Tx>الفئة</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>النص</Tx></th><th /></tr></thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td dir="ltr">{t.name}</td>
                <td><Tx>{t.channel === "whatsapp" ? "واتساب" : "SMS"}</Tx></td>
                <td dir="ltr">{t.language}</td>
                <td><Tx>{{ utility: "خدمي", marketing: "تسويقي", authentication: "مصادقة" }[t.category] ?? t.category}</Tx></td>
                <td><StatusBadge tone={t.provider_status === "approved" ? "success" : t.provider_status === "rejected" ? "danger" : "neutral"} label={providerStatus[t.provider_status] ?? t.provider_status} />{!t.is_active ? <> <StatusBadge tone="neutral" label="معطّل" /></> : null}</td>
                <td style={{ maxWidth: 360 }}><div className="bos-truncate" dir="auto" title={t.body}>{t.body}</div></td>
                <td>{manage ? <TemplateButton tpl={t} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <EmptyState title="لا توجد قوالب" />}
    </Card>
  );
}

async function Consent() {
  const { data } = await db().from("messaging_consents").select("*").order("updated_at", { ascending: false }).limit(200);
  return (
    <>
      <Card title="تسجيل موافقة أو إلغاء اشتراك"><ConsentForm /><p className="bos-hint"><Tx>الرسائل الخدمية تُرسل ما لم يلغِ الشخص كل الرسائل؛ التسويقية تحتاج موافقة صريحة. رد العميل بكلمة STOP أو «إلغاء» يُسجّل إلغاء الاشتراك تلقائياً.</Tx></p></Card>
      <Card flush>
        {data?.length ? (
          <table className="bos-table">
            <thead><tr><th><Tx>الرقم</Tx></th><th><Tx>القناة</Tx></th><th><Tx>النطاق</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>المصدر</Tx></th><th><Tx>آخر تحديث</Tx></th></tr></thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td dir="ltr">{mask(c.phone)}</td>
                  <td><Tx>{c.channel === "whatsapp" ? "واتساب" : "SMS"}</Tx></td>
                  <td><Tx>{c.purpose === "all" ? "كل الرسائل" : "الرسائل التسويقية"}</Tx></td>
                  <td>{c.status === "opted_in" ? <StatusBadge tone="success" label="موافق" /> : <StatusBadge tone="danger" label="ألغى الاشتراك" />}</td>
                  <td><Tx>{{ manual: "يدوي", inbound_keyword: "رد العميل (STOP)", form: "نموذج", import: "استيراد" }[c.source] ?? c.source}</Tx>{c.note ? ` · ${c.note}` : ""}</td>
                  <td>{formatDateTime(c.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد سجلات موافقة" />}
      </Card>
    </>
  );
}

async function WaButtons() {
  const [widgets, clicks, h] = await Promise.all([listWaWidgets(), waClicks(30), headers()]);
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3100"}`;
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
