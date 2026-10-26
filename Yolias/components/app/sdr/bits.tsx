"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import type { ReplyKind } from "@/services/pipeline";

// Small pieces shared by the outreach workspace pages (D-256, after AgentSDR).

const KIND_TONE: Record<ReplyKind, string> = {
  interested: "green", meeting_request: "green", question: "green", objection: "blue",
  not_interested: "red", stop_request: "red", out_of_office: "violet", asks_for_human: "gray", unclear: "gray", unclassified: "outline nodot",
};

/** How Yolias read a reply, as a coloured badge (Interested, Out of Office, Unclassified…). */
export function KindBadge({ kind }: { kind: ReplyKind }) {
  const { t } = useI18n();
  return <span className={`sdr-badge ${KIND_TONE[kind]}`}>{t.sdr.kinds[kind]}</span>;
}

/** A ⋯ button with a menu; the menu closes on any click outside it. */
export function RowMenu({ label, children, wide }: { label: string; children: (close: () => void) => React.ReactNode; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="sdr-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="sdr-icon-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}><MoreHorizontal /></button>
      {open && <div className="sdr-menu-panel" role="menu" style={wide ? { minWidth: 240 } : undefined}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

/** The progress ring in front of a campaign (share of its sends done). */
export function Ring({ pct, done }: { pct: number; done?: boolean }) {
  const r = 17, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, pct));
  return (
    <svg className="sdr-ring" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--track)" strokeWidth="3" />
      <circle cx="20" cy="20" r={r} fill="none" stroke={done ? "var(--blue)" : "var(--green)"} strokeWidth="3" strokeDasharray={`${(v / 100) * c} ${c}`} strokeLinecap="round" transform="rotate(-90 20 20)" />
      {done ? <path d="M14 20.5l4 4 8-8" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : <text x="20" y="23.5" textAnchor="middle">{Math.round(v)}%</text>}
    </svg>
  );
}

export const initials = (v: string) => v.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join("") || "?";

/** "2h ago", "5d ago", in the reader's language. */
export function useAgo() {
  const { locale } = useI18n();
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar" : "en", { numeric: "auto", style: "narrow" });
  return (iso: string | null | undefined, now = Date.now()) => {
    if (!iso) return null;
    const s = (Date.parse(iso) - now) / 1000;
    const a = Math.abs(s);
    if (a < 60) return rtf.format(Math.round(s), "second");
    if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
    if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
    if (a < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
    return rtf.format(Math.round(s / (86400 * 30)), "month");
  };
}
