import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, EmptyState, KpiCard, KeyValues, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { yoliasPlans, type YoliasPlan } from "@/lib/yolias/plans";
import { getWorkspace } from "@/services/yolias/platform";
import { NotConnected, connected, PlanBadge, SearchStatus, CampaignStatus, num, usd } from "@/components/yolias/PlatformUi";

const roleLabel: Record<string, string> = { owner: "المالك", admin: "مسؤول", member: "عضو" };
const subLabel: Record<string, string> = { activated: "تفعيل", changed: "تغيير الخطة", canceled: "إلغاء", resumed: "استئناف", ended: "انتهاء" };

export default async function PlatformWorkspacePage({ params }: PageProps<"/admin/platform/workspaces/[id]">) {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="مساحة العمل" /><NotConnected /></>);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await getWorkspace(id);
  if (!d) notFound();
  const w = d.workspace;
  const quota = yoliasPlans[w.plan as YoliasPlan]?.prospects ?? 0;
  return (
    <>
      <PageHeader
        title={w.name || "مساحة عمل بدون اسم"}
        subtitle={<PlanBadge plan={w.plan} status={w.subscription_status} />}
        actions={<Link className="admin-btn small secondary" href="/admin/platform/workspaces"><Tx>كل مساحات العمل</Tx></Link>}
      />
      <div className="bos-kpis">
        <KpiCard label="الاستخدام هذا الشهر" value={`${num(d.stats?.prospects_month ?? 0)} / ${num(quota)}`} />
        <KpiCard label="العملاء المحتملون (الإجمالي)" value={num(d.stats?.prospects_total ?? 0)} />
        <KpiCard label="عمليات البحث" value={num(d.stats?.searches ?? 0)} />
        <KpiCard label="الحملات" value={num(d.stats?.campaigns ?? 0)} />
        <KpiCard label="الأعضاء" value={num(d.stats?.members ?? 0)} />
      </div>

      <Card title="التفاصيل">
        <KeyValues items={[
          { label: "الموقع", value: w.website ? <span dir="ltr">{w.website}</span> : "—" },
          { label: "ماذا تبيع", value: w.offering || "—" },
          { label: "دورة الفوترة", value: w.billing_period === "annual" ? "سنوي" : "شهري" },
          { label: "نهاية الفترة الحالية", value: w.current_period_end ? formatDate(w.current_period_end) : "—" },
          { label: "إلغاء في نهاية الفترة", value: w.cancel_at_period_end ? "نعم" : "لا" },
          { label: "تاريخ الإنشاء", value: formatDateTime(w.created_at) },
          { label: "معرّف مساحة العمل", value: <span dir="ltr" style={{ fontSize: 12 }}>{w.id}</span> },
        ]} />
      </Card>

      <Card title="الأعضاء">
        <BosTable className="bos-table">
          <thead><tr><th><Tx>الاسم</Tx></th><th><Tx>البريد الإلكتروني</Tx></th><th><Tx>الدور</Tx></th><th><Tx>انضم في</Tx></th></tr></thead>
          <tbody>
            {d.members.map((m) => (
              <tr key={m.user_id}><td>{m.profile?.full_name || "—"}</td><td dir="ltr">{m.profile?.email ?? "—"}</td><td><Tx>{roleLabel[m.role] ?? m.role}</Tx></td><td>{formatDate(m.created_at)}</td></tr>
            ))}
            {d.invitations.map((i) => (
              <tr key={i.id}><td className="bos-faint"><Tx>دعوة معلّقة</Tx></td><td dir="ltr">{i.email}</td><td><Tx>{roleLabel[i.role] ?? i.role}</Tx></td><td>{formatDate(i.created_at)}</td></tr>
            ))}
          </tbody>
        </BosTable>
      </Card>

      <Card title="عمليات البحث">
        {d.strategies.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>العنوان</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>التاريخ</Tx></th></tr></thead>
            <tbody>{d.strategies.map((s) => <tr key={s.id}><td>{s.title}</td><td><SearchStatus value={s.status} /></td><td>{formatDateTime(s.created_at)}</td></tr>)}</tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد عمليات بحث" />}
      </Card>

      <Card title="الحملات">
        {d.campaigns.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الحملة</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الشركات</Tx></th><th><Tx>العملاء المحتملون</Tx></th><th><Tx>التاريخ</Tx></th></tr></thead>
            <tbody>{d.campaigns.map((c) => <tr key={c.id}><td>{c.name}</td><td><CampaignStatus value={c.status} /></td><td className="bos-num">{num(c.companies_found)}</td><td className="bos-num">{num(c.prospects_found)} / {num(c.quota)}</td><td>{formatDateTime(c.created_at)}</td></tr>)}</tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد حملات" />}
      </Card>

      <Card title="الفواتير والاشتراك">
        {d.invoices.length || d.events.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>التاريخ</Tx></th><th><Tx>الحدث</Tx></th><th><Tx>الخطة</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>الوضع</Tx></th></tr></thead>
            <tbody>
              {[
                ...d.invoices.map((i) => ({ key: `i${i.id}`, at: i.created_at, what: <span dir="ltr">{i.number}</span>, plan: i.plan, amount: i.amount_usd, mode: i.mode })),
                ...d.events.map((e) => ({ key: `e${e.id}`, at: e.created_at, what: <Tx>{subLabel[e.status] ?? e.status}</Tx>, plan: e.plan, amount: e.amount_usd, mode: e.mode })),
              ].sort((a, b) => b.at.localeCompare(a.at)).map((r) => (
                <tr key={r.key}>
                  <td>{formatDateTime(r.at)}</td><td>{r.what}</td><td>{yoliasPlans[r.plan as YoliasPlan]?.label ?? r.plan}</td>
                  <td className="bos-num">{usd(Number(r.amount))}</td>
                  <td>{r.mode === "test" ? <StatusBadge tone="warning" label="وضع الاختبار" /> : <StatusBadge tone="success" label="فعلي" />}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد فواتير" />}
      </Card>
    </>
  );
}
