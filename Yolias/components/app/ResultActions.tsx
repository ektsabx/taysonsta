"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bookmark, BookmarkCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { collectDecisionMakers, setCompanySaved } from "@/app/(app)/prospects/people-actions";

/** Bookmark a company (in / out of Prospects). */
export function SaveCompanyButton({ id, saved, compact = false }: { id: string; saved: boolean; compact?: boolean }) {
  const { t } = useI18n();
  const [on, setOn] = useState(saved);
  const [pending, start] = useTransition();
  return (
    <button className={compact ? "icon-btn bookmark" : "btn-secondary icon-only"} type="button" aria-pressed={on} aria-label={on ? t.results.saved : t.results.save} title={on ? t.results.saved : t.results.save} disabled={pending}
      onClick={() => start(async () => {
        const r = await setCompanySaved(id, !on);
        if (r.ok) setOn(!on);
      })}>
      {on ? <BookmarkCheck className="on" /> : <Bookmark />}
    </button>
  );
}

/** "Collect decision makers" for one company (free, D-146). */
export function CollectButton({ id, running }: { id: string; running: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [queued, setQueued] = useState(running);
  return (
    <button className="btn-primary" type="button" disabled={pending || queued} onClick={() => start(async () => {
      const r = await collectDecisionMakers([id]);
      if (r.ok) setQueued(true);
      router.refresh();
    })}>
      {queued ? t.results.collecting : t.results.collect} {!queued && <ArrowRight className="flip-rtl" />}
    </button>
  );
}
