"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Circle, Users, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { setupState, type SetupState, type SetupStep } from "@/app/(app)/setup-actions";
import { openSettingsTab } from "./open-settings";

const KEY = "yolias_setup_v1";
const STEPS: SetupStep[] = ["knowledge", "mailbox", "booking", "pixel", "credit", "campaign", "launch"];

// "Get ready for your first campaign!" (owner, 2026-11-10): opens on its own
// after signup, then folds to a small bar until every step is done.
export function SetupChecklist() {
  const { t } = useI18n();
  const L = t.firstRun;
  const [s, setS] = useState<SetupState | null>(null);
  const [open, setOpen] = useState(true);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try { const v = localStorage.getItem(KEY); if (v === "closed") setOpen(false); if (v === "hidden") setHidden(true); } catch { /* private window */ }
    void setupState().then(setS).catch(() => setS(null));
  }, []);
  const save = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* private window */ } };
  if (!s || hidden) return null;
  const done = STEPS.filter((k) => s.done[k]).length;
  if (done === STEPS.length) return null;
  const href: Record<SetupStep, string | null> = { knowledge: "/ai/knowledge", mailbox: "/integrations", booking: "/meetings?tab=page", pixel: "/events", credit: null, campaign: "/campaigns/new", launch: "/campaigns" };
  return (
    <section className={`setup${open ? " open" : ""}`} aria-label={L.title}>
      <header className="setup-head">
        <button type="button" className="setup-toggle" aria-expanded={open} onClick={() => { setOpen(!open); save(open ? "closed" : "open"); }}>
          <strong>{L.title}</strong>
          <span>{fmt(L.progress, { done: String(done), total: String(STEPS.length) })}</span>
          {open ? <ChevronDown /> : <ChevronUp />}
        </button>
        <button type="button" className="setup-close" aria-label={L.hide} title={L.hide} onClick={() => { setHidden(true); save("hidden"); }}><X /></button>
      </header>
      <div className="setup-bar"><i style={{ width: `${(done / STEPS.length) * 100}%` }} /></div>
      {open && (
        <div className="setup-body">
          <p className="setup-lead">{L.lead}</p>
          <ol className="setup-steps">
            {STEPS.map((k) => {
              const inner = <>{s.done[k] ? <CheckCircle2 className="ok" /> : <Circle />}<span><b>{L.steps[k].title}</b><em>{L.steps[k].body}</em></span><ChevronRight className="flip-rtl go" /></>;
              return (
                <li key={k} className={s.done[k] ? "done" : ""}>
                  {href[k] ? <Link href={href[k]!}>{inner}</Link> : <button type="button" onClick={() => openSettingsTab("usage")}>{inner}</button>}
                </li>
              );
            })}
          </ol>
          {!s.teammates && <button type="button" className="setup-team" onClick={() => openSettingsTab("team")}><Users />{L.team}</button>}
        </div>
      )}
    </section>
  );
}
