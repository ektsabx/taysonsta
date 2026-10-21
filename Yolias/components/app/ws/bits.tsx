"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/Toast";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { setStage } from "@/app/(app)/crm/actions";
import { STAGES } from "@/lib/automations/schema";
import type { LeadStage } from "@/types/database";

type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Runs a server action: toast on failure (or the success text), then refreshes the page data. */
export function useRun() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const { t } = useI18n();
  const run = <R extends Result>(fn: () => Promise<R>, opts: { success?: string; onOk?: (r: R & { ok: true }) => void; refresh?: boolean } = {}) =>
    start(async () => {
      const r = await callAction(fn);
      if (isNetworkFailure(r)) { toast(t.feedback.errors.network, "error"); return; }
      if (!r.ok) { toast((r as { error: string }).error, "error"); return; }
      const ok = r as R & { ok: true };
      const msg = opts.success ?? ok.message;
      if (msg) toast(msg);
      opts.onOk?.(ok);
      // Outside the transition: the button is free as soon as the action
      // answers (owner 2026-10-21, lag); the refresh lands in the background.
      if (opts.refresh !== false) setTimeout(() => router.refresh(), 0);
    });
  return { run, pending };
}

export function StageBadge({ stage }: { stage: LeadStage }) {
  const { t } = useI18n();
  return <span className={`ws-stage stage-${stage}`}>{t.ws.stages[stage]}</span>;
}

/** Change a lead's stage from anywhere (table, Kanban card, Inbox, lead page). */
export function StageSelect({ leadId, stage, label }: { leadId: string; stage: LeadStage; label?: string }) {
  const { t } = useI18n();
  const { run, pending } = useRun();
  return (
    <select
      className={`form-select ws-stage-select stage-${stage}`}
      aria-label={label ?? t.ws.crm.cols.stage}
      value={stage}
      disabled={pending}
      onChange={(e) => run(() => setStage(leadId, e.target.value as LeadStage), { success: t.ws.crm.stageChanged })}
    >
      {STAGES.map((s) => <option key={s} value={s}>{t.ws.stages[s]}</option>)}
    </select>
  );
}

/** A <select> inside a GET form that submits when changed (filters). */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
