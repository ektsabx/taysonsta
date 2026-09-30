"use client";

import { useState } from "react";

interface NewsletterFormProps {
  heading: string;
  description: string;
  placeholder: string;
  submitLabel: string;
  submittingLabel: string;
  successMessage: string;
  errorMessage: string;
}

type Status = "idle" | "submitting" | "success" | "error";

export function NewsletterForm({
  heading,
  description,
  placeholder,
  submitLabel,
  submittingLabel,
  successMessage,
  errorMessage,
}: NewsletterFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("submitting");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error("failed");
      }

      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="ed-footer-newsletter">
      <h4>{heading}</h4>
      <p className="ed-footer-newsletter-desc">{description}</p>
      <form className="ed-footer-newsletter-form" onSubmit={handleSubmit}>
        <input
          type="email"
          className="ed-footer-newsletter-input"
          placeholder={placeholder}
          dir="ltr"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" className="ed-footer-newsletter-btn" disabled={status === "submitting"}>
          {status === "submitting" ? submittingLabel : submitLabel}
        </button>
      </form>
      {status === "success" ? <p className="ed-footer-newsletter-msg success">{successMessage}</p> : null}
      {status === "error" ? <p className="ed-footer-newsletter-msg error">{errorMessage}</p> : null}
    </div>
  );
}
