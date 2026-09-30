"use client";

import type { BookingQuestionDef } from "@/content/booking-services";
import { countryCodes } from "@/content/country-codes";
import type { Locale } from "@/lib/i18n";
import { OptionGroup } from "./ApplicationForm";

export interface DynamicFormValues {
  name: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
  answers: Record<string, string>;
}

interface FieldLabels {
  name: string;
  email: string;
  phone: string;
}

interface DynamicApplicationFormProps {
  labels: FieldLabels;
  questions: BookingQuestionDef[];
  values: DynamicFormValues;
  onChange: (values: DynamicFormValues) => void;
  locale: Locale;
}

export function DynamicApplicationForm({ labels, questions, values, onChange, locale }: DynamicApplicationFormProps) {
  function setField<K extends "name" | "email" | "phoneCountryCode" | "phoneNumber">(key: K, value: string) {
    onChange({ ...values, [key]: value });
  }

  function setAnswer(key: string, value: string) {
    onChange({ ...values, answers: { ...values.answers, [key]: value } });
  }

  return (
    <div className="booking-form">
      <div>
        <label className="booking-field-label" htmlFor="booking-name">{labels.name}</label>
        <input
          id="booking-name"
          className="booking-input"
          type="text"
          value={values.name}
          onChange={(event) => setField("name", event.target.value)}
          required
        />
      </div>

      <div>
        <label className="booking-field-label" htmlFor="booking-email">{labels.email}</label>
        <input
          id="booking-email"
          className="booking-input"
          type="email"
          value={values.email}
          onChange={(event) => setField("email", event.target.value)}
          required
        />
      </div>

      <div>
        <label className="booking-field-label" htmlFor="booking-phone">{labels.phone}</label>
        <div className="booking-phone-row">
          <select
            className="booking-input booking-phone-code"
            value={values.phoneCountryCode}
            onChange={(event) => setField("phoneCountryCode", event.target.value)}
            dir="ltr"
            required
          >
            {countryCodes.map((country) => (
              <option key={country.iso} value={country.dialCode}>
                {country.dialCode} {locale === "ar" ? country.nameAr : country.nameEn}
              </option>
            ))}
          </select>
          <input
            id="booking-phone"
            className="booking-input booking-phone-number"
            type="tel"
            inputMode="numeric"
            dir="ltr"
            value={values.phoneNumber}
            onChange={(event) => setField("phoneNumber", event.target.value.replace(/[^0-9]/g, ""))}
            required
          />
        </div>
      </div>

      {questions.map((question) => (
        <div key={question.key}>
          <div className="booking-field-label">{question.label}</div>
          <OptionGroup
            name={question.key}
            options={question.options}
            value={values.answers[question.key] ?? ""}
            onSelect={(v) => setAnswer(question.key, v)}
          />
        </div>
      ))}
    </div>
  );
}
