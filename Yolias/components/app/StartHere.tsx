"use client";

import Link from "next/link";
import { Check, Mail, Search, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { openSettingsTab } from "@/components/app/open-settings";

export interface StartSteps { mailbox: boolean; search: boolean; campaign: boolean }

// Start here (owner, 2026-10-28): three steps for a new workspace under the
// composer: connect a mailbox, write a first search, review a first campaign.
// Each step is done from real rows; the card goes away once all three are.
export function StartHere({ steps }: { steps: StartSteps }) {
  const { t } = useI18n();
  const s = t.startHere;
  if (steps.mailbox && steps.search && steps.campaign) return null;
  const done = [steps.mailbox, steps.search, steps.campaign].filter(Boolean).length;
  const focusComposer = () => document.querySelector<HTMLTextAreaElement>(".prompt-input")?.focus();
  const items = [
    { key: "mailbox", ok: steps.mailbox, icon: Mail, title: s.mailbox, desc: s.mailboxDesc, action: <button type="button" className="start-here-go" onClick={() => openSettingsTab("integration")}>{s.mailboxCta}</button> },
    { key: "search", ok: steps.search, icon: Search, title: s.search, desc: s.searchDesc, action: <button type="button" className="start-here-go" onClick={focusComposer}>{s.searchCta}</button> },
    { key: "campaign", ok: steps.campaign, icon: Send, title: s.campaign, desc: s.campaignDesc, action: <Link className="start-here-go" href="/outreach">{s.campaignCta}</Link> },
  ];
  return (
    <section className="start-here" aria-label={s.title}>
      <div className="start-here-head">
        <h2>{s.title}</h2>
        <span>{s.progress.replace("{done}", String(done))}</span>
      </div>
      <ol>
        {items.map(({ key, ok, icon: Icon, title, desc, action }, i) => (
          <li key={key} className={ok ? "done" : ""}>
            <span className="start-here-mark" aria-hidden>{ok ? <Check /> : <Icon />}</span>
            <div className="start-here-text">
              <strong>{i + 1}. {title}</strong>
              <span>{ok ? s.done : desc}</span>
            </div>
            {!ok && action}
          </li>
        ))}
      </ol>
    </section>
  );
}
