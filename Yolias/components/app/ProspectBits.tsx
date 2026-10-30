"use client";

import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";

// Small pieces of the Prospects workspace used on several pages: a company's
// decision-maker matching state.

/** Decision-maker matching state of a saved company. */
export function PeopleStatus({ status, found, requested }: { status: string | null; found: number; requested: boolean }) {
  const { t, locale } = useI18n();
  const s = t.prospects.peopleStatus;
  if (!status) return requested ? <span className="cell-sub">{s.queued}</span> : <span className="cell-sub">-</span>;
  const label = status === "done" ? fmt(s.done, { count: formatNumber(found, locale) }) : s[status as keyof typeof s];
  return <span className={`cell-sub people-${status}`}>{label}</span>;
}
