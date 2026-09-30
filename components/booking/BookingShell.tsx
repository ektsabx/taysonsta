"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingContent } from "@/content/booking";
import type { EffectiveMeeting } from "@/services/booking-settings";
import { bookingServices, type BookingServiceId } from "@/content/booking-services";
import { localizedPath, type Locale } from "@/lib/i18n";
import { addMonths, buildMonthGrid, parseDateKey } from "@/lib/calendar";
import { ApplicationForm, type ApplicationFormValues } from "./ApplicationForm";
import { DynamicApplicationForm, type DynamicFormValues } from "./DynamicApplicationForm";

interface TimeSlot {
  startIso: string;
  endIso: string;
}

type Step = "duration" | "date" | "time" | "form";

const emptyForm: ApplicationFormValues = {
  name: "",
  email: "",
  phoneCountryCode: "+20",
  phoneNumber: "",
  gccResident: "",
  need: "",
  projectType: "",
  ideaClarity: "",
  validationStage: "",
  revenueGoal: "",
  startTiming: "",
  decisionMaker: "",
  investmentReadiness: "",
  source: "",
};

const emptyDynamicForm: DynamicFormValues = {
  name: "",
  email: "",
  phoneCountryCode: "+20",
  phoneNumber: "",
  answers: {},
};

interface BookingShellProps {
  content: BookingContent;
  meeting: EffectiveMeeting;
  locale: Locale;
  serviceId: BookingServiceId;
}

