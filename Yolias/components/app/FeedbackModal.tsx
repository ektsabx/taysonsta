"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, X } from "lucide-react";
import { submitFeedback } from "@/app/(app)/feedback-actions";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { useI18n } from "@/lib/i18n/client";
import { release } from "@/lib/monitoring/env";
import { IMAGE_ACCEPT, checkImageFile } from "@/lib/uploads/image";

const categories = ["bug", "feedback", "billing", "data", "account", "other"] as const;

// Feedback / Report a Bug (2026-10-12): a dialog over the current page, so
// nothing the user was doing is lost. Sends what they typed plus the page
// path (no query string), release, browser and screen size.
export function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const f = t.feedback;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const first = useRef<HTMLSelectElement>(null);

  // Focus and scroll lock once, on open.
  useEffect(() => {
    first.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !pending) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  const submit = (form: HTMLFormElement) => {
    if (pending) return;
    const fd = new FormData(form);
    fd.set("page", window.location.pathname);
    fd.set("release", release ?? "");
    fd.set("browser", navigator.userAgent.slice(0, 300));
    fd.set("viewport", `${window.innerWidth}x${window.innerHeight}@${Math.round(window.devicePixelRatio * 100) / 100}`);
    const shot = fd.get("screenshot");
    if (shot instanceof File && shot.size === 0) fd.delete("screenshot");
    setError(null);
    start(async () => {
      const r = await callAction(() => submitFeedback(fd));
      if (isNetworkFailure(r)) setError(f.errors.network);
      else if (!r.ok) setError(r.error);
      else setSent(true);
    });
  };

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !pending) onClose(); }}>
      <div className="drawer feedback-drawer" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <div className="drawer-head">
          <div>
            <h3 id="feedback-title">{f.title}</h3>
            <p>{f.lead}</p>
          </div>
          <button className="modal-close-btn" type="button" aria-label={t.common.close} onClick={onClose} disabled={pending}><X /></button>
        </div>
        {sent ? (
          <div className="drawer-body feedback-sent" role="status">
            <CheckCircle2 aria-hidden="true" />
            <strong>{f.sentTitle}</strong>
            <p>{f.sentBody}</p>
            <div><button className="btn-primary" type="button" onClick={onClose}>{t.common.close}</button></div>
          </div>
        ) : (
          <form className="drawer-body" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} noValidate>
            <div className="field">
              <label htmlFor="fb-category">{f.category}</label>
              <select ref={first} id="fb-category" name="category" className="form-input" defaultValue="bug">
                {categories.map((c) => <option key={c} value={c}>{f.categories[c]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fb-message">{f.message}</label>
              <textarea id="fb-message" name="message" className="form-input" rows={4} maxLength={5000} required placeholder={f.messagePlaceholder} />
            </div>
            <div className="field">
              <label htmlFor="fb-steps">{f.steps}<span className="field-optional">{f.optional}</span></label>
              <textarea id="fb-steps" name="steps" className="form-input" rows={3} maxLength={3000} placeholder={f.stepsPlaceholder} />
            </div>
            <div className="field">
              <label htmlFor="fb-shot">{f.screenshot}<span className="field-optional">{f.optional}</span></label>
              <input id="fb-shot" name="screenshot" type="file" accept={IMAGE_ACCEPT} className="form-input" aria-describedby="fb-shot-hint" onChange={(e) => {
                const file = e.target.files?.[0];
                const bad = file ? checkImageFile(file) : null;
                setError(bad === "size" ? f.errors.screenshotSize : bad === "type" ? f.errors.screenshotType : null);
                if (bad) e.target.value = "";
              }} />
              <p className="field-note" id="fb-shot-hint">{t.uploads.imageHint}</p>
              <p className="field-note">{f.screenshotNote}</p>
            </div>
            <div className="hp" aria-hidden="true">
              <label htmlFor="fb-website">Website</label>
              <input id="fb-website" name="website" tabIndex={-1} autoComplete="off" />
            </div>
            <p className="field-note">{f.privacy}</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="feedback-actions">
              <button className="btn-secondary" type="button" onClick={onClose} disabled={pending}>{f.cancel}</button>
              <button className="btn-primary" type="submit" disabled={pending} aria-busy={pending}><span>{pending ? f.sending : f.send}</span></button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
