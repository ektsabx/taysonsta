"use client";

import { useState } from "react";
import { Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

/** "Copy page": the article as Markdown, ready to paste into an AI chat or notes. */
export function CopyPageButton({ markdown }: { markdown: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="copy-page focus-ring" onClick={() => {
      void navigator.clipboard?.writeText(markdown).then(() => { setDone(true); setTimeout(() => setDone(false), 2000); }, () => {});
    }}>
      {done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span>{done ? t.site.copied : t.site.copyPage}</span>
    </button>
  );
}

/** "Was this helpful?" at the end of an article: one vote per visitor, can be changed. */
export function ArticleFeedback({ kind, slug }: { kind: "docs" | "help" | "blog"; slug: string }) {
  const { t, locale } = useI18n();
  const [vote, setVote] = useState<boolean | null>(null);
  const send = (helpful: boolean) => {
    setVote(helpful);
    void fetch("/api/content-feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, slug, helpful, locale }) }).catch(() => {});
  };
  return (
    <div className="article-feedback" role="group" aria-label={t.site.helpfulQuestion}>
      <span>{vote === null ? t.site.helpfulQuestion : t.site.helpfulThanks}</span>
      <div className="article-feedback-buttons">
        <button type="button" className={`focus-ring${vote === true ? " on" : ""}`} aria-pressed={vote === true} onClick={() => send(true)}><ThumbsUp aria-hidden="true" /> {t.site.helpfulYes}</button>
        <button type="button" className={`focus-ring${vote === false ? " on" : ""}`} aria-pressed={vote === false} onClick={() => send(false)}><ThumbsDown aria-hidden="true" /> {t.site.helpfulNo}</button>
      </div>
    </div>
  );
}
