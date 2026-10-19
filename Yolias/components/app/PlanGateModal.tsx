"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";

const SEEN_KEY = "yolias_plan_gate_seen";

// Member without a plan (owner brief 2026-10-19): once per browser session a
// short dialog asks them to choose a plan and add a card for the free trial.
// "Keep exploring" closes it; the banner at the top stays.
export function PlanGateModal({ trialDays }: { trialDays: number | null }) {
  const { t } = useI18n();
  const g = t.planGate;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === "1"; } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen) setOpen(true);
  }, []);
  const close = () => {
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch {}
    setOpen(false);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="plan-gate-modal" role="dialog" aria-modal="true" aria-labelledby="plan-gate-title">
        <button className="modal-close-btn" type="button" aria-label={t.common.close} onClick={close}><X /></button>
        <h2 id="plan-gate-title">{trialDays ? g.title : g.titleNoTrial}</h2>
        <p>{trialDays ? fmt(g.body, { days: trialDays }) : g.bodyNoTrial}</p>
        <div className="plan-gate-actions">
          <Link className="btn-primary" href="/checkout" onClick={close}>{g.cta}</Link>
          <button className="btn-secondary" type="button" onClick={close}>{g.later}</button>
        </div>
      </div>
    </div>
  );
}