export function BookingShell({ content, meeting, locale, serviceId }: BookingShellProps) {
  const router = useRouter();
  const service = bookingServices[serviceId];
  const questions = service.questions?.(locale) ?? null;
  const showDurationStep = meeting.allowMultipleDurations && meeting.durationOptions.length > 1;
  const [step, setStep] = useState<Step>(showDurationStep ? "duration" : "date");
  const [selectedDuration, setSelectedDuration] = useState(meeting.defaultDurationMinutes);
  const [slots, setSlots] = useState<Record<string, TimeSlot[]> | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [viewMonthOverride, setViewMonthOverride] = useState<{ year: number; month: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [form, setForm] = useState<ApplicationFormValues>(emptyForm);
  const [dynamicForm, setDynamicForm] = useState<DynamicFormValues>(emptyDynamicForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/availability?duration=${selectedDuration}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setSlots(data.slots ?? {});
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDuration]);

  const dateKeys = useMemo(() => (slots ? Object.keys(slots).sort() : []), [slots]);

  const defaultMonth = useMemo(() => {
    if (dateKeys.length === 0) return null;
    const { year, month } = parseDateKey(dateKeys[0]);
    return { year, month };
  }, [dateKeys]);

  const viewMonth = viewMonthOverride ?? defaultMonth;

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    [locale]
  );
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" }),
    [locale]
  );

  async function handleSubmit() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const activeForm = questions ? dynamicForm : form;
      const { phoneCountryCode, phoneNumber, ...rest } = activeForm;
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rest,
          service: serviceId,
          phone: `${phoneCountryCode}${phoneNumber}`,
          scheduledStartIso: selectedSlot.startIso,
          scheduledEndIso: selectedSlot.endIso,
          timezone: "Africa/Cairo",
        }),
      });

      if (response.status === 409) {
        setSubmitError(content.steps.slotTaken);
        setStep("date");
        setSelectedSlot(null);
        setSelectedDate(null);
        setSubmitting(false);
        return;
      }

      if (!response.ok) {
        throw new Error("submit failed");
      }

      const result = await response.json();
      const basePath = bookingServices[serviceId].path;
      const destination = result.qualified ? `${basePath}/qualified` : `${basePath}/unqualified`;
      router.push(localizedPath(locale, destination));
    } catch {
      setSubmitError(content.steps.submitError);
      setSubmitting(false);
    }
  }

  if (step === "duration") {
    return (
      <div className="booking-flow">
        <div className="booking-step-label">{content.steps.selectDuration}</div>
        <div className="booking-durations">
          {meeting.durationOptions.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={`booking-duration-btn${selectedDuration === minutes ? " active" : ""}`}
              onClick={() => {
                setSelectedDuration(minutes);
                setStep("date");
              }}
            >
              {locale === "ar" ? `${minutes} دقيقة` : `${minutes} minutes`}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "form") {
    return (
      <div className="booking-flow">
        <div className="booking-step-label">{content.steps.application}</div>
        {questions ? (
          <DynamicApplicationForm
            labels={{ name: content.form.name, email: content.form.email, phone: content.form.phone }}
            questions={questions}
            values={dynamicForm}
            onChange={setDynamicForm}
            locale={locale}
          />
        ) : (
          <ApplicationForm content={content.form} values={form} onChange={setForm} locale={locale} investmentPrice={service.price} />
        )}
        <div className="booking-actions">
          <button type="button" className="booking-back-btn" onClick={() => setStep("time")}>
            {content.steps.back}
          </button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? content.form.submitting : content.form.submit}
          </button>
        </div>
        {submitError ? <p className="booking-error">{submitError}</p> : null}
      </div>
    );
  }

  if (step === "time" && selectedDate && slots) {
    const daySlots = slots[selectedDate] ?? [];
    return (
      <div className="booking-flow">
        <div className="booking-step-label">{content.steps.selectTime}</div>
        <div className="booking-times">
          {daySlots.map((slot) => (
            <button
              key={slot.startIso}
              type="button"
              className={`booking-time-btn${selectedSlot?.startIso === slot.startIso ? " active" : ""}`}
              onClick={() => {
                setSelectedSlot(slot);
                setStep("form");
              }}
            >
              {timeFormatter.format(new Date(slot.startIso))}
            </button>
          ))}
        </div>
        <div className="booking-actions">
          <button type="button" className="booking-back-btn" onClick={() => setStep("date")}>
            {content.steps.back}
          </button>
        </div>
      </div>
    );
  }

  const minMonth = dateKeys.length > 0 ? parseDateKey(dateKeys[0]) : null;
  const maxMonth = dateKeys.length > 0 ? parseDateKey(dateKeys[dateKeys.length - 1]) : null;
  const prevDisabled =
    !viewMonth || !minMonth || viewMonth.year * 12 + viewMonth.month <= minMonth.year * 12 + minMonth.month;
  const nextDisabled =
    !viewMonth || !maxMonth || viewMonth.year * 12 + viewMonth.month >= maxMonth.year * 12 + maxMonth.month;
  const grid = viewMonth ? buildMonthGrid(viewMonth.year, viewMonth.month) : [];

  return (
    <div className="booking-flow">
      <div className="booking-step-label">{content.steps.selectDate}</div>
      {loadError ? (
        <p className="booking-error">{content.steps.submitError}</p>
      ) : slots === null ? (
        <p>{content.steps.loadingSlots}</p>
      ) : dateKeys.length === 0 ? (
        <p>{content.steps.noSlots}</p>
      ) : viewMonth ? (
        <>
          <div className="booking-calendar-header">
            <button
              type="button"
              className="booking-calendar-nav-btn"
              disabled={prevDisabled}
              onClick={() => setViewMonthOverride(addMonths(viewMonth.year, viewMonth.month, -1))}
              aria-label={content.steps.back}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="booking-calendar-month-label">
              {monthFormatter.format(new Date(Date.UTC(viewMonth.year, viewMonth.month, 1)))}
            </span>
            <button
              type="button"
              className="booking-calendar-nav-btn"
              disabled={nextDisabled}
              onClick={() => setViewMonthOverride(addMonths(viewMonth.year, viewMonth.month, 1))}
              aria-label={content.steps.selectDate}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="booking-calendar-grid">
            {content.calendar.weekdayShort.map((label) => (
              <div className="booking-calendar-weekday" key={label}>
                {label}
              </div>
            ))}
            {grid.map((cell, index) =>
              cell === null ? (
                <span key={`empty-${index}`} />
              ) : (
                <button
                  key={cell.dateKey}
                  type="button"
                  className={`booking-calendar-day${selectedDate === cell.dateKey ? " active" : ""}`}
                  disabled={!slots[cell.dateKey]}
                  onClick={() => {
                    setSelectedDate(cell.dateKey);
                    setStep("time");
                  }}
                >
                  {cell.day}
                </button>
              )
            )}
          </div>
        </>
      ) : null}
      {showDurationStep ? (
        <div className="booking-actions">
          <button type="button" className="booking-back-btn" onClick={() => setStep("duration")}>
            {content.steps.back}
          </button>
        </div>
      ) : null}
      {submitError ? <p className="booking-error">{submitError}</p> : null}
    </div>
  );
}
