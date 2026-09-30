import { Tx } from "@/components/bos/I18n";
import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { getBookingByIdAdmin } from "@/services/booking-admin";
import { getBookingContent, type SelectOption } from "@/content/booking";
import { bookingServices, type BookingQuestionDef, type BookingServiceDefinition } from "@/content/booking-services";
import { BookingStatusPanel } from "./BookingStatusPanel";

interface PageProps {
  params: Promise<{ id: string }>;
}

function labelFor(options: SelectOption[], value: string | null): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

function questionLabelFor(question: BookingQuestionDef, value: string): string {
  return question.options.find((o) => o.value === value)?.label ?? value;
}

export default async function BookingDetailPage({ params }: PageProps) {
  await requireAdminUser();
  const { id } = await params;
  const booking = await getBookingByIdAdmin(id);

  if (!booking) {
    notFound();
  }

  const form = getBookingContent("ar").form;

  return (
    <>
      <div className="admin-title-row">
        <h1>{booking.name}</h1>
      </div>

      <div className="admin-detail-grid">
        <div>
          <div className="admin-card">
            <h2><Tx>بيانات العميل</Tx></h2>
            <p><Tx vars={{ name: booking.name }}>{"الاسم: {name}"}</Tx></p>
            <p><Tx vars={{ email: booking.email }}>{"البريد: {email}"}</Tx></p>
            <p>الهاتف: {booking.phone ?? "—"}</p>
          </div>

          <div className="admin-card">
            <h2><Tx>بيانات الحجز</Tx></h2>
            <p><Tx vars={{ v: bookingServices[booking.service as keyof typeof bookingServices]?.label ?? booking.service }}>{"الخدمة: {v}"}</Tx></p>
            <p>
              الموعد:{" "}
              {new Date(booking.scheduled_start).toLocaleString("ar-EG", { dateStyle: "full", timeStyle: "short" })} —{" "}
              {new Date(booking.scheduled_end).toLocaleTimeString("ar-EG", { timeStyle: "short" })}
            </p>
            <p><Tx vars={{ timezone: booking.timezone }}>{"المنطقة الزمنية: {timezone}"}</Tx></p>
            <p>تاريخ الإنشاء: {new Date(booking.created_at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>

          <div className="admin-card">
            <h2><Tx>إجابات التأهيل</Tx></h2>
            {!booking.answers ? (
              <p><Tx>لا توجد إجابات مرتبطة بهذا الحجز.</Tx></p>
            ) : booking.service === "mvp" || booking.service === "growth" || booking.service === "saas" ? (
              <>
                <p>{form.gccResident}: {labelFor(form.gccOptions, booking.answers.gcc_resident)}</p>
                <p>{form.need}: {labelFor(form.needOptions, booking.answers.need)}</p>
                <p>{form.projectType}: {labelFor(form.projectTypeOptions, booking.answers.project_type)}</p>
                <p>{form.ideaClarity}: {labelFor(form.ideaClarityOptions, booking.answers.idea_clarity)}</p>
                <p>{form.validationStage}: {labelFor(form.validationStageOptions, booking.answers.validation_stage)}</p>
                <p>{form.revenueGoal}: {labelFor(form.revenueOptions, booking.answers.revenue_goal)}</p>
                <p>{form.startTiming}: {labelFor(form.startOptions, booking.answers.start_timing)}</p>
                <p>{form.decisionMaker}: {labelFor(form.decisionOptions, booking.answers.decision_maker)}</p>
                <p>{form.investment}: {labelFor(form.investmentOptions, booking.answers.investment_readiness)}</p>
                <p>{form.source}: {labelFor(form.sourceOptions, booking.answers.source)}</p>
              </>
            ) : booking.answers.answers ? (
              (() => {
                const serviceDef = bookingServices[booking.service as keyof typeof bookingServices] as
                  | BookingServiceDefinition
                  | undefined;
                const questions = serviceDef?.questions?.("ar") ?? [];
                const answers = booking.answers.answers;
                if (questions.length === 0) {
                  return (
                    <pre style={{ whiteSpace: "pre-wrap", fontSize: 12.5 }}>{JSON.stringify(answers, null, 2)}</pre>
                  );
                }
                return (
                  <>
                    {questions.map((question) => (
                      <p key={question.key}>
                        {question.label}: {answers[question.key] ? questionLabelFor(question, answers[question.key]) : "—"}
                      </p>
                    ))}
                  </>
                );
              })()
            ) : (
              <p><Tx>لا توجد إجابات مرتبطة بهذا الحجز.</Tx></p>
            )}
          </div>
        </div>

        <BookingStatusPanel booking={booking} />
      </div>
    </>
  );
}
