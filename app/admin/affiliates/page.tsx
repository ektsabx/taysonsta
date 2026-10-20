import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { nowMs } from "@/lib/bos/clock";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, KpiCard, KeyValues, Tabs } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { overview, program } from "@/services/yolias/affiliates";
import { cents, commissionStatusLabel } from "./labels";

// Yolias Admin → Affiliates: overview (D-178). Revenue, qualifying payments,
// commission liabilities, withdrawable balances and completed payouts are
// different numbers and are labelled apart; none of them is "revenue" except
// what customers paid.
export default async function AffiliatesOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("affiliates.read");
  if (!connected()) return (<><PageHeader title="الأفلييت" /><NotConnected /></>);
  const sp = await readParams(searchParams);
  const days = ["30", "90", "365", "3650"].includes(sp.days ?? "") ? Number(sp.days) : 90;
  const since = new Date(nowMs() - days * 86_400_000).toISOString();
  const [o, p] = await Promise.all([overview(since), program()]);
  const c = (k: string) => o.commissions[k] ?? 0;
  const liabilities = c("pending") + c("approved") + c("available") + c("processing");
  return (
    <>
      <PageHeader title="الأفلييت" subtitle={<Tx>برنامج الإحالة لمسوّقي يولياس</Tx>} actions={<Link className="admin-btn secondary small" href="/admin/affiliates/settings"><Tx>إعدادات البرنامج</Tx></Link>} />
      <Tabs tabs={[{ key: "30", label: "آخر 30 يومًا" }, { key: "90", label: "آخر 90 يومًا" }, { key: "365", label: "آخر 12 شهرًا" }, { key: "3650", label: "كل الوقت" }]} active={String(days)} baseHref="/admin/affiliates" param="days" />
      <div className="bos-kpis">
        <KpiCard label="المسوّقون المعتمدون" value={num(o.affiliates.approved ?? 0)} href="/admin/affiliates/list?status=approved" />
        <KpiCard label="طلبات قيد المراجعة" value={num(o.affiliates.pending ?? 0)} href="/admin/affiliates/list?status=pending" />
        <KpiCard label="معلّقون أو مغلقون" value={num((o.affiliates.suspended ?? 0) + (o.affiliates.disabled ?? 0))} href="/admin/affiliates/list?status=suspended" />
        <KpiCard label="طلبات سحب مفتوحة" value={num(o.payoutsOpen.count)} sub={cents(o.payoutsOpen.cents)} href="/admin/affiliates/payouts?status=open" />
      </div>
      <div className="bos-kpis">
        <KpiCard label="زيارات روابط الإحالة" value={num(o.visits)} />
        <KpiCard label="تسجيلات مُحالة" value={num(o.referrals)} sub={o.visits ? <Tx vars={{ p: Math.round((o.referrals / o.visits) * 1000) / 10 }}>{"تحويل الزيارات {p}%"}</Tx> : undefined} />
        <KpiCard label="عملاء دفعوا (مؤهلون)" value={num(o.payingReferrals)} sub={o.referrals ? <Tx vars={{ p: Math.round((o.payingReferrals / o.referrals) * 1000) / 10 }}>{"تحويل التسجيلات {p}%"}</Tx> : undefined} />
        <KpiCard label="مدفوعات مؤهلة من عملاء مُحالين" value={cents(o.qualifyingPaymentsCents)} sub={<Tx>ما دفعه العملاء (إيراد يولياس)</Tx>} />
      </div>
      <Card title="العمولات في الفترة">
        <KeyValues items={[
          ...["pending", "approved", "available", "processing", "paid", "reversed", "rejected"].map((k) => ({ label: commissionStatusLabel[k], value: <Link className="bos-link" href={`/admin/affiliates/commissions?status=${k}`} dir="ltr">{cents(c(k))}</Link> })),
          { label: "التزامات عمولات غير مدفوعة", value: <strong dir="ltr">{cents(liabilities)}</strong> },
          { label: "سحوبات تم تسجيل دفعها", value: <span dir="ltr">{cents(o.payoutsPaidCents)}</span> },
        ]} />
        <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>الالتزامات = العمولات المعلّقة والمعتمدة والمتاحة وداخل طلبات السحب. المبالغ بالدولار ومحسوبة من الدفعات الحقيقية فقط (وضع الاختبار مستبعد).</Tx></p>
      </Card>
      {p ? (
        <Card title="القواعد الحالية">
          <KeyValues items={[
            { label: "حالة البرنامج", value: <Tx>{p.settings.enabled ? "مفتوح" : "متوقف"}</Tx> },
            { label: "العمولة", value: <span dir="ltr">{p.settings.commission.type === "percent" ? `${p.settings.commission.percentBps / 100}%` : cents(p.settings.commission.fixedCents)}</span> },
            { label: "شحن الرصيد", value: p.settings.eligible.packs ? <Tx vars={{ n: p.settings.recurring.packMonths }}>{"كل شحن خلال {n} شهرًا"}</Tx> : <Tx>غير مؤهل</Tx> },
            { label: "متكررة", value: <Tx vars={{ n: p.settings.recurring.maxPayments ?? "∞" }}>{p.settings.recurring.enabled ? "نعم، حتى {n} دفعة" : "الدفعة الأولى فقط"}</Tx> },
            { label: "مدة الإسناد", value: <Tx vars={{ n: p.settings.attribution.days }}>{p.settings.attribution.model === "first_touch" ? "{n} يومًا، أول رابط" : "{n} يومًا، آخر رابط"}</Tx> },
            { label: "فترة الانتظار", value: <Tx vars={{ n: p.settings.holdDays }}>{"{n} يومًا"}</Tx> },
            { label: "الحد الأدنى للسحب", value: <span dir="ltr">{cents(p.settings.minPayoutCents)}</span> },
            { label: "إصدار الشروط", value: <span dir="ltr">{p.termsVersion}</span> },
          ]} />
        </Card>
      ) : null}
    </>
  );
}
