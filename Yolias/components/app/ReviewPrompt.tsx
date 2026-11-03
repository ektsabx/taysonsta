"use client";

import { useEffect, useRef, useState } from "react";
import { Star, X } from "lucide-react";
import { recordReviewPrompt } from "@/app/(app)/settings/actions";
import { useI18n } from "@/lib/i18n/client";

// A small card in the corner (never a blocking dialog), shown once per user
// after a first real success (lib/review-prompt.ts; Admin → Popups).
export function ReviewPrompt({ url }: { url: string }) {
  const { t } = useI18n();
  const r = t.review;
  const [open, setOpen] = useState(true);
  const marked = useRef(false);

  // Marked as asked as soon as it appears, so it never comes back.
  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    void recordReviewPrompt("shown").catch(() => {});
  }, []);

  if (!open) return null;
  const close = (action: "opened" | "dismissed") => {
    setOpen(false);
    void recordReviewPrompt(action).catch(() => {});
  };
  return (
    <aside className="review-prompt" role="complementary" aria-labelledby="review-prompt-title">
      <button className="review-prompt-close" type="button" aria-label={r.later} onClick={() => close("dismissed")}><X /></button>
      <Star className="review-prompt-icon" aria-hidden="true" />
      <strong id="review-prompt-title">{r.title}</strong>
      <p>{r.body}</p>
      <div className="review-prompt-actions">
        <a className="btn-primary" href={url} target="_blank" rel="noopener noreferrer" onClick={() => close("opened")}>{r.cta}</a>
        <button className="btn-secondary" type="button" onClick={() => close("dismissed")}>{r.later}</button>
      </div>
    </aside>
  );
}
