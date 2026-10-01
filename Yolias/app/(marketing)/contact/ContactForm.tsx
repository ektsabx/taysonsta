"use client";

import { useActionState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { submitContact, type ContactState } from "./actions";

export function ContactForm({ title, defaultTopic }: { title: string; defaultTopic: string }) {
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

  return (
    <form className="form-card" action={action} noValidate>
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="form-grid mt-5">
        <div>
          <label htmlFor="c-name">{c.name}</label>
          <input id="c-name" name="name" className="form-field" autoComplete="name" required />
        </div>
        <div>
          <label htmlFor="c-email">{c.email}</label>
          <input id="c-email" name="email" type="email" dir="ltr" className="form-field" autoComplete="email" required />
        </div>
        <div>
          <label htmlFor="c-company">{c.company}</label>
          <input id="c-company" name="company" className="form-field" autoComplete="organization" />
        </div>
        <div>
          <label htmlFor="c-topic">{c.topic}</label>
          <select id="c-topic" name="topic" className="form-field" defaultValue={defaultTopic}>
            {(Object.keys(c.topics) as (keyof typeof c.topics)[]).map((k) => <option key={k} value={k}>{c.topics[k]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="c-message">{c.message}</label>
          <textarea id="c-message" name="message" className="form-field" required />
        </div>
        <div className="hp" aria-hidden="true">
          <label htmlFor="c-website">Website</label>
          <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        {state.status === "error" && <p className="status-message status-error" role="alert">{state.message}</p>}
        <button className="primary-button focus-ring w-full" type="submit" disabled={pending}>
          {pending ? c.sending : c.submit}
          {!pending && <ArrowRight className="flip-rtl" width={17} height={17} />}
        </button>
      </div>
    </form>
  );
}
