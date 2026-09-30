import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { peopleScope } from "@/services/bos/team-scope";
import { listCycles } from "@/services/bos/hr/performance";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, StatusBadge, UserAvatar } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { SubNav } from "@/components/bos/SubNav";
import { hrSection } from "@/lib/bos/hr-nav";
import { formatDate } from "@/lib/bos/format";
import { statusLabel } from "@/lib/bos/labels";
import { CycleButton, CycleStatusButtons, SelfAssessmentButton } from "../../HrControls";
import { AcknowledgeReviewButton, ReviewButton } from "../../TeamControls";

// Review cycles, manager reviews, self assessment (docs/bos/28 §25).
export default async function ReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("performance.read");
  const sp = await readParams(searchParams);
  const { users } = await peopleScope(bos, "performance.read");
  let q = db().from("performance_reviews").select("*, review_cycles(name, self_assessment)").order("period_end", { ascending: false }).limit(300);
  if (users) q = q.in("user_id", users.length ? users : ["00000000-0000-0000-0000-000000000000"]);
  if (sp.cycle) q = q.eq("cycle_id", sp.cycle);
  if (sp.status) q = q.eq("status", sp.status);
  const [{ data: reviews }, cycles, names] = await Promise.all([q, listCycles(), userNameMap()]);
  const canCycles = bos.permissions.get("performance.manage") === "all" || bos.isSuperAdmin;
  const cycleOpts = cycles.map((c) => ({ value: c.id, label: c.name }));
  return (
    <>
      <PageHeader title="المراجعات ودورات التقييم" breadcrumbs={[{ label: "الفريق" }, { label: "الأداء", href: "/admin/team/performance" }, { label: "المراجعات" }]} actions={canCycles ? <CycleButton /> : null} />
      <SubNav items={hrSection(bos, "performance")} active="reviews" label="الأداء" />
      <Card title="دورات التقييم">
        {cycles.length ? (
          <table className="bos-table">
            <tbody>
              {cycles.map((c) => (
                <tr key={c.id}>
                  <td className="cell-primary"><Link href={`/admin/team/performance/reviews?cycle=${c.id}`}>{c.name}</Link><span className="cell-sub">{formatDate(c.period_start)} → {formatDate(c.period_end)}</span></td>
                  <td>{statusLabel("cycle_status", c.status)}</td>
                  <td className="bos-faint" style={{ fontSize: 12 }}>{c.self_assessment ? "تقييم ذاتي" : ""}{c.peer_feedback ? " · 360" : ""}</td>
                  <td>{canCycles ? <span className="bos-row" style={{ gap: 4 }}><CycleButton initial={c} /><CycleStatusButtons id={c.id} status={c.status} /></span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد دورات تقييم" />}
      </Card>
      <FilterBar filters={[{ key: "cycle", label: "الدورة", type: "select", options: cycleOpts }, { key: "status", label: "الحالة", type: "select", options: [{ value: "draft", label: "مسودة" }, { value: "submitted", label: "بانتظار اطلاع الموظف" }, { value: "acknowledged", label: "تم الاطلاع" }] }]} />
      <Card title="المراجعات" flush>
        {(reviews ?? []).length ? (
          <table className="bos-table responsive">
            <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>الفترة</Tx></th><th><Tx>الدورة</Tx></th><th><Tx>المراجِع</Tx></th><th><Tx>التقييم الذاتي</Tx></th><th><Tx>التقييم النهائي</Tx></th><th><Tx>التوصية</Tx></th><th><Tx>الحالة</Tx></th><th /></tr></thead>
            <tbody>
              {(reviews ?? []).map((r) => {
                const self = r.user_id === bos.userId;
                const reviewer = r.reviewer_id === bos.userId;
                const cycle = r.review_cycles as { name: string; self_assessment: boolean } | null;
                return (
                  <tr key={r.id}>
                    <td><Link href={`/admin/team/performance/${r.user_id}`} className="bos-row" style={{ gap: 8 }}><UserAvatar name={names.get(r.user_id)} userId={r.user_id} />{names.get(r.user_id) ?? "—"}</Link></td>
                    <td>{formatDate(r.period_start)} → {formatDate(r.period_end)}<span className="cell-sub">{statusLabel("review_status", r.status)}</span></td>
                    <td>{cycle?.name ?? "—"}</td>
                    <td>{r.reviewer_id ? names.get(r.reviewer_id) ?? "—" : "—"}</td>
                    <td>{r.self_submitted_at ? `${r.self_rating ?? "✓"}${r.self_rating ? "/5" : ""}` : cycle?.self_assessment ? <span className="bos-faint"><Tx>بانتظار</Tx></span> : "—"}</td>
                    <td>{!self || r.status !== "draft" ? (r.overall_rating ? `${r.overall_rating}/5` : "—") : "—"}</td>
                    <td>{!self || r.status !== "draft" ? statusLabel("review_recommendation", r.recommendation) : "—"}</td>
                    <td><StatusBadge map="review_status" value={r.status} /></td>
                    <td className="bos-row" style={{ gap: 4 }}>
                      {self && r.status !== "acknowledged" && (cycle?.self_assessment ?? true) ? <SelfAssessmentButton reviewId={r.id} initial={{ self_assessment: r.self_assessment, self_rating: r.self_rating ? Number(r.self_rating) : null }} /> : null}
                      {self && r.status === "submitted" ? <AcknowledgeReviewButton id={r.id} /> : null}
                      {!self && r.status === "draft" && (reviewer || bos.permissions.get("performance.update") === "all" || bos.isSuperAdmin) ? <ReviewButton userId={r.user_id} review={{ ...r, overall_rating: r.overall_rating ? Number(r.overall_rating) : null, manager_rating: r.manager_rating ? Number(r.manager_rating) : null, self_rating: r.self_rating ? Number(r.self_rating) : null }} label="كتابة المراجعة" defaults={{ start: r.period_start, end: r.period_end }} cycles={cycleOpts} /> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد مراجعات" />}
      </Card>
    </>
  );
}
