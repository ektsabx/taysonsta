import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { yoliasSiteUrl } from "@/lib/yolias/db";
import { yoliasPlanIds, yoliasPlanLabel } from "@/lib/yolias/plans";
import { platformOverview } from "@/services/yolias/platform";
import { yoliasKpis } from "@/services/yolias/kpis";
import { yoliasFunnel } from "@/services/yolias/funnel";
import { NotConnected, connected, num, usd, CampaignStatus } from "@/components/yolias/PlatformUi";

// Yolias platform overview (docs/09-yolias-admin.md "Admin analytics"):
// only metrics with a real data source. Revenue is split into live and
// test mode — test-mode plans are not revenue.
export default async function PlatformOverviewPage() {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="منصة Yolias" /><NotConnected /></>);
  const [o, k, f] = await Promise.all([platformOverview(), yoliasKpis(), yoliasFunnel()]);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const plans = yoliasPlanIds;
  const totalWs = Math.max(1, o.workspaces);
  return (
    <>
      <PageHeader
        title="منصة Yolias"
        subtitle="مستخدمو تطبيق Yolias ومساحات العمل والاستخدام — من قاعدة بيانات Yolias مباشرة"
        actions={<a className="admin-btn small secondary" href={yoliasSiteUrl()} target="_blank" rel="noreferrer"><Tx>فتح Yolias</Tx></a>}
      />
      {/* The ten numbers to watch every day (owner, 2026-10-29). */}
      <Card title="أرقام اليوم">
        <div className="bos-kpis">
          <KpiCard label="تسجيلات جديدة" value={num(k.signups.today)} sub={<Tx vars={{ w: num(k.signups.week), p: num(k.signups.prevWeek) }}>{"{w} هذا الأسبوع مقابل {p} الأسبوع الماضي"}</Tx>} href="/admin/platform/users" />
          <KpiCard label="من أين جاءت" value={k.signups.channels[0]?.channel ?? "—"} sub={k.signups.channels.map((c) => `${c.channel} ${num(c.n)}`).join(" · ") || "—"} href="/admin/platform/seo/reports" />
          <KpiCard label="نسبة الدفع" value={pct(k.paidConversion.paid, k.paidConversion.cohort)} sub={<Tx vars={{ p: num(k.paidConversion.paid), c: num(k.paidConversion.cohort) }}>{"{p} دفعوا من {c} سجّلوا خلال 30 يومًا"}</Tx>} href="/admin/platform/conversions" />
          <KpiCard label="إيراد الشهر" value={usd(k.revenue.month)} sub={<Tx vars={{ v: usd(k.revenue.mrr) }}>{"الإيراد الشهري الثابت {v}"}</Tx>} href="/admin/platform/payments" />
          <KpiCard label="أول بحث خلال يوم" value={pct(k.firstSearch.within24h, k.firstSearch.cohort)} sub={<Tx vars={{ n: num(k.firstSearch.within24h), c: num(k.firstSearch.cohort) }}>{"{n} من {c} مستخدم جديد"}</Tx>} href="/admin/platform/searches" />
          <KpiCard label="بدأوا أول حملة" value={pct(k.firstCampaign.started, k.firstCampaign.cohort)} sub={<Tx vars={{ n: num(k.firstCampaign.started), c: num(k.firstCampaign.cohort) }}>{"{n} من {c} مساحة جديدة"}</Tx>} />
          <KpiCard label="نسبة الرد" value={pct(k.replyRate.replied, k.replyRate.contacted)} sub={<Tx vars={{ r: num(k.replyRate.replied), c: num(k.replyRate.contacted) }}>{"{r} ردّوا من {c} تم التواصل معهم (30 يومًا)"}</Tx>} />
          <KpiCard label="صفقات كسبوها" value={num(k.dealsWon.month)} sub={<Tx vars={{ v: usd(k.dealsWon.value) }}>{"هذا الشهر · قيمتها {v}"}</Tx>} />
          <KpiCard label="المستخدمون النشطون" value={num(k.retention.activeWeek)} sub={<Tx vars={{ p: num(k.retention.activePrevWeek), q: num(k.retention.quiet) }}>{"الأسبوع الماضي {p} · {q} لم يعودوا"}</Tx>} href="/admin/platform/users" />
          <KpiCard label="التكلفة لكل عميل محتمل" value={k.costPerProspect.prospects ? usd(k.costPerProspect.cost / k.costPerProspect.prospects) : "—"} sub={<Tx vars={{ c: usd(k.costPerProspect.cost), n: num(k.costPerProspect.prospects) }}>{"{c} لـ {n} عميل هذا الشهر · السعر 0.05$"}</Tx>} href="/admin/platform/profitability" />
          <KpiCard label="الأعطال" value={num(k.failures.bounced7d + k.failures.mailboxesDown + k.failures.searchesFailed7d)} sub={<Tx vars={{ b: num(k.failures.bounced7d), m: num(k.failures.mailboxesDown), s: num(k.failures.searchesFailed7d) }}>{"{b} إيميل ارتد · {m} بريد منفصل · {s} بحث فشل (7 أيام)"}</Tx>} href="/admin/platform/health" />
        </div>
      </Card>


      {/* The journey funnel (owner, 2026-10-29): where people stop, for those who signed up in 30 days. */}
      <div style={{ marginTop: 16 }}><Card title="رحلة المستخدم (من سجّلوا خلال 30 يومًا)">
        <p className="cell-sub" style={{ margin: "0 0 12px" }}>
          <Tx vars={{ s: num(f.audience.services), o: num(f.audience.other), u: num(f.audience.unknown) }}>{"الجمهور: {s} شركات خدمات أو وكالات · {o} مجالات أخرى · {u} لم يكتبوا المجال"}</Tx>
          {f.audience.top.length ? <> · {f.audience.top.map((t) => `${t.industry} ${num(t.n)}`).join(" · ")}</> : null}
        </p>
        <div className="bos-funnel">
          {f.steps.map((s, i) => {
            const prev = i ? f.steps[i - 1].n : s.n;
            return (
              <div key={s.id} className="bos-funnel-row">
                <span className="bos-funnel-label"><Tx>{s.label}</Tx></span>
                <span className="bos-funnel-track"><span className="bos-funnel-bar" style={{ width: `${f.cohort ? Math.max(2, (s.n / f.cohort) * 100) : 0}%` }} /></span>
                <span className="bos-num bos-funnel-n">{num(s.n)} <span className="cell-sub">{pct(s.n, f.cohort)}{i ? <> · <Tx vars={{ p: pct(s.n, prev) }}>{"{p} من الخطوة السابقة"}</Tx></> : null}</span></span>
              </div>
            );
          })}
        </div>
        <p className="cell-sub" style={{ margin: "12px 0 0" }}><Tx>كل خطوة تعدّ من وصلها في أي وقت. في Yolias الدفع يأتي بعد الإعداد مباشرة، فالبحث والنتائج غالبًا بعد الدفع.</Tx></p>
      </Card></div>

      <div className="bos-kpis" style={{ marginTop: 16 }}>
        <KpiCard label="المستخدمون" value={num(o.users)} sub={<Tx vars={{ n: num(o.users30) }}>{"{n} جديد خلال 30 يوماً"}</Tx>} href="/admin/platform/users" />
        <KpiCard label="مساحات العمل" value={num(o.workspaces)} href="/admin/platform/workspaces" />
        <KpiCard label="خطط مدفوعة (فعلية)" value={num(o.livePaid)} sub={<Tx vars={{ n: num(o.testPaid) }}>{"{n} في وضع الاختبار"}</Tx>} />
        <KpiCard label="الإيراد الشهري المتكرر" value={usd(o.mrrLive)} sub={<Tx vars={{ v: usd(o.mrrTest) }}>{"{v} في وضع الاختبار (ليس إيراداً)"}</Tx>} />
        <KpiCard label="عمليات البحث" value={num(o.searches)} sub={<Tx vars={{ n: num(o.searches30) }}>{"{n} خلال 30 يوماً"}</Tx>} href="/admin/platform/searches" />
        <KpiCard label="العملاء المحتملون المسلَّمون" value={num(o.prospects)} sub={<Tx vars={{ n: num(o.prospectsMonth) }}>{"{n} هذا الشهر"}</Tx>} />
      </div>

      <div className="bos-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginTop: 16 }}>
        <Card title="توزيع الخطط">
          <div className="bos-table-scroll">
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الخطة</Tx></th><th><Tx>حصة العملاء المحتملين</Tx></th><th><Tx>مساحات العمل</Tx></th><th>%</th></tr></thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p}>
                  <td>{yoliasPlanLabel[p]}<span className="cell-sub bos-num">{usd(o.terms[p].priceUsd)}</span></td>
                  <td className="bos-num">{num(o.terms[p].prospects)}</td>
                  <td className="bos-num">{num(o.plans[p] ?? 0)}</td>
                  <td className="bos-num">{Math.round(((o.plans[p] ?? 0) / totalWs) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
          </div>
        </Card>

        <Card title="الحملات حسب الحالة">
          {o.campaignsTotal ? (
            <BosTable className="bos-table">
              <thead><tr><th><Tx>الحالة</Tx></th><th><Tx>العدد</Tx></th></tr></thead>
              <tbody>
                {Object.entries(o.campaigns).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
                  <tr key={s}><td><CampaignStatus value={s} /></td><td className="bos-num">{num(n)}</td></tr>
                ))}
              </tbody>
            </BosTable>
          ) : <EmptyState title="لا توجد حملات بعد" />}
          {o.campaigns.awaiting_source ? (
            <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>لا يوجد مزود بيانات متصل بعد، لذلك تتوقف الحملات عند «بانتظار مصدر بيانات».</Tx></p>
          ) : null}
        </Card>
      </div>

      <Card title="آخر 30 يوماً">
        {(() => {
          const m = o.last30;
          const n = (k: string) => Number(m[k] ?? 0);
          const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
          const finished = n("campaigns_completed") + n("campaigns_partial") + n("campaigns_failed");
          return (
            <div className="bos-kpis">
              <KpiCard label="مستخدمون نشطون" value={num(n("active_users"))} sub={<Tx vars={{ n: num(n("active_workspaces")) }}>{"{n} مساحة عمل نشطة"}</Tx>} />
              <KpiCard label="نجاح الحملات" value={pct(n("campaigns_completed") + n("campaigns_partial"), finished)} sub={<Tx vars={{ c: num(n("campaigns")), f: num(n("campaigns_failed")) }}>{"{c} حملة · {f} فشلت"}</Tx>} />
              <KpiCard label="نسبة البريد المُتحقق منه" value={pct(n("prospects_verified"), n("prospects"))} sub={m.avg_match_score == null ? undefined : <Tx vars={{ s: String(m.avg_match_score) }}>{"متوسط التطابق {s}%"}</Tx>} />
              <KpiCard label="إعادة استخدام البيانات" value={pct(n("reused_prospects"), n("prospects"))} sub="عملاء محتملون من البيانات المشتركة" />
              <KpiCard label="ذاكرة فهم البحث" value={pct(n("icp_cache_hits"), n("icp_calls"))} sub={<Tx vars={{ n: num(n("icp_calls")) }}>{"{n} طلب فهم"}</Tx>} />
              <KpiCard label="أخطاء المزودين" value={pct(n("provider_failures"), n("provider_calls"))} sub={m.provider_p50_ms == null ? <Tx>غير متصل</Tx> : <Tx vars={{ ms: String(Math.round(Number(m.provider_p50_ms))) }}>{"الوسيط {ms} ms"}</Tx>} />
              <KpiCard label="إلغاءات" value={num(n("canceled_workspaces"))} sub="مساحات عمل ألغت أو انتهت خطتها" />
            </div>
          );
        })()}
      </Card>

      <Card title="أحدث المستخدمين" actions={<Link className="bos-link" href="/admin/platform/users"><Tx>عرض الكل</Tx></Link>}>
        {o.recentUsers.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الاسم</Tx></th><th><Tx>البريد الإلكتروني</Tx></th><th><Tx>تاريخ التسجيل</Tx></th></tr></thead>
            <tbody>
              {o.recentUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.workspace_id ? <Link className="bos-link" href={`/admin/platform/workspaces/${u.workspace_id}`}>{u.full_name || "—"}</Link> : u.full_name || "—"}</td>
                  <td dir="ltr">{u.email}</td>
                  <td>{formatDateTime(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا يوجد مستخدمون بعد" />}
      </Card>
    </>
  );
}
