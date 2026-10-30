"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Rocket, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { approveOutreach, runOutreach, setCampaignAim } from "@/app/(app)/outreach/actions";
import { AIMS, aimUsesLink } from "@/lib/outreach/aim";
import type { CampaignAim } from "@/types/acquisition";
import { openSettingsTab } from "@/components/app/open-settings";
import { useRun } from "./bits";
import { mailboxDomainChecks } from "@/app/(app)/settings/mailbox-actions";
import type { DomainCheck } from "@/lib/mailbox/domain-check";
import type { LaunchSummary } from "@/services/outreach-campaigns";
import type { MessageObjective } from "@/types/database";

export interface MailboxOption { id: string; email: string; provider: string }

// Approve and run a campaign (D-229). Shows exactly what will happen —
// recipients, channel, the first message, the sequence and the daily limit —
// and sends nothing until the member presses Approve. A connected mailbox is
// required (D-239): Yolias sends from it and, by default, answers simple
// replies itself.
export function LaunchPanel({ summary, mailboxes, mailboxName, dailyLimit }: { summary: LaunchSummary; mailboxes: MailboxOption[]; mailboxName: string | null; dailyLimit: number }) {
  const { t } = useI18n();
  const o = t.ws.outreach;
  const l = o.launch;
  const { run, pending } = useRun();
  const router = useRouter();
  const c = summary.campaign;
  const email = c.channel === "email";
  const [mailbox, setMailbox] = useState<string>(email && mailboxes[0] ? mailboxes[0].id : "");
  const [autoReply, setAutoReply] = useState(true);
  const [aim, setAim] = useState<CampaignAim>((c.aim as CampaignAim | undefined) ?? "meeting");
  const [cta, setCta] = useState<string>(c.cta_url ?? "");
  const aimChanged = aim !== (c.aim ?? "meeting") || cta.trim() !== (c.cta_url ?? "");
  const approved = Boolean(c.approved_at);
  const archived = c.status === "archived";
  // The sending domain's SPF / DKIM / DMARC (owner, 2026-10-29): said here, before anything goes out.
  const [checks, setChecks] = useState<DomainCheck[]>([]);
  useEffect(() => { if (!approved && email) mailboxDomainChecks().then(setChecks).catch(() => setChecks([])); }, [approved, email]);
  const chosen = mailboxes.find((m) => m.id === mailbox)?.email.split("@")[1]?.toLowerCase();
  const weak = checks.find((d) => d.domain === chosen && !d.shared && (["spf", "dkim", "dmarc"] as const).some((k) => d[k] === "missing"));

  if (approved && !archived) {
    return (
      <section className="ws-card launch-panel">
        <div className="launch-head">
          <div>
            <h3>{c.status === "active" ? l.running : l.paused}</h3>
            <p className="ws-muted">{c.send_mode === "mailbox" ? fmt(l.sendingFrom, { email: mailboxName ?? "" }) : l.manualMode}{c.auto_reply ? ` · ${l.autoReplyOn}` : ""} · {l.aims[(c.aim as CampaignAim | undefined) ?? "meeting"]}</p>
          </div>
          <div className="ws-inline">
            {c.status === "active"
              ? <button className="btn-secondary" type="button" disabled={pending} onClick={() => run(() => runOutreach(c.id, "pause"))}><Pause size={14} /> {o.actions.pause}</button>
              : <button className="btn-primary" type="button" disabled={pending} onClick={() => run(() => runOutreach(c.id, "resume"))}><Play size={14} /> {o.actions.resume}</button>}
            <button className="btn-secondary" type="button" disabled={pending} onClick={() => { if (confirm(l.cancelConfirm)) run(() => runOutreach(c.id, "cancel")); }}><XCircle size={14} /> {l.cancel}</button>
          </div>
        </div>
      </section>
    );
  }
  if (archived) return null;

  return (
    <section className="ws-card launch-panel">
      <div className="launch-head">
        <div>
          <h3>{l.title}</h3>
          <p className="ws-muted">{l.lead}</p>
        </div>
      </div>
      <dl className="launch-facts">
        <div><dt>{l.recipients}</dt><dd>{summary.recipients}{email && summary.withEmail < summary.recipients ? <span className="cell-sub launch-sub">{fmt(l.withEmail, { count: summary.withEmail })}</span> : null}</dd></div>
        <div><dt>{o.form.channel}</dt><dd>{o.channels.email}</dd></div>
        <div><dt>{o.form.steps}</dt><dd>{summary.steps.map((s) => `${o.objectives[s.objective as MessageObjective]}${s.position > 1 ? ` (${fmt(l.after, { days: s.delay_days })})` : ""}`).join(" → ") || "-"}</dd></div>
        <div><dt>{l.dailyLimit}</dt><dd>{fmt(l.perDay, { count: dailyLimit })}</dd></div>
      </dl>
      {weak && (
        <div className="ws-note launch-domain" role="alert">
          <span>{fmt(l.domainWeak, { domain: weak.domain, missing: (["spf", "dkim", "dmarc"] as const).filter((k) => weak[k] === "missing").map((k) => k.toUpperCase()).join(", ") })}</span>
          <button type="button" className="link-button" onClick={() => openSettingsTab("integration")}>{l.domainFix}</button>
        </div>
      )}
      {/* What the campaign is for (D-253): the agent writes and answers for this aim. */}
      <div className="launch-aim">
        <div className="ws-field">
          <label className="ws-label" htmlFor="launch-aim">{l.aim}</label>
          <select id="launch-aim" className="form-select" value={aim} onChange={(e) => setAim(e.target.value as CampaignAim)}>
            {AIMS.map((a) => <option key={a} value={a}>{l.aims[a]}</option>)}
          </select>
          <span className="cell-sub">{l.aimHints[aim]}</span>
        </div>
        {aimUsesLink(aim) && <div className="ws-field">
          <label className="ws-label" htmlFor="launch-cta">{l.ctaUrl[aim]}</label>
          <input id="launch-cta" className="form-input" dir="ltr" type="url" inputMode="url" placeholder={l.ctaPh} value={cta} maxLength={500} onChange={(e) => setCta(e.target.value)} />
        </div>}
        {aimChanged && <button className="btn-secondary ws-btn-sm" type="button" disabled={pending} onClick={() => run(() => setCampaignAim(c.id, aim, cta.trim() || null))}>{l.saveAim}</button>}
      </div>
      {summary.sample ? (
        <div className="launch-sample">
          <div className="ws-label">{l.sample}</div>
          {summary.sample.subject ? <strong dir="auto">{summary.sample.subject}</strong> : null}
          <p dir="auto">{summary.sample.body}</p>
        </div>
      ) : <p className="ws-muted">{l.noSample}</p>}

      {email ? (
        mailboxes.length ? (
          <div className="ws-grid-2">
            <div className="ws-field">
              <label className="ws-label" htmlFor="launch-mailbox">{l.sendFrom}</label>
              <select id="launch-mailbox" className="form-select" value={mailbox} onChange={(e) => setMailbox(e.target.value)}>
                {mailboxes.map((m) => <option key={m.id} value={m.id}>{m.email}</option>)}
              </select>
            </div>
            <label className="affiliate-accept launch-autoreply">
              <input type="checkbox" checked={autoReply} onChange={(e) => setAutoReply(e.target.checked)} />
              <span><strong>{l.autoReply}</strong><br /><span className="ws-muted">{l.autoReplyHint}</span></span>
            </label>
          </div>
        ) : (
          <p className="ws-note launch-note">{l.noMailbox} <button type="button" className="link-button" onClick={() => openSettingsTab("integration")}>{l.connectMailbox}</button></p>
        )
      ) : null}

      <p className="ws-note launch-note">{l.autopilot}</p>
      <div className="ws-actions">
        <button className="btn-primary" type="button" disabled={pending || !summary.recipients || !mailbox || aimChanged} onClick={() => {
          if (!confirm(fmt(l.confirmSend, { count: summary.withEmail }))) return;
          // After approval the member watches the emails being written and sent in Conversations (D-269).
          run(() => approveOutreach(c.id, mailbox, autoReply), { onOk: () => router.push(`/inbox?tab=sent&campaign=${c.id}`) });
        }}><Rocket size={14} /> {l.approveSend}</button>
      </div>
    </section>
  );
}
