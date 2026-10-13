"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Turnstile } from "@/components/Turnstile";
import { useI18n } from "@/lib/i18n/client";
import { submitContact, type ContactState } from "./actions";

export function ContactForm({ title, defaultTopic, captchaSiteKey }: { title: string; defaultTopic: string; captchaSiteKey?: string | null }) {
  const { t } = useI18n();
  const c = t.contact;
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="form-card" role="status">
        <CheckCircle2 className="text-[#10b981]" width={28} height={28} />
        <p className="mt-4 text-[1rem] leading-7">{c.sent}</p>
      </div>
    );
  }

  const v = state.status === "error" ? state.values ?? {} : {};
  return (
    <form className="form-card" action={action} noValidate key={state.status === "error" ? JSON.stringify(v) : "form"}>
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="form-grid mt-5">
        <div>
          <label htmlFor="c-name">{c.name}</label>
          <input id="c-name" name="name" className="form-field" autoComplete="name" required defaultValue={v.name} />
        </div>
        <div>
          <label htmlFor="c-email">{c.email}</label>
          <input id="c-email" name="email" type="email" dir="ltr" className="form-field" autoComplete="email" required defaultValue={v.email} />
        </div>
        <div>
          <label htmlFor="c-company">{c.company}</label>
          <input id="c-company" name="company" className="form-field" autoComplete="organization" defaultValue={v.company} />
        </div>
        <div>
          <label htmlFor="c-topic">{c.topic}</label>
          <select id="c-topic" name="topic" className="form-field" defaultValue={v.topic || defaultTopic}>
            {(Object.keys(c.topics) as (keyof typeof c.topics)[]).map((k) => <option key={k} value={k}>{c.topics[k]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="c-message">{c.message}</label>
          <textarea id="c-message" name="message" className="form-field" required defaultValue={v.message} />
        </div>
        <div className="hp" aria-hidden="true">
          <label htmlFor="c-website">Website</label>
          <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        {captchaSiteKey && <Turnstile siteKey={captchaSiteKey} resetKey={state} />}
        {state.status === "error" && <p className="status-message status-error" role="alert">{state.message}</p>}
        <button className="primary-button focus-ring w-full" type="submit" disabled={pending}>
          <span>{pending ? c.sending : c.submit}</span>
        </button>
      </div>
    </form>
  );
}
