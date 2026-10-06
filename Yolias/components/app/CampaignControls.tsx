"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Settings2, Square, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/Toast";
import { isActive, isFinished } from "@/lib/discovery/states";
import { pauseCampaign, resumeCampaign, runCampaignNow, stopCampaign, updateCampaignSettings, type CampaignResult } from "@/app/(app)/campaigns/actions";
import type { CampaignStatus } from "@/types/database";

interface Props {
  id: string;
  status: CampaignStatus;
  goal: number;
  deadline: string | null;
  continuous: boolean;
  everyHours: number;
}

// Campaign controls (final spec phase 6): pause / resume / run now / stop and
// the settings (goal, deadline, continuous schedule).
export function CampaignControls({ id, status, goal, deadline, continuous, everyHours }: Props) {
  const { t } = useI18n();
  const c = t.campaigns;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ goal: String(goal), deadline: deadline ? deadline.slice(0, 10) : "", continuous, everyHours: String(everyHours) });

  const run = (fn: () => Promise<CampaignResult>, ok: string) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) {
        toast(ok);
        setOpen(false);
        router.refresh();
      } else setError(r.error);
    });

  const running = isActive(status) || status === "scheduled" || status === "awaiting_source";
  const finished = isFinished(status);

  return (
    <div className="view-actions campaign-controls">
      {(status === "scheduled" || status === "awaiting_source") && (
        <button className="btn-secondary" type="button" disabled={pending} onClick={() => run(() => runCampaignNow(id), c.queued)}><Zap /> {c.runNow}</button>
      )}
      {running && <button className="btn-secondary" type="button" disabled={pending} onClick={() => run(() => pauseCampaign(id), c.paused)}><Pause /> {c.pause}</button>}
      {status === "paused" && <button className="btn-primary" type="button" disabled={pending} onClick={() => run(() => resumeCampaign(id), c.resumed)}><Play /> {c.resume}</button>}
      {!finished && (
        <button className="btn-danger-ghost" type="button" disabled={pending} onClick={() => window.confirm(c.stopConfirm) && run(() => stopCampaign(id), c.stopped)}><Square /> {c.stop}</button>
      )}
      <button className="btn-secondary" type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}><Settings2 /> {c.settings}</button>
      {error && !open && <p className="form-error" role="alert">{error}</p>}

      {open && (
        <form
          className="campaign-settings"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => updateCampaignSettings(id, { goal: Number(form.goal), deadline: form.deadline ? new Date(`${form.deadline}T23:59:59`).toISOString() : null, continuous: form.continuous, everyHours: Number(form.everyHours) }), c.saved);
          }}
        >
          <h3>{c.settings}</h3>
          <label className="field">
            <span>{c.goalLabel}</span>
            <input className="form-input" type="number" min={1} max={10000} step={1} required value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
          </label>
          <label className="field">
            <span>{c.deadlineLabel}</span>
            <input className="form-input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </label>
          <label className="toolbar-check">
            <input type="checkbox" checked={form.continuous} onChange={(e) => setForm({ ...form, continuous: e.target.checked })} />
            {c.continuousLabel}
          </label>
          {form.continuous && (
            <label className="field">
              <span>{c.everyLabel}</span>
              <select className="form-select" value={form.everyHours} onChange={(e) => setForm({ ...form, everyHours: e.target.value })}>
                <option value="24">{c.every["24"]}</option>
                <option value="168">{c.every["168"]}</option>
              </select>
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn-primary" type="submit" disabled={pending}>{c.save}</button>
        </form>
      )}
    </div>
  );
}
