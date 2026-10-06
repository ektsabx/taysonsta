"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Square, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/Toast";
import { isActive, isFinished } from "@/lib/discovery/states";
import { pauseCampaign, resumeCampaign, runCampaignNow, stopCampaign, type CampaignResult } from "@/app/(app)/campaigns/actions";
import type { CampaignStatus } from "@/types/database";

interface Props {
  id: string;
  status: CampaignStatus;
}

// Campaign controls (final spec phase 6): pause / resume / run now / stop.
// Goal, deadline and schedule are changed by asking Yolias AI in the search's
// conversation (owner decision: no settings form on Campaigns).
export function CampaignControls({ id, status }: Props) {
  const { t } = useI18n();
  const c = t.campaigns;
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<CampaignResult>, ok: string) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) {
        toast(ok);
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
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
