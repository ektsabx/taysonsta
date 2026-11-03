"use client";

import { useState, useTransition } from "react";
import { audienceIssues } from "@/lib/campaigns/audience-check";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Check, ChevronDown, ClipboardList, Copy, Folder, Loader2, Mail, Plus, Search, Send, ShoppingCart, Sparkles, Trash2, UserCheck, Users, X } from "lucide-react";
import { LEAD_EVENTS, PURCHASE_EVENTS } from "@/lib/pixel-events";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { useToast } from "@/components/Toast";
import { languageLabels, messageLanguages } from "@/lib/outreach/channels";
import { budgetPeople, emptyAdSet, minBudgetUsd, missing, scheduleCapacity, type AdSet, type BuilderState, type Level } from "@/lib/campaigns/builder";
import type { Targeting } from "@/lib/campaigns/targeting";
import type { Estimate } from "@/lib/campaigns/audience";
import { checkAudiences, launchCampaign, previewEmail, saveDraft, updateCampaign, writeApproach } from "@/app/(app)/outreach/new/actions";
import { saveAudience } from "@/app/(app)/audiences/actions";
import { TargetingEditor } from "./TargetingEditor";

// Creating a campaign (owner, 2026-10-31, D-273), after Facebook Ads Manager:
// one page with a tree on the side (Campaign → Audiences → Message), the form
// of the selected level in the middle and a summary beside it. Three steps,
// any level can be opened and edited without losing the rest; the draft is
// saved when the member moves between levels and with "Save draft".

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const usd = (v: number, digits = 2) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: v % 1 ? 2 : 0 }).format(v);

export interface BuilderProps {
  mode: "new" | "edit";
  campaignId: string | null;
  draftId: string | null;
  initial: BuilderState;
  /** Audiences already running in an edited campaign: their targeting can't change. */
  locked: string[];
  rate: number;
  balanceUsd: number | null;
  offers: { id: string; name: string }[];
  knowledgePct: number;
  mailboxes: { id: string; email: string; dailyLimit: number }[];
  booking: { url: string | null; calendar: boolean };
  /** D-274: the workspace's pixels (for website objectives), and whether each has sent an event yet. */
  pixels: { id: string; name: string; publicId: string; seen: boolean }[];
  audiences: { id: string; name: string; kind: "saved" | "custom" | "lookalike"; members: number }[];
  zones: { value: string; label: string }[];
  today: string;
}

