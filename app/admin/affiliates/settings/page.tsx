import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { program, programHistory } from "@/services/yolias/affiliates";
import { ProgramForm } from "../AffiliateForms";

// Program settings (D-178). Each save is a new version; commissions keep the
// version they were calculated with, so a change never rewrites history.
export default async function AffiliateSettingsPage() {
  const { bos } = await requirePermission("affiliates.read");
  if (!connected()) return (<><PageHeader title="إعدادات البرنامج" /><NotConnected /></>);
  const [p, history] = await Promise.all([program(), programHistory()]);
  const canEdit = can(bos, "affiliates.manage", "all");
  if (!p) return (<><PageHeader title="إعدادات البرنامج" /><EmptyState title="لا توجد إعدادات" description="طبّق migration برنامج الأفلييت على قاعدة يولياس." /></>);
  const s = p.settings;
  const raw = (p.raw ?? {}) as { excluded_workspaces?: string[]; excluded_emails?: string[]; risk?: { hold_same_ip?: boolean; max_signups_per_ip_day?: number } };
  return (
    <>
      <PageHeader title="إعدادات البرنامج" subtitle={<Tx vars={{ v: p.versionId, d: formatDateTime(p.createdAt), by: p.createdBy }}>{"الإصدار {v} · {d} · {by}"}</Tx>} />
      {!canEdit ? <p className="bos-faint"><Tx>للعرض فقط. تعديل الإعدادات يحتاج صلاحية «affiliates.manage».</Tx></p> : null}
      <Card>
        <ProgramForm canEdit={canEdit} v={{
          enabled: s.enabled, autoApprove: s.autoApprove, questions: s.questions,
          commissionType: s.commission.type, percent: s.commission.percentBps / 100, fixedUsd: s.commission.fixedCents / 100,
          plans: s.eligible.plans, periods: s.eligible.periods, packs: s.eligible.packs,
          recurring: s.recurring.enabled, maxPayments: s.recurring.maxPayments, packMonths: s.recurring.packMonths, attributionDays: s.attribution.days, model: s.attribution.model,
          minPaymentUsd: s.minPaymentCents / 100, holdDays: s.holdDays, minPayoutUsd: s.minPayoutCents / 100,
          excludedWorkspaces: raw.excluded_workspaces ?? [], excludedEmails: raw.excluded_emails ?? [],
          holdSameIp: raw.risk?.hold_same_ip ?? true, maxSignupsPerIpDay: raw.risk?.max_signups_per_ip_day ?? 3,
          payoutMethods: s.payoutMethods, includeTestPayments: s.includeTestPayments, notifyAffiliates: s.notifyAffiliates,
          termsVersion: p.termsVersion, terms: p.terms,
        }} />
      </Card>
      <Card title="سياسة الحساب (ثابتة في الكود)">
        <ul className="aff-policy">
          <li><Tx>تُحسب العمولة على المبلغ الذي دفعه العميل بالدولار للخطة أو الباقة كما سُجّل في الدفعة. لا تضيف يولياس ضرائب منفصلة على الفاتورة، ولا تُخصم رسوم مزود الدفع لأنها غير معروفة لكل عملية.</Tx></li>
          <li><Tx>لا عمولة على التسجيل المجاني أو الدفع الفاشل أو غير المكتمل: العمولة تُنشأ فقط عند اكتمال تفعيل دفعة مؤكدة بتوقيع Paymob.</Tx></li>
          <li><Tx>الاسترداد يعكس العمولة تلقائيًا. النزاعات (Chargeback) لا يرسلها Paymob حاليًا: يعكسها الفريق يدويًا من صفحة العمولات.</Tx></li>
          <li><Tx>عمولة دُفعت ثم عُكست: يُسجّل قيد سالب يُخصم من الرصيد القادم، ولا يُعدّل السجل القديم.</Tx></li>
        </ul>
      </Card>
      <Card title="سجل الإصدارات">
        {history.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>الإصدار</Tx></th><th><Tx>الشروط</Tx></th><th><Tx>بواسطة</Tx></th><th><Tx>التاريخ</Tx></th><th><Tx>ملاحظة</Tx></th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}><td>{h.id}</td><td dir="ltr">{h.terms_version}</td><td dir="ltr">{h.created_by}</td><td>{formatDateTime(h.created_at)}</td><td>{h.note ?? "—"}</td></tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        ) : null}
      </Card>
    </>
  );
}
