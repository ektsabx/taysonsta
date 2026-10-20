import Link from "next/link";
import { can, requirePermission } from "@/lib/bos/auth";
import { Card, KeyValues, PageHeader, StatusBadge } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { MessagingNotReady, NotConnected, connected } from "@/components/yolias/PlatformUi";
import { messagingReady, engineHealth, getSettings, webhookSecretHint, webhookUrl } from "@/services/yolias/messaging";
import { SettingsForm, WebhookSecretForm } from "../_ui/Forms";

// Messaging settings (D-243): sender, caps, time-based events, attribution,
// test addresses, and Resend (sending is configured on the Yolias deployment;
// the delivery webhook's signing secret is kept in Vault from here).
export default async function MessagingSettingsPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="إعدادات الرسائل" /><NotConnected /></>);
  if (!(await messagingReady())) return (<><PageHeader title="إعدادات الرسائل" /><MessagingNotReady /></>);
  const [s, health, hint] = await Promise.all([getSettings(), engineHealth(), webhookSecretHint()]);
  const canManage = can(bos, "platform.manage", "all");
  return (
    <>
      <PageHeader title="إعدادات الرسائل" subtitle="Resend للإرسال فقط؛ القواعد والتسلسلات والأتمتة والتحليلات داخل Yolias." />
      <Card title="Resend">
        <KeyValues items={[
          { label: "الإرسال", value: <StatusBadge tone={health.resend ? "success" : "danger"} label={health.resend ? "مفتاح Resend مُعدّ على Yolias" : "غير مُعدّ: الرسائل تُسجَّل «لم تُرسل» ولا يُزيَّف شيء"} /> },
          { label: "رابط Webhook", value: <code dir="ltr">{webhookUrl()}</code> },
          { label: "الأحداث المطلوبة في Resend", value: <span dir="ltr">email.sent, email.delivered, email.delivery_delayed, email.bounced, email.complained, email.opened, email.clicked, email.failed</span> },
          { label: "سر التوقيع", value: hint ? <StatusBadge tone="success" label={`محفوظ ${hint}`} /> : <StatusBadge tone="warning" label="غير محفوظ" /> },
        ]} />
        {canManage && <WebhookSecretForm hint={hint} />}
      </Card>
      {canManage ? <Card title="الإعدادات العامة"><SettingsForm s={s} /></Card> : null}
      <Card title="رسائل النظام">
        <p><Tx>إيصالات الدفع، تنبيهات الأمان، الاستخدام ونتائج البحث تُدار من صفحة رسائل النظام (تشغيل وإيقاف كل حدث).</Tx> <Link className="bos-link" href="/admin/platform/emails"><Tx>رسائل النظام</Tx></Link></p>
      </Card>
    </>
  );
}
