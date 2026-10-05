import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { canSeeUser } from "@/services/bos/team-scope";
import { getPerformanceProfile } from "@/services/bos/performance";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, Summary, StatusBadge, EmptyState, Money, ProgressBar } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate, formatMinutes, todayIn, startOfMonth } from "@/lib/bos/format";
import { kpiUnitLabels } from "@/lib/bos/kpi-metrics";
import { AcknowledgeReviewButton, ManualKpiButton, ReviewButton } from "../../TeamControls";

export default async function PerformanceProfilePage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: SearchParams }) {
  const { bos } = await requirePermission("performance.read");
  const { userId } = await params;
  const sp = await readParams(searchParams);
  const isSelf = userId === bos.userId;
  if (!isSelf && !(await canSeeUser(bos, "performance.read", userId))) notFound();
  const { data: emp } = await db().from("employees").select("id, full_name, position, timezone").eq("user_id", userId).maybeSingle();
  if (!emp) notFound();
  const today = todayIn(emp.timezone);
  const from = sp.from ?? startOfMonth(today);
  const to = sp.to ?? today;
  const [p, names] = await Promise.all([getPerformanceProfile(userId, from, to), userNameMap()]);
  const canReview = !isSelf && can(bos, "performance.create") && (bos.permissions.get("performance.create") === "all" || (await canSeeUser(bos, "performance.create", userId)));
  return (
    <>
      <PageHeader
        title={<Tx vars={{ full_name: emp.full_name }}>{"الأداء: {full_name}"}</Tx>}
        subtitle={`${emp.position ?? ""} · ${from} → ${to}`}
       
        actions={<>{canReview ? <ReviewButton userId={userId} defaults={{ start: from, end: to }} /> : null}<Link className="admin-btn small secondary" href={`/admin/team/employees/${emp.id}`}><Tx>ملف الموظف</Tx></Link></>}
      />
      <FilterBar filters={[{ key: "from", label: "من", type: "date" }, { key: "to", label: "إلى", type: "date" }]} />
      <Card title="العمل">
        <Summary
          items={[
            { label: "متابعات منجزة", value: p.work.followupsDone },
            { label: "متابعات متأخرة", value: p.work.followupsOverdue },
            { label: "أنشطة", value: p.work.activities },
            { label: "اجتماعات", value: p.work.meetings },
            { label: "عملاء محتملون", value: p.work.leads },
            { label: "صفقات مكسوبة", value: p.work.dealsWon },
            { label: "الإيراد", value: p.work.revenue.length ? p.work.revenue.map((r) => <div key={r.currency}><Money value={r.amount} currency={r.currency} /></div>) : "—" },
          ]}
        />
      </Card>
      <Card title="الحضور">
        <Summary items={[{ label: "أيام حضور", value: p.attendance.present }, { label: "ساعات العمل", value: formatMinutes(p.attendance.worked) }, { label: "المتوقع", value: formatMinutes(p.attendance.expected) }, { label: "أيام التأخير", value: p.attendance.lateDays }, { label: "الغياب", value: p.attendance.absences }, { label: "إضافي", value: formatMinutes(p.attendance.overtime) }]} />
      </Card>
      <Card title="تحقيق المؤشرات حسب الفئة">
        {p.kpiCategories.length ? p.kpiCategories.map((cat) => (
          <div key={cat.category} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}><Tx>{cat.category}</Tx></div>
            <BosTable className="bos-table responsive">
              <tbody>
                {cat.items.map((k) => (
                  <tr key={k.kpi.id}>
                    <td className="cell-primary">{k.kpi.name}<span className="cell-sub">{kpiUnitLabels[k.kpi.unit]}{k.kpi.direction === "lower_better" ? " · الأقل أفضل" : ""}</span></td>
                    <td>{k.valid ? k.actual ?? "—" : <span className="bos-faint"><Tx>مصدر غير صالح</Tx></span>} / {k.target}</td>
                    <td style={{ minWidth: 140 }}>{k.attainment != null ? <><ProgressBar value={Math.min(100, k.attainment)} tone={k.attainment >= 100 ? "success" : k.attainment < 60 ? "warning" : undefined} /><span className="cell-sub">{k.attainment}%</span></> : "—"}</td>
                    <td>{(k.kpi.calculation === "manual" || k.kpi.data_source === "manual") && canReview ? <ManualKpiButton kpiId={k.kpi.id} userId={userId} date={to} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        )) : <EmptyState title="لا توجد مؤشرات مخصصة" />}
        {p.weightedScore != null ? (
          <div className="bos-alert warning" style={{ marginTop: 8 }}>
            الأوزان مفعّلة: النتيجة الموزونة {p.weightedScore}% — التفصيل: {p.weightedBreakdown.map((k) => `${k.kpi.name} (${Number(k.kpi.weight)}% وزن، ${k.attainment}%)`).join(" · ")}
          </div>
        ) : <p className="bos-faint" style={{ fontSize: 12 }}><Tx>لا توجد نتيجة إجمالية واحدة — الأداء يُعرض حسب الفئات (الأوزان غير مفعّلة).</Tx></p>}
      </Card>
      <Card title="مراجعات الأداء">
        {p.reviews.filter((r) => !isSelf || r.status !== "draft").length ? p.reviews.filter((r) => !isSelf || r.status !== "draft").map((r) => (
          <div key={r.id} style={{ borderBottom: "1px solid rgba(var(--bos-fg-rgb), 0.06)", padding: "10px 0" }}>
            <div className="bos-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <span><strong>{formatDate(r.period_start)} → {formatDate(r.period_end)}</strong> <StatusBadge map="review_status" value={r.status} /> <span className="bos-faint" style={{ fontSize: 12 }}>المراجِع: {r.reviewer_id ? names.get(r.reviewer_id) ?? "—" : "—"}</span></span>
              <span className="bos-row" style={{ gap: 6 }}>
                {r.status === "draft" && r.reviewer_id === bos.userId ? <ReviewButton userId={userId} review={r} label="تعديل" defaults={{ start: r.period_start, end: r.period_end }} /> : null}
                {r.status === "submitted" && isSelf ? <AcknowledgeReviewButton id={r.id} /> : null}
              </span>
            </div>
            {r.status !== "draft" || r.reviewer_id === bos.userId ? (
              <div className="bos-stack" style={{ gap: 6, marginTop: 6, fontSize: 13 }}>
                {r.summary ? <div><strong><Tx>الملخص:</Tx></strong> <span className="bos-prose">{r.summary}</span></div> : null}
                {r.strengths ? <div><strong><Tx>نقاط القوة:</Tx></strong> <span className="bos-prose"><Tx>{r.strengths}</Tx></span></div> : null}
                {r.improvements ? <div><strong><Tx>التحسين:</Tx></strong> <span className="bos-prose"><Tx>{r.improvements}</Tx></span></div> : null}
                {r.goals ? <div><strong><Tx>الأهداف:</Tx></strong> <span className="bos-prose"><Tx>{r.goals}</Tx></span></div> : null}
                {r.acknowledged_at ? <div className="bos-faint" style={{ fontSize: 12 }}><Tx vars={{ v: formatDate(r.acknowledged_at) }}>{"اطّلع الموظف {v}"}</Tx></div> : null}
              </div>
            ) : null}
          </div>
        )) : <EmptyState title="لا توجد مراجعات" />}
      </Card>
    </>
  );
}
