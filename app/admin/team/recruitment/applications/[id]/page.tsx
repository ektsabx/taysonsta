import { getT } from "@/lib/bos/i18n/server";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { NotFoundError } from "@/lib/bos/errors";
import { getSetting } from "@/lib/bos/settings";
import { getApplication } from "@/services/bos/hr/recruitment";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, KeyValues, Money, StatusBadge } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { statusLabel } from "@/lib/bos/labels";
import { FeedbackButton, HireButton, InterviewButton, InterviewCloseButtons, OfferButton, OfferSteps, PortfolioLink, RatingControl, StageControls, stageLabels } from "../../RecruitmentControls";
import { recruitmentLookups } from "../../lookups";

const funnel = ["new", "in_review", "contacted", "interview", "evaluation", "accepted", "offer", "offer_accepted", "hired"];

// Application: Application → Interview → Evaluation → Offer → Accepted →
// Hired → Employee (docs/bos/28 §21–22).
export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const { bos } = await requirePermission("recruitment.read");
  const { id } = await params;
  let a;
  try {
    a = await getApplication(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  if (!a.candidate_id || !(await canAccessEntity(bos, "candidate", a.candidate_id))) notFound();
  const [l, names, company] = await Promise.all([recruitmentLookups(), userNameMap(), getSetting("company")]);
  const canEdit = bos.permissions.get("recruitment.update") === "all" || bos.isSuperAdmin;
  const job = a.career_jobs as unknown as { id: string; title: string };
  const interviews = ((a.career_interviews as unknown as { id: string; scheduled_at: string; duration_minutes: number; round: number; format: string; interviewer_user_id: string | null; interviewer_name: string | null; meeting_link: string | null; location: string | null; status: string; outcome: string; feedback: string | null; interview_feedback: { id: string; reviewer_user_id: string; rating: number; recommendation: string; strengths: string | null; concerns: string | null; notes: string | null }[] }[]) ?? []).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
  const liveOffer = a.offers.find((o) => ["draft", "sent", "accepted"].includes(o.status));
  const stageIndex = funnel.indexOf(a.status);
  return (
    <>
      <PageHeader
        title={`${a.first_name} ${a.last_name}`}
        subtitle={<span className="bos-row" style={{ gap: 8 }}><StatusBadge map="application_status" value={a.status} /><span><Tx>{job.title}</Tx></span>{canEdit ? <RatingControl applicationId={a.id} rating={a.rating ? Number(a.rating) : null} /> : null}</span>}
        breadcrumbs={[{ label: "التوظيف", href: "/admin/team/recruitment" }, { label: "الطلبات", href: "/admin/team/recruitment/applications" }, { label: `${a.first_name} ${a.last_name}` }]}
        actions={
          <span className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
            <Link className="admin-btn small ghost" href={`/admin/team/recruitment/candidates/${a.candidate_id}`}><Tx>ملف المرشح</Tx></Link>
            {canEdit ? <StageControls applicationId={a.id} status={a.status} /> : null}
            {canEdit && a.status === "offer_accepted" && can(bos, "employees.create") ? <HireButton applicationId={a.id} roles={can(bos, "roles.assign") || can(bos, "employees.manage") ? l.roles : []} emailDomain={(company as { email_domain?: string }).email_domain ?? null} /> : null}
          </span>
        }
      />
      <div className="bos-tabs" aria-label={t("مراحل التوظيف")} style={{ pointerEvents: "none" }}>
        {funnel.map((s, i) => <span key={s} style={{ padding: "8px 10px", fontSize: 12.5, color: s === a.status ? "var(--bos-accent)" : i < stageIndex ? "var(--bos-success)" : "var(--bos-faint)", fontWeight: s === a.status ? 800 : 500 }}>{i < stageIndex ? "✓ " : ""}{stageLabels[s]}</span>)}
      </div>
      {a.status === "rejected" || a.status === "withdrawn" ? <div className="bos-alert danger">{statusLabel("application_status", a.status)}{a.rejection_reason ? `: ${a.rejection_reason}` : ""}</div> : null}
      <div className="bos-grid main-side">
        <div>
          <Card title={<Tx vars={{ interviews_count: interviews.length }}>{"المقابلات ({interviews_count})"}</Tx>} actions={canEdit && !["hired", "rejected", "withdrawn"].includes(a.status) ? <InterviewButton applicationId={a.id} interviewers={l.users} nextRound={(interviews.at(-1)?.round ?? 0) + 1} /> : null}>
            {interviews.length ? interviews.map((i) => {
              const mine = i.interview_feedback.find((f) => f.reviewer_user_id === bos.userId);
              const canFeedback = canEdit || i.interviewer_user_id === bos.userId;
              return (
                <div key={i.id} style={{ borderBottom: "1px solid var(--bos-border)", padding: "10px 0" }}>
                  <div className="bos-row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span><strong><Tx vars={{ round: i.round }}>{"الجولة {round}"}</Tx></strong> — {formatDateTime(i.scheduled_at)} ({i.duration_minutes} د · {i.format === "call" ? "مكالمة" : i.format === "video" ? "فيديو" : "في المقر"}) · {i.interviewer_user_id ? names.get(i.interviewer_user_id) : i.interviewer_name ?? "—"} <StatusBadge map="interview_status" value={i.status} /> <StatusBadge map="interview_outcome" value={i.outcome} /></span>
                    <span className="bos-row" style={{ gap: 4, flexWrap: "wrap" }}>
                      {canFeedback ? <FeedbackButton interviewId={i.id} initial={mine} /> : null}
                      {canEdit && i.status === "scheduled" ? <><InterviewButton applicationId={a.id} interviewers={l.users} nextRound={i.round} initial={i} /><InterviewCloseButtons id={i.id} /></> : null}
                    </span>
                  </div>
                  {i.meeting_link ? <a className="bos-link" style={{ fontSize: 12 }} href={i.meeting_link} target="_blank" rel="noreferrer"><Tx>رابط الاجتماع</Tx></a> : null}
                  {i.feedback ? <div className="bos-prose" style={{ fontSize: 13, marginTop: 4 }}><Tx>{i.feedback}</Tx></div> : null}
                  {i.interview_feedback.map((f) => (
                    <div key={f.id} style={{ fontSize: 12.5, marginTop: 6, paddingInlineStart: 10, borderInlineStart: "2px solid var(--bos-border-strong)" }}>
                      <strong>{names.get(f.reviewer_user_id) ?? "—"}</strong> · {f.rating}/5 · <StatusBadge map="recommendation" value={f.recommendation} />
                      {f.strengths ? <div><span className="bos-faint"><Tx>القوة:</Tx> </span><Tx>{f.strengths}</Tx></div> : null}
                      {f.concerns ? <div><span className="bos-faint"><Tx>المخاوف:</Tx> </span><Tx>{f.concerns}</Tx></div> : null}
                      {f.notes ? <div className="bos-faint">{f.notes}</div> : null}
                    </div>
                  ))}
                </div>
              );
            }) : <EmptyState title="لا توجد مقابلات" />}
          </Card>
          <Card title="عرض العمل" actions={canEdit && !liveOffer && ["interview", "evaluation", "accepted"].includes(a.status) ? <OfferButton applicationId={a.id} jobTitle={job.title} departments={l.departments} teams={l.teams} managers={l.managers} currencies={l.currencies} components={l.components} /> : null}>
            {a.offers.length ? a.offers.map((o) => (
              <div key={o.id} style={{ borderBottom: "1px solid var(--bos-border)", padding: "8px 0" }}>
                <div className="bos-row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span><strong><Tx>{o.offer_number}</Tx></strong> — {o.position_title} · <Money value={o.basic_salary} currency={o.currency} /> <Tx vars={{ v: formatDate(o.start_date), v2: formatDate(o.expires_at) }}>{"/ شهر · يبدأ {v} · صالح حتى {v2}"}</Tx> <StatusBadge map="offer_status" value={o.status} /></span>
                  {canEdit ? <span className="bos-row" style={{ gap: 4 }}>{o.status === "draft" ? <OfferButton applicationId={a.id} jobTitle={job.title} departments={l.departments} teams={l.teams} managers={l.managers} currencies={l.currencies} components={l.components} initial={{ ...o, allowances: (o.allowances as { component_id: string; amount: string }[]) ?? [] }} /> : null}<OfferSteps id={o.id} status={o.status} /></span> : null}
                </div>
                {o.response_note ? <div className="bos-faint" style={{ fontSize: 12 }}><Tx>{o.response_note}</Tx></div> : null}
              </div>
            )) : <EmptyState title="لا يوجد عرض بعد" description="يُنشأ العرض بعد المقابلة / التقييم." />}
          </Card>
          <Card title="السجل الزمني"><ActivityTimeline entityType="candidate" entityId={a.candidate_id} limit={40} /></Card>
        </div>
        <div>
          <Card title="بيانات الطلب" actions={a.portfolio_path ? <PortfolioLink applicationId={a.id} /> : null}>
            <KeyValues items={[
              { label: "البريد", value: <span dir="ltr">{a.email}</span> },
              { label: "الهاتف", value: <span dir="ltr">{a.phone}</span> },
              { label: "الدولة", value: a.country },
              { label: "العمر", value: a.age && a.age !== 18 ? a.age : null },
              { label: "التعليم", value: a.education_status !== "—" ? a.education_status : null },
              { label: "الدورات", value: a.courses_completed },
              { label: "الخبرة", value: `${a.years_experience} سنة` },
              { label: "الراتب المتوقع", value: a.expected_salary !== "—" ? a.expected_salary : null },
              { label: "إنستجرام", value: a.instagram_handle !== "—" ? a.instagram_handle : null },
              { label: "حسابات أخرى", value: a.other_socials },
              { label: "المصدر", value: a.source },
              { label: "تاريخ التقديم", value: formatDateTime(a.created_at) },
            ]} />
          </Card>
          {a.bio && a.bio !== "—" ? <Card title="نبذة"><div className="bos-prose"><Tx>{a.bio}</Tx></div></Card> : null}
          {a.why_fit && a.why_fit !== "—" ? <Card title="لماذا يناسب الدور"><div className="bos-prose"><Tx>{a.why_fit}</Tx></div></Card> : null}
          {a.internal_notes ? <Card title="ملاحظات داخلية"><div className="bos-prose"><Tx>{a.internal_notes}</Tx></div></Card> : null}
        </div>
      </div>
    </>
  );
}
