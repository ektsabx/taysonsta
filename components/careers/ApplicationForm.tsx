"use client";

import { useState, type FormEvent } from "react";
import type { Dictionary } from "@/content/dictionaries";

interface ApplicationFormProps {
  jobId: string;
  t: Dictionary["careers"];
  alreadyApplied: boolean;
}

export function ApplicationForm({ jobId, t, alreadyApplied }: ApplicationFormProps) {
  const [submitted, setSubmitted] = useState(alreadyApplied);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("jobId", jobId);

    try {
      const response = await fetch("/api/careers/applications", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("submit failed");
      }

      setSubmitted(true);
    } catch {
      setError(t.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="career-apply-success">
        <h3>{alreadyApplied ? t.alreadyAppliedTitle : t.applySuccessTitle}</h3>
        <p>{alreadyApplied ? t.alreadyAppliedDesc : t.applySuccessDesc}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="career-apply-form">
      <div className="career-form-grid">
        <div className="career-field">
          <label htmlFor="firstName">{t.firstName}</label>
          <input id="firstName" name="firstName" required minLength={2} maxLength={100} />
        </div>
        <div className="career-field">
          <label htmlFor="lastName">{t.lastName}</label>
          <input id="lastName" name="lastName" required minLength={2} maxLength={100} />
        </div>
        <div className="career-field">
          <label htmlFor="phone">{t.phone}</label>
          <input id="phone" name="phone" type="tel" dir="ltr" required minLength={6} maxLength={30} />
        </div>
        <div className="career-field">
          <label htmlFor="email">{t.email}</label>
          <input id="email" name="email" type="email" required maxLength={200} />
        </div>
        <div className="career-field">
          <label htmlFor="instagramHandle">{t.instagram}</label>
          <input id="instagramHandle" name="instagramHandle" required maxLength={100} />
        </div>
        <div className="career-field">
          <label htmlFor="otherSocials">{t.otherSocials}</label>
          <input id="otherSocials" name="otherSocials" maxLength={500} />
        </div>
        <div className="career-field">
          <label htmlFor="country">{t.country}</label>
          <input id="country" name="country" required maxLength={100} />
        </div>
        <div className="career-field">
          <label htmlFor="age">{t.age}</label>
          <input id="age" name="age" type="number" min={14} max={100} required />
        </div>
        <div className="career-field">
          <label htmlFor="educationStatus">{t.educationStatus}</label>
          <input id="educationStatus" name="educationStatus" required maxLength={300} />
        </div>
        <div className="career-field">
          <label htmlFor="coursesCompleted">{t.coursesCompleted}</label>
          <input id="coursesCompleted" name="coursesCompleted" maxLength={1000} />
        </div>
        <div className="career-field">
          <label htmlFor="yearsExperience">{t.yearsExperience}</label>
          <input id="yearsExperience" name="yearsExperience" type="number" min={0} max={60} step={0.5} required />
        </div>
        <div className="career-field">
          <label htmlFor="expectedSalary">{t.expectedSalary}</label>
          <input id="expectedSalary" name="expectedSalary" required maxLength={200} />
        </div>
      </div>

      <div className="career-field">
        <label htmlFor="bio">{t.bio}</label>
        <textarea id="bio" name="bio" required minLength={10} maxLength={3000} />
      </div>
      <div className="career-field">
        <label htmlFor="whyFit">{t.whyFit}</label>
        <textarea id="whyFit" name="whyFit" required minLength={10} maxLength={3000} />
      </div>
      <div className="career-field">
        <label htmlFor="portfolioFile">{t.portfolioFile}</label>
        <input id="portfolioFile" name="portfolioFile" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip" />
      </div>

      {error ? <p className="career-error">{error}</p> : null}

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? t.submitting : t.submit}
      </button>
    </form>
  );
}
