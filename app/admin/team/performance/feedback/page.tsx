import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { peopleScope } from "@/services/bos/team-scope";
import { listCycles, listFeedback } from "@/services/bos/hr/performance";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, StatusBadge, UserAvatar } from "@/components/bos/ui";
import { SubNav } from "@/components/bos/SubNav";
import { hrSection } from "@/lib/bos/hr-nav";
import { formatDate } from "@/lib/bos/format";
import { statusLabel } from "@/lib/bos/labels";
import { AnswerFeedbackButton, RequestFeedbackButton } from "../../HrControls";

// 360 feedback (docs/bos/28 §25): requests to me, and feedback about my people.
export default async function FeedbackPage() {
  const { bos } = await requirePermission("performance.read");
  const { users, manages } = await peopleScope(bos, "performance.read");
  const revealAuthors = bos.permissions.get("performance.manage") === "all" || bos.isSuperAdmin;
  const [toMe, about, cycles, names, { data: people }] = await Promise.all([
    listFeedback({ fromUserId: bos.userId }, true),
    manages || users === null ? listFeedback({}, revealAuthors) : Promise.resolve([]),
    listCycles(),
    userNameMap(),
    db().from("employees").select("user_id, full_name").not("user_id", "is", null).in("lifecycle_status", ["active", "on_leave", "onboarding"]).order("full_name"),
  ]);
  const aboutMine = users === null ? about : about.filter((f) => users.includes(f.subject_user_id) && f.subject_user_id !== bos.userId);
  const peopleOpts = (people ?? []).map((p) => ({ value: p.user_id as string, label: p.full_name }));
  const managedPeople = users === null ? peopleOpts : peopleOpts.filter((p) => users.includes(p.value) && p.value !== bos.userId);
  const cycleOpts = cycles.map((c) => ({ value: c.id, label: c.name }));
  return (
    <>
      <PageHeader title="تقييم 360" breadcrumbs={[{ label: "الفريق" }, { label: "الأداء", href: "/admin/team/performance" }, { label: "تقييم 360" }]} />
      <SubNav items={hrSection(bos, "performance")} active="feedback" label="الأداء" />
      <Card title="طلبات التقييم الموجهة لي">
        {toMe.length ? toMe.map((f) => (
          <div key={f.id} className="bos-row" style={{ justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--bos-border)", fontSize: 13 }}>
            <span className="bos-row" style={{ gap: 8 }}><UserAvatar name={names.get(f.subject_user_id)} userId={f.subject_user_id} />{names.get(f.subject_user_id)} · {statusLabel("feedback_relationship", f.relationship)}{(f.review_cycles as { name: string } | null)?.name ? ` · ${(f.review_cycles as { name: string }).name}` : ""}</span>
            <span className="bos-row" style={{ gap: 6 }}><StatusBadge map="feedback_status" value={f.status} />{f.status === "requested" ? <AnswerFeedbackButton id={f.id} subjectName={names.get(f.subject_user_id) ?? ""} /> : <span className="bos-faint" style={{ fontSize: 12 }}>{formatDate(f.submitted_at)}</span>}</span>
          </div>
        )) : <EmptyState title="لا توجد طلبات" />}
      </Card>
      {managedPeople.length ? (
        <Card title="تقييمات عن فريقي">
          <div className="bos-row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {managedPeople.slice(0, 30).map((p) => <span key={p.value} className="bos-row" style={{ gap: 4 }}><span style={{ fontSize: 12.5 }}><Tx>{p.label}</Tx></span><RequestFeedbackButton subjectUserId={p.value} people={peopleOpts} cycles={cycleOpts} /></span>)}
          </div>
          {aboutMine.length ? (
            <table className="bos-table responsive">
              <thead><tr><th><Tx>عن</Tx></th><th><Tx>من</Tx></th><th><Tx>العلاقة</Tx></th><th><Tx>التقييم</Tx></th><th><Tx>الملاحظات</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
              <tbody>
                {aboutMine.map((f) => (
                  <tr key={f.id}>
                    <td>{names.get(f.subject_user_id)}</td>
                    <td><Tx>{f.from_user_id ? names.get(f.from_user_id) : "مجهول"}</Tx></td>
                    <td>{statusLabel("feedback_relationship", f.relationship)}</td>
                    <td>{f.rating ? `${f.rating}/5` : "—"}</td>
                    <td style={{ fontSize: 12.5 }}>{[f.strengths && `القوة: ${f.strengths}`, f.improvements && `التحسين: ${f.improvements}`, f.comments].filter(Boolean).join(" · ") || "—"}</td>
                    <td><StatusBadge map="feedback_status" value={f.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState title="لا توجد تقييمات بعد" />}
        </Card>
      ) : null}
    </>
  );
}
