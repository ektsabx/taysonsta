"use client";

import type { BookingContent, SelectOption } from "@/content/booking";
import { countryCodes } from "@/content/country-codes";
import type { Locale } from "@/lib/i18n";

export interface ApplicationFormValues {
  name: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
  gccResident: string;
  need: string;
  projectType: string;
  ideaClarity: string;
  validationStage: string;
  revenueGoal: string;
  startTiming: string;
  decisionMaker: string;
  investmentReadiness: string;
  source: string;
}

interface ApplicationFormProps {
  content: BookingContent["form"];
  values: ApplicationFormValues;
  onChange: (values: ApplicationFormValues) => void;
  locale: Locale;
  investmentPrice: string;
}

export function OptionGroup({
  name,
  options,
  value,
  onSelect,
}: {
  name: string;
  options: SelectOption[];
  value: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="booking-options">
      {options.map((option) => (
        <label
          key={option.value}
          className={`booking-option${value === option.value ? " active" : ""}`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onSelect(option.value)}
            required
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

export function ApplicationForm({ content, values, onChange, locale, investmentPrice }: ApplicationFormProps) {
  const set = <K extends keyof ApplicationFormValues>(key: K, value: ApplicationFormValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="booking-form">
      <div>
        <label className="booking-field-label" htmlFor="booking-name">{content.name}</label>
        <input
          id="booking-name"
          className="booking-input"
          type="text"
          value={values.name}
          onChange={(event) => set("name", event.target.value)}
          required
        />
      </div>

      <div>
        <label className="booking-field-label" htmlFor="booking-email">{content.email}</label>
        <input
          id="booking-email"
          className="booking-input"
          type="email"
          value={values.email}
          onChange={(event) => set("email", event.target.value)}
          required
        />
      </div>

      <div>
        <label className="booking-field-label" htmlFor="booking-phone">{content.phone}</label>
        <div className="booking-phone-row">
          <select
            className="booking-input booking-phone-code"
            value={values.phoneCountryCode}
            onChange={(event) => set("phoneCountryCode", event.target.value)}
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
            onChange={(event) => set("phoneNumber", event.target.value.replace(/[^0-9]/g, ""))}
            required
          />
        </div>
      </div>

      <div>
        <div className="booking-field-label">{content.gccResident}</div>
        <OptionGroup name="gccResident" options={content.gccOptions} value={values.gccResident} onSelect={(v) => set("gccResident", v)} />
      </div>

      <div>
        <div className="booking-field-label">{content.need}</div>
        <OptionGroup name="need" options={content.needOptions} value={values.need} onSelect={(v) => set("need", v)} />
      </div>

      <div>
        <div className="booking-field-label">{content.projectType}</div>
        <OptionGroup name="projectType" options={content.projectTypeOptions} value={values.projectType} onSelect={(v) => set("projectType", v)} />
      </div>

      <div>
        <div className="booking-field-label">{content.ideaClarity}</div>
        <OptionGroup name="ideaClarity" options={content.ideaClarityOptions} value={values.ideaClarity} onSelect={(v) => set("ideaClarity", v)} />
      </div>

      <div>
        <div className="booking-field-label">{content.validationStage}</div>
        <OptionGroup name="validationStage" options={content.validationStageOptions} value={values.validationStage} onSelect={(v) => set("validationStage", v)} />
      </div>

      <div>
        <div className="booking-field-label">{content.revenueGoal}</div>
        <OptionGroup name="revenueGoal" options={content.revenueOptions} value={values.revenueGoal} onSelect={(v) => set("revenueGoal", v)} />
      </div>

      <div>
        <div className="booking-field-label">{content.startTiming}</div>
        <OptionGroup name="startTiming" options={content.startOptions} value={values.startTiming} onSelect={(v) => set("startTiming", v)} />
      </div>

      <div>
        <div className="booking-field-label">{content.decisionMaker}</div>
        <OptionGroup name="decisionMaker" options={content.decisionOptions} value={values.decisionMaker} onSelect={(v) => set("decisionMaker", v)} />
      </div>

      <div>
        <div className="booking-field-label">{content.investment}</div>
        <p className="booking-field-hint">{content.investmentIntro.replace("{price}", investmentPrice)}</p>
        <OptionGroup name="investmentReadiness" options={content.investmentOptions} value={values.investmentReadiness} onSelect={(v) => set("investmentReadiness", v)} />
      </div>

      <div>
        <div className="booking-field-label">{content.source}</div>
        <OptionGroup name="source" options={content.sourceOptions} value={values.source} onSelect={(v) => set("source", v)} />
      </div>
    </div>
  );
}
