"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { workflowDemo, type WorkflowText } from "@/lib/content/workflows";
import { frames } from "@/lib/content/workflow-frames";
import type { Locale } from "@/lib/i18n/config";

// A walkthrough of real Yolias screens: click the highlighted spot, or use the
// buttons, to move through the workflow (owner, 2026-11-05).
export function WorkflowDemo({ steps, locale }: { steps: WorkflowText["steps"]; locale: Locale }) {
  const L = workflowDemo[locale];
  const [i, setI] = useState(0);
  const s = steps[i];
  const spot = frames[locale]?.[s.shot] ?? null;
  const last = i === steps.length - 1;
  return (
    <div className="wf-demo">
      <div className="wf-demo-head"><strong>{L.title}</strong><span>{L.hint}</span></div>
      <div className="wf-demo-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/use-cases/${s.shot}-${locale}.png`} alt={s.title} />
        {spot && <button type="button" className="wf-spot" style={{ insetInlineStart: undefined, left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, height: `${spot.h}%` }} aria-label={L.next} onClick={() => setI(last ? 0 : i + 1)}><span /></button>}
      </div>
      <div className="wf-demo-foot">
        <div><b>{i + 1} {L.of} {steps.length}</b> · {s.title}</div>
        <div className="wf-demo-nav">
          <button type="button" className="btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}><ArrowRight className="wf-flip" />{L.back}</button>
          <button type="button" className="btn-solid" onClick={() => setI(last ? 0 : i + 1)}>{last ? <RotateCcw /> : <ArrowLeft className="wf-flip" />}{last ? L.restart : L.next}</button>
        </div>
      </div>
    </div>
  );
}