export function CampaignBuilder(p: BuilderProps) {
  const { t, locale } = useI18n();
  const b = t.ag.builder;
  const K = t.ag.rx.build;
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [s, setS] = useState<BuilderState>(p.initial);
  const [draftId, setDraftId] = useState(p.draftId);
  const [sel, setSel] = useState(0);
  const [estimates, setEstimates] = useState<Record<string, Estimate>>({});
  const [samples, setSamples] = useState<Record<string, { subject: string; body: string; who: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const n = (v: number) => formatNumber(v, locale);
  const patch = (x: Partial<BuilderState>) => setS((cur) => ({ ...cur, ...x }));
  const setAd = (i: number, x: Partial<AdSet>) => setS((cur) => ({ ...cur, adSets: cur.adSets.map((a, j) => (j === i ? { ...a, ...x } : a)) }));
  const level = s.level;
  const editing = p.mode === "edit";
  const gaps = missing(s, p.rate);

  const call = <R extends { ok: boolean }>(fn: () => Promise<R>, then: (r: R) => void, tag: string | null = null) => {
    setBusy(tag);
    start(async () => {
      const r = await callAction(fn);
      setBusy(null);
      if (isNetworkFailure(r)) { toast(t.feedback.errors.network, "error"); return; }
      if (!r.ok) { toast((r as unknown as { error: string }).error, "error"); return; }
      then(r);
    });
  };
  const persist = (next: BuilderState, silent = true) => {
    if (editing) return;
    call(() => saveDraft(next, draftId), (r) => {
      const id = (r as unknown as { id: string }).id;
      if (id !== draftId) { setDraftId(id); window.history.replaceState(null, "", `/outreach/new?draft=${id}`); }
      if (!silent) toast(b.saved);
    });
  };
  const go = (l: Level, i = sel) => {
    const next = { ...s, level: l };
    setS(next); setSel(i);
    if (s.name.trim() || draftId) persist(next);
    if (l === "audience") check(next.adSets);
  };
  const check = (sets: AdSet[]) => callAction(() => checkAudiences(sets.map((a) => ({ source: a.source, audienceId: a.audienceId, targeting: a.targeting as Record<string, unknown> }))))
    .then((r) => { if (!isNetworkFailure(r) && r.ok) setEstimates(Object.fromEntries(sets.map((a, i) => [a.key, r.estimates[i]]))); });

  const people = budgetPeople(s, p.rate);
  const capacity = scheduleCapacity(s, p.today);
  const minUsd = minBudgetUsd(p.rate);
  const mailbox = p.mailboxes.find((m) => m.id === s.mailboxId) ?? null;
  const idx = level === "campaign" ? 0 : level === "audience" ? 1 : 2;

  // D-274 (owner): no checklist under the form. Launch takes the member to what's missing, with one message, instead.
  const tryLaunch = () => {
    const g = gaps[0];
    if (g) { go(g.level, 0); toast(g.key === "budget" ? fmt(b.missing.budget, { usd: usd(minUsd) }) : b.missing[g.key], "error"); return; }
    if (!confirmed && s.objective !== "qualified_leads") { go("message"); toast(b.missing.confirm, "error"); return; }
    launch();
  };
  const launch = () => call(() => launchCampaign(s, draftId, confirmed), (r) => {
    const res = r as unknown as { id: string; warnings: string[] };
    if (res.warnings.length) setWarnings(res.warnings);
    router.push(`/outreach/${res.id}`);
  }, "launch");
  const save = () => call(() => updateCampaign(p.campaignId!, s), (r) => {
    const w = (r as unknown as { warnings: string[] }).warnings;
    if (w.length) setWarnings(w);
    toast(b.savedChanges);
    router.push(`/outreach/${p.campaignId}`);
  }, "save");

  return (
    <div className="cb">
      <header className="cb-top">
        <div>
          <h1>{editing ? b.editTitle : b.title}</h1>
          <span className="cb-step">{fmt(b.stepOf, { n: String(idx + 1) })} · {t.ag.levels[level]}</span>
        </div>
        <div className="cb-top-actions">
          {!editing && <button type="button" className="sdr-btn" disabled={pending} onClick={() => persist(s, false)}>{b.saveDraft}</button>}
          <Link href={editing ? `/outreach/${p.campaignId}` : "/outreach"} className="sdr-icon-btn" aria-label={b.cancel}><X /></Link>
        </div>
      </header>

      <div className="cb-body">
        <nav className="cb-tree" aria-label={b.title}>
          <button type="button" className={`cb-node${level === "campaign" ? " on" : ""}`} onClick={() => go("campaign")}>
            <Folder /><span><small>{t.ag.levels.campaign}</small>{s.name.trim() || b.campaign.name}</span>
            {gaps.some((g) => g.level === "campaign") && <i className="cb-dot" aria-hidden />}
          </button>
          <div className="cb-children">
            {s.adSets.map((a, i) => (
              <button key={a.key} type="button" className={`cb-node child${level === "audience" && sel === i ? " on" : ""}`} onClick={() => go("audience", i)}>
                <Users /><span><small>{t.ag.levels.audience}</small>{a.name}</span>
              </button>
            ))}
            <button type="button" className="cb-add" onClick={() => {
              const next = { ...s, level: "audience" as const, adSets: [...s.adSets, emptyAdSet(s.adSets.length + 1, fmt(b.audience.defaultName, { n: String(s.adSets.length + 1) }))] };
              setS(next); setSel(next.adSets.length - 1);
            }} disabled={s.adSets.length >= 8}><Plus />{b.audience.add}</button>
            {/* A qualified-leads campaign sends nothing (D-274): no message level. */}
            {s.objective !== "qualified_leads" && <button type="button" className={`cb-node child${level === "message" ? " on" : ""}`} onClick={() => go("message")}>
              <Mail /><span><small>{t.ag.levels.message}</small>{s.messageName.trim() || mailbox?.email || b.message.mailbox}</span>
              {gaps.some((g) => g.level === "message") && <i className="cb-dot" aria-hidden />}
            </button>}
          </div>
        </nav>

        <section className="cb-main">
          <h2 className="cb-h">{b.heads[level]}</h2>

          {level === "campaign" && (
            <div className="cb-form">
              <div className="ws-field">
                <label className="ws-label" htmlFor="cb-name">{b.campaign.name}</label>
                <input id="cb-name" className="form-input" dir="auto" maxLength={160} placeholder={b.campaign.namePh} value={s.name} onChange={(e) => patch({ name: e.target.value })} />
              </div>
              {/* D-274: type → objective → channel → whom to contact, each with what it means. */}
              <div className="ws-field">
                <span className="ws-label">{K.type}</span>
                <div className="cb-choices two">
                  {(["outreach", "find"] as const).map((k) => {
                    const on = k === "find" ? s.objective === "qualified_leads" : s.objective !== "qualified_leads";
                    return (
                      <button key={k} type="button" className={`cb-objective${on ? " on" : ""}`} aria-pressed={on} onClick={() => patch({ objective: k === "find" ? "qualified_leads" : s.objective === "qualified_leads" ? "meetings" : s.objective })}>
                        {k === "find" ? <Search /> : <Send />}<div><strong>{K.types[k]}</strong><p>{K.typesDesc[k]}</p></div>{on && <Check className="cb-tick" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="ws-field">
                <span className="ws-label">{b.campaign.objective}</span>
                <div className="cb-choices">
                  {(s.objective === "qualified_leads" ? (["qualified_leads"] as const) : (["meetings", "purchases", "form_leads"] as const)).map((k) => {
                    const Icon = { meetings: CalendarDays, purchases: ShoppingCart, form_leads: ClipboardList, qualified_leads: UserCheck }[k];
                    return (
                      <button key={k} type="button" className={`cb-objective${s.objective === k ? " on" : ""}`} aria-pressed={s.objective === k} onClick={() => patch({ objective: k, conversionEvent: null })}>
                        <Icon /><div><strong>{K.objectives[k]}</strong><p>{K.objectivesDesc[k]}</p></div>{s.objective === k && <Check className="cb-tick" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              {(s.objective === "purchases" || s.objective === "form_leads") && (
                <div className="ws-field">
                  <label className="ws-label" htmlFor="cb-site">{s.objective === "purchases" ? K.sitePurchase : K.siteForm}</label>
                  <input id="cb-site" className="form-input" dir="ltr" type="url" inputMode="url" maxLength={500} placeholder="https://" value={s.websiteUrl} onChange={(e) => patch({ websiteUrl: e.target.value })} />
                </div>
              )}
              {(s.objective === "purchases" || s.objective === "form_leads") && (() => {
                const px = p.pixels.find((x) => x.id === s.pixelId) ?? null;
                const events = s.objective === "purchases" ? PURCHASE_EVENTS : LEAD_EVENTS;
                return (
                  <div className="cb-row">
                    <label className="ws-field"><span className="ws-label">{K.pixelPick}</span>
                      <select className="form-input" value={s.pixelId ?? ""} onChange={(e) => patch({ pixelId: e.target.value || null })}>
                        <option value="">{K.pixelPick}</option>
                        {p.pixels.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.publicId}</option>)}
                      </select>
                      {px ? <span className={`ws-hint${px.seen ? "" : " cb-warn"}`}>{px.seen ? K.pixelOn : K.pixelOff} <Link href={`/events/${px.id}`}>{K.pixelOpen}</Link></span> : <span className="ws-hint"><Link href="/events">{K.pixelOpen}</Link></span>}
                    </label>
                    <label className="ws-field"><span className="ws-label">{K.conversion}</span>
                      <select className="form-input" dir="ltr" value={s.conversionEvent ?? events[0]} onChange={(e) => patch({ conversionEvent: e.target.value })}>
                        {events.map((ev) => <option key={ev} value={ev}>{ev} · {t.ag.rx.ev.kinds[ev as keyof typeof t.ag.rx.ev.kinds]}</option>)}
                      </select>
                      <span className="ws-hint">{K.conversionHint}</span>
                    </label>
                    <label className="ws-field"><span className="ws-label">{K.attribution}</span>
                      <select className="form-input" value={String(s.attributionDays)} onChange={(e) => patch({ attributionDays: Number(e.target.value) as 1 | 7 | 28 })}>
                        {(["1", "7", "28"] as const).map((d) => <option key={d} value={d}>{K.attributionDays[d]}</option>)}
                      </select>
                    </label>
                  </div>
                );
              })()}
              {s.objective === "qualified_leads" && (
                <div className="cb-what"><strong>{b.message.what}</strong><ol>{K.whatFind.map((x) => <li key={x}>{x}</li>)}</ol></div>
              )}
              {s.objective !== "qualified_leads" && <div className="ws-field">
                <span className="ws-label">{K.channel}</span>
                <div className="cb-choices">
                  {/* Only channels that work are shown (owner, 2026-11-03: never "coming soon"). */}
                  {(["email"] as const).map((k) => (
                    <button key={k} type="button" className="cb-objective sm on" aria-pressed onClick={() => patch({ channel: "email" })}>
                      <div><strong>{K.channels[k]}</strong><p>{K.channelDesc[k]}</p></div><Check className="cb-tick" />
                    </button>
                  ))}
                </div>
              </div>}
              <div className="ws-field">
                <span className="ws-label">{s.objective === "qualified_leads" ? K.find : K.contact}</span>
                <div className="sdr-seg" role="tablist">
                  {(["people", "companies", "both"] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={s.contactTarget === k} className={s.contactTarget === k ? "active" : ""} onClick={() => patch({ contactTarget: k })}>{K.contacts[k]}</button>)}
                </div>
                <p className="ws-hint">{K.contactDesc[s.contactTarget]}</p>
              </div>
              <div className="ws-field">
                <span className="ws-label">{b.campaign.offer}</span>
                {p.offers.length > 0 && (
                  <select className="form-input" value={s.offerId ?? ""} aria-label={b.campaign.offerPick} onChange={(e) => patch({ offerId: e.target.value || null })}>
                    <option value="">{b.campaign.offerPick}</option>
                    {p.offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                )}
                {!s.offerId && <textarea className="form-input" rows={2} dir="auto" maxLength={1500} placeholder={b.campaign.offerPh} aria-label={b.campaign.offerOwn} value={s.offer} onChange={(e) => patch({ offer: e.target.value })} />}
              </div>
              <div className="cb-note">
                <strong>{b.campaign.knowledge}</strong>
                <span>{fmt(b.campaign.knowledgeLine, { pct: `${p.knowledgePct}%` })}{p.knowledgePct < 70 ? ` ${b.campaign.knowledgeThin}` : ""}</span>
                <Link href="/ai/knowledge" className="sdr-btn ghost sm">{b.campaign.knowledgeOpen}</Link>
              </div>
              {/* The target and the daily messages side by side (owner, 2026-11-03). */}
              <div className="cb-pair-fields">
                <div className="ws-field">
                  <label className="ws-label" htmlFor="cb-target">{K.targets[s.objective]}</label>
                  <input id="cb-target" className="form-input num" type="number" min={1} max={1000} value={s.targetMeetings} onChange={(e) => patch({ targetMeetings: Math.max(1, Math.min(1000, Number(e.target.value) || 1)) })} />
                </div>
                {s.objective !== "qualified_leads" && (
                  <div className="ws-field">
                    <label className="ws-label" htmlFor="cb-daily">{b.campaign.daily}</label>
                    <input id="cb-daily" className="form-input num" type="number" min={1} max={500} value={s.dailyLimit} onChange={(e) => patch({ dailyLimit: Math.max(1, Math.min(500, Number(e.target.value) || 1)) })} />
                  </div>
                )}
              </div>
              <p className="ws-hint">{b.campaign.resultHint}</p>
              <fieldset className="te-group">
                <legend>{b.campaign.budget}</legend>
                <div className="sdr-seg" role="tablist">
                  {(["total", "daily"] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={s.budgetType === k} className={s.budgetType === k ? "active" : ""} onClick={() => patch({ budgetType: k })}>{b.campaign.budgetTypes[k]}</button>)}
                </div>
                <label className="cb-money">
                  <span aria-hidden>$</span>
                  <input className="form-input num" type="number" min={0} step="1" inputMode="decimal" aria-label={b.campaign.amount} value={s.budgetUsd} onChange={(e) => patch({ budgetUsd: Math.max(0, Number(e.target.value) || 0) })} />
                  <span className="cb-money-unit">USD</span>
                </label>
                <p className="ws-hint">
                  {fmt(s.budgetType === "daily" ? b.campaign.peopleDaily : b.campaign.people, { n: n(people), rate: usd(p.rate, 3) })} {fmt(b.campaign.minBudget, { usd: usd(minUsd) })}
                </p>
                {p.balanceUsd != null && <p className="ws-hint">{fmt(b.campaign.balance, { usd: usd(p.balanceUsd) })} · <Link href="/?settings=billing">{b.campaign.topUp}</Link></p>}
              </fieldset>
              <fieldset className="te-group">
                <legend>{b.campaign.schedule}</legend>
                <div className="cb-row">
                  <label className="ws-field"><span className="ws-label">{b.campaign.start}</span>
                    <span className="cb-pair"><input type="date" className="form-input" min={p.today} value={s.startDate} onChange={(e) => patch({ startDate: e.target.value })} /><input type="time" className="form-input" value={s.startTime} onChange={(e) => patch({ startTime: e.target.value })} /></span>
                  </label>
                  <label className="ws-field"><span className="ws-label">{b.campaign.end}</span>
                    <span className="cb-pair"><input type="date" className="form-input" min={s.startDate || p.today} value={s.endDate} onChange={(e) => patch({ endDate: e.target.value })} />{s.endDate && <input type="time" className="form-input" value={s.endTime} onChange={(e) => patch({ endTime: e.target.value })} />}</span>
                    {!s.endDate && <span className="ws-hint">{b.campaign.noEnd}</span>}
                  </label>
                </div>
                <label className="ws-field"><span className="ws-label">{b.campaign.timezone}</span>
                  <select className="form-input" dir="ltr" value={s.timezone} onChange={(e) => patch({ timezone: e.target.value })}>{p.zones.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}</select>
                </label>
                <button type="button" className="cb-more" aria-expanded={advanced} onClick={() => setAdvanced((v) => !v)}><ChevronDown className={advanced ? "up" : ""} />{b.campaign.advanced}</button>
                {advanced && (
                  <div className="cb-advanced">
                    <span className="ws-label">{b.campaign.days}</span>
                    <div className="sdr-days">
                      {DAYS.map((d) => {
                        const on = s.runDays.includes(d);
                        return <label key={d} className={`sdr-day${on ? " on" : ""}`}><input type="checkbox" checked={on} onChange={() => patch({ runDays: on ? s.runDays.filter((x) => x !== d) : [...s.runDays, d] })} />{t.ag.days[d]}</label>;
                      })}
                    </div>
                    <span className="ws-label">{b.campaign.hours}</span>
                    <span className="cb-pair"><input type="time" className="form-input" value={s.contactFrom} onChange={(e) => patch({ contactFrom: e.target.value })} /><span>{b.campaign.to}</span><input type="time" className="form-input" value={s.contactTo} onChange={(e) => patch({ contactTo: e.target.value })} /></span>
                    <label className="ws-field"><span className="ws-label">{t.ag.rx.opt.costCap}</span><span className="cb-money"><span aria-hidden>$</span><input className="form-input num" type="number" min={0} step="1" placeholder={t.ag.rx.opt.noCap} value={s.costCapUsd ?? ""} onChange={(e) => patch({ costCapUsd: e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0) })} /></span></label>
                    <label className="cb-check"><input type="checkbox" checked={s.trackOpens} onChange={(e) => patch({ trackOpens: e.target.checked })} />{t.ag.rx.opt.trackOpens}</label>
                    <p className="ws-hint">{b.campaign.advancedHint}</p>
                  </div>
                )}
              </fieldset>
            </div>
          )}

          {level === "audience" && s.adSets[sel] && (() => {
            const a = s.adSets[sel];
            const lockedSet = editing && p.locked.includes(a.name);
            const est = estimates[a.key];
            return (
              <div className="cb-form">
                <p className="ws-hint">{b.audience.hint}</p>
                <div className="cb-row">
                  <label className="ws-field" style={{ flex: 1 }}><span className="ws-label">{b.audience.name}</span>
                    <input className="form-input" dir="auto" maxLength={120} value={a.name} disabled={lockedSet} onChange={(e) => setAd(sel, { name: e.target.value })} />
                  </label>
                  <div className="cb-audience-actions">
                    <button type="button" className="sdr-btn ghost sm" onClick={() => { const copy = { ...a, key: `a${Date.now().toString(36)}`, name: `${a.name} (2)`, angleA: "", angleB: "" }; setS({ ...s, adSets: [...s.adSets, copy] }); setSel(s.adSets.length); }} disabled={s.adSets.length >= 8}><Copy />{b.audience.duplicate}</button>
                    {s.adSets.length > 1 && !lockedSet && <button type="button" className="sdr-btn ghost sm danger" onClick={() => { setS({ ...s, adSets: s.adSets.filter((_, j) => j !== sel) }); setSel(0); }}><Trash2 />{b.audience.remove}</button>}
                  </div>
                </div>
                {lockedSet ? <p className="cb-note">{b.errors.locked}</p> : (
                  <>
                    <div className="sdr-seg" role="tablist" aria-label={b.audience.source}>
                      {(["new", "audience"] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={a.source === k} className={a.source === k ? "active" : ""} onClick={() => setAd(sel, { source: k })}>{b.audience.sources[k]}</button>)}
                    </div>
                    {a.source === "audience" ? (
                      <div className="ws-field">
                        {p.audiences.length ? (
                          <div className="cb-pick-list" role="listbox" aria-label={b.audience.pick}>
                            {p.audiences.map((x) => (
                              <button key={x.id} type="button" role="option" aria-selected={a.audienceId === x.id} className={`cb-pick${a.audienceId === x.id ? " on" : ""}`} onClick={() => { setAd(sel, { audienceId: x.id }); void check(s.adSets.map((y, j) => (j === sel ? { ...y, audienceId: x.id } : y))); }}>
                                <strong dir="auto">{x.name}</strong><span>{b.audience.kinds[x.kind]}{x.kind === "custom" ? ` · ${fmt(b.audience.members, { n: n(x.members) })}` : ""}</span>
                              </button>
                            ))}
                          </div>
                        ) : <p className="ws-hint">{b.audience.none}</p>}
                        <Link href="/audiences" className="sdr-btn ghost sm">{b.audience.manage}</Link>
                      </div>
                    ) : (
                      <>
                        <TargetingEditor value={a.targeting as Targeting} onChange={(tg) => setAd(sel, { targeting: tg as AdSet["targeting"] })} />
                        <button type="button" className="sdr-btn ghost sm" onClick={() => call(() => saveAudience({ kind: "saved", name: a.name, targeting: a.targeting }), () => toast(b.audience.savedAs))}>{b.audience.saveAs}</button>
                      </>
                    )}
                  </>
                )}
                <div className="cb-estimate" aria-live="polite">
                  <strong>{b.audience.size}</strong>
                  <button type="button" className="sdr-btn ghost sm" onClick={() => void check(s.adSets)}>{b.audience.recheck}</button>
                  {est ? (
                    <ul>
                      <li>{fmt(b.audience.known, { n: n(est.known) })}</li>
                      <li>{fmt(b.audience.email, { n: n(est.email) })}</li>
                      {a.source === "new" && <li>{b.audience.growing}</li>}
                    </ul>
                  ) : <p className="ws-hint">{b.audience.checking}</p>}
                  <p className="ws-hint">{b.audience.sizeNote}</p>
                </div>
              </div>
            );
          })()}

          {level === "message" && (
            <div className="cb-form">
              <div className="ws-field">
                <label className="ws-label" htmlFor="cb-mname">{K.messageName}</label>
                <input id="cb-mname" className="form-input" dir="auto" maxLength={160} placeholder={K.messageNamePh} value={s.messageName} onChange={(e) => patch({ messageName: e.target.value })} />
              </div>
              <div className="ws-field">
                <span className="ws-label">{b.message.mailbox}</span>
                {p.mailboxes.length ? (
                  <select className="form-input" dir="ltr" value={s.mailboxId ?? ""} onChange={(e) => patch({ mailboxId: e.target.value || null })}>
                    <option value="">{b.message.mailbox}</option>
                    {p.mailboxes.map((m) => <option key={m.id} value={m.id}>{m.email}</option>)}
                  </select>
                ) : (
                  <div className="cb-note"><span>{b.message.mailboxNone}</span><Link href="/integrations" className="sdr-btn primary sm">{b.message.connect}</Link></div>
                )}
                {mailbox && <p className="ws-hint">{fmt(b.message.mailboxDaily, { n: n(mailbox.dailyLimit) })}</p>}
              </div>
              <div className="cb-row">
                <label className="ws-field" style={{ flex: 1 }}><span className="ws-label">{b.message.senderName}</span><input className="form-input" dir="auto" maxLength={120} value={s.senderName} onChange={(e) => patch({ senderName: e.target.value })} /></label>
                <label className="ws-field" style={{ flex: 1 }}><span className="ws-label">{b.message.tone}</span>
                  <select className="form-input" value={s.tone} onChange={(e) => patch({ tone: e.target.value as BuilderState["tone"] })}>{(["direct", "friendly", "conservative"] as const).map((k) => <option key={k} value={k}>{t.ag.tones[k]}</option>)}</select>
                </label>
                <label className="ws-field" style={{ flex: 1 }}><span className="ws-label">{b.message.language}</span>
                  <select className="form-input" value={s.language} onChange={(e) => patch({ language: e.target.value })}>
                    <option value="mul">{b.message.languageAuto}</option>
                    {(Object.keys(messageLanguages) as (keyof typeof messageLanguages)[]).map((k) => <option key={k} value={k}>{languageLabels[k]}</option>)}
                  </select>
                </label>
              </div>
              <label className="ws-field"><span className="ws-label">{b.message.notes}</span><textarea className="form-input" rows={3} dir="auto" maxLength={2000} placeholder={b.message.notesPh} value={s.instructions} onChange={(e) => patch({ instructions: e.target.value })} /></label>
              {(s.objective === "purchases" || s.objective === "form_leads") && (
                <div className="cb-note">
                  <strong>{K.siteNote}</strong>
                  <span>{K.siteNoteLine} <bdi dir="ltr">{s.websiteUrl || "–"}</bdi>{s.pixelId ? ` · ${p.pixels.find((x) => x.id === s.pixelId)?.name ?? ""} · ${s.conversionEvent ?? (s.objective === "purchases" ? "Purchase" : "Lead")}` : ""}</span>
                </div>
              )}
              {s.objective === "meetings" && <div className="cb-note">
                <strong>{b.message.meetings}</strong>
                <span>{b.message.bookingOn} {p.booking.calendar ? b.message.calendarOn : b.message.calendarOff}</span>
                <span className="cb-note-links">
                  <Link href="/meetings?tab=page" className="sdr-btn ghost sm">{b.message.bookingOpen}</Link>
                  {!p.booking.calendar && <Link href="/integrations?card=calendar" className="sdr-btn ghost sm">{b.message.calendarConnect}</Link>}
                </span>
              </div>}

              {s.adSets.map((a, i) => (
                <div key={a.key} className="cb-approach">
                  <div className="cb-approach-head">
                    <strong><Users />{a.name}</strong>
                    <button type="button" className="sdr-btn ghost sm" disabled={pending} onClick={() => call(() => writeApproach(s, a.key), (r) => { const x = r as unknown as { angleA: string; angleB: string }; setAd(i, x); }, `approach:${a.key}`)}>
                      {busy === `approach:${a.key}` ? <Loader2 className="spin" /> : <Sparkles />}{a.angleA ? b.message.regenerate : b.message.approach}
                    </button>
                  </div>
                  <p className="ws-hint">{b.message.approachHint}</p>
                  {a.angleA && (
                    <div className="cb-angles">
                      <label><span className="ws-label">{b.message.angleA}</span><textarea className="form-input" rows={2} dir="auto" maxLength={1000} value={a.angleA} onChange={(e) => setAd(i, { angleA: e.target.value })} /></label>
                      <label><span className="ws-label">{b.message.angleB}</span><textarea className="form-input" rows={2} dir="auto" maxLength={1000} value={a.angleB} onChange={(e) => setAd(i, { angleB: e.target.value })} /></label>
                    </div>
                  )}
                  <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => call(() => previewEmail(s, a.key), (r) => {
                    const x = r as unknown as { subject: string; body: string; who: string; angleA: string; angleB: string };
                    setAd(i, { angleA: x.angleA, angleB: x.angleB });
                    setSamples((cur) => ({ ...cur, [a.key]: { subject: x.subject, body: x.body, who: x.who } }));
                  }, `preview:${a.key}`)}>
                    {busy === `preview:${a.key}` ? <><Loader2 className="spin" />{b.message.previewing}</> : <><Mail />{b.message.previewMake}</>}
                  </button>
                  {samples[a.key] && (
                    <div className="cb-mail">
                      <div className="cb-mail-meta"><span dir="ltr">{mailbox?.email ?? ""}</span><span>{fmt(b.message.previewFor, { who: samples[a.key].who })}</span></div>
                      <div className="cb-mail-subject" dir="auto">{samples[a.key].subject}</div>
                      <div className="cb-mail-body" dir="auto">{samples[a.key].body}</div>
                      <p className="ws-hint">{b.message.previewExample}</p>
                    </div>
                  )}
                </div>
              ))}

              <div className="cb-what">
                <strong>{b.message.what}</strong>
                <ol>{(s.objective === "meetings" ? b.message.whatList : K.whatSite.map((x) => fmt(x, { event: s.conversionEvent ?? (s.objective === "purchases" ? "Purchase" : "Lead"), days: String(s.attributionDays) }))).map((x) => <li key={x}>{x}</li>)}</ol>
              </div>
              {!editing && (
                <label className="cb-confirm">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={!mailbox} />
                  <span>{fmt(b.message.confirm, { mailbox: mailbox?.email ?? b.message.mailbox })}</span>
                </label>
              )}
            </div>
          )}

          {/* Audience checks before launch (audit 2026-11-03): warnings only. */}
          {(() => {
            const issues = s.adSets.filter((a) => a.source === "new").flatMap((a) => audienceIssues(a.targeting, s.contactTarget).map((i) => `${a.name}: ${b.audienceIssues[i]}`));
            return issues.length > 0 && <ul className="cb-warnings">{issues.map((w) => <li key={w}>{w}</li>)}</ul>;
          })()}
          {warnings.length > 0 && <ul className="cb-warnings">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        </section>

        <aside className="cb-side">
          <div className="cb-summary">
            <strong dir="auto">{s.name.trim() || b.campaign.name}</strong>
            <dl>
              <dt>{b.campaign.objective}</dt><dd>{K.objectives[s.objective]} · {s.targetMeetings}</dd>
              <dt>{b.campaign.budget}</dt><dd>{usd(s.budgetUsd)} {b.campaign.budgetTypes[s.budgetType].toLowerCase()}</dd>
              <dt>{t.ag.levels.audience}</dt><dd>{s.adSets.length}</dd>
              {capacity != null && <><dt>{b.campaign.daily}</dt><dd>{n(s.dailyLimit)}</dd></>}
              {s.objective !== "qualified_leads" && <><dt>{b.message.mailbox}</dt><dd dir="ltr">{mailbox?.email ?? "–"}</dd></>}
            </dl>
          </div>
        </aside>
      </div>

      <footer className="cb-foot">
        <button type="button" className="sdr-btn" disabled={idx === 0 || pending} onClick={() => go(idx === 2 ? "audience" : "campaign", 0)}>{b.back}</button>
        {idx < (s.objective === "qualified_leads" ? 1 : 2) ? (
          <button type="button" className="sdr-btn primary" disabled={pending} onClick={() => go(idx === 0 ? "audience" : "message", 0)}>{b.next}</button>
        ) : editing ? (
          <button type="button" className="sdr-btn primary" disabled={pending || !s.name.trim()} onClick={save}>{busy === "save" ? <Loader2 className="spin" /> : null}{b.saveChanges}</button>
        ) : (
          <button type="button" className="sdr-btn primary" disabled={pending} onClick={tryLaunch}>{busy === "launch" ? <><Loader2 className="spin" />{b.launching}</> : b.launch}</button>
        )}
      </footer>
    </div>
  );
}
