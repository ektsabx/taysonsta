"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, Mail, Plus, Sparkles, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber, countryLabel } from "@/lib/format";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { useToast } from "@/components/Toast";
import { CHANNELS } from "@/lib/campaigns/channels";
import { emptyGroup, expectedVolume, type WizardGroup, type WizardState } from "@/lib/campaigns/wizard";
import type { Targeting } from "@/lib/campaigns/targeting";
import type { Estimate, Lookalike, SeedKind } from "@/lib/campaigns/audience";
import { estimateAudience, launchCampaign, lookalikeOf, planCampaign, saveDraft } from "@/app/(app)/outreach/new/actions";
import { saveAudience } from "@/app/(app)/prospects/audiences/actions";
import { TargetingEditor, targetingSummary } from "./TargetingEditor";

// Create campaign (owner, 2026-10-31, D-272), after Meta / TikTok Ads
// Manager: basics → budget and schedule → audience groups and targeting →
// channels → Yolias's plan (approve, edit, regenerate) → review and launch.
// A draft is saved on every step change and with "Save draft".

const OBJECTIVES = ["meetings", "leads", "opportunities", "new_customers", "reactivate", "promote", "custom"] as const;
const SOURCES = ["find_new", "saved", "lookalike", "custom", "imported", "previous_campaign", "customers"] as const;
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const SEEDS: SeedKind[] = ["customers", "qualified", "meetings", "interested", "audience"];

export interface WizardProps {
  draftId: string | null;
  initial: WizardState;
  rate: number;
  balance: number;
  members: { id: string; name: string }[];
  zones: { value: string; label: string }[];
  audiences: { id: string; name: string; kind: "saved" | "custom" | "lookalike"; targeting: Targeting; members: number }[];
  campaigns: { id: string; name: string }[];
  mailbox: string | null;
  today: string;
}

export function CampaignWizard(p: WizardProps) {
  const { t, locale } = useI18n();
  const w = t.camp.wiz;
  const lang = locale === "ar" ? "ar" : "en";
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [s, setS] = useState<WizardState>(p.initial);
  const [draftId, setDraftId] = useState(p.draftId);
  const [active, setActive] = useState(0);
  const [estimates, setEstimates] = useState<Record<string, Estimate>>({});
  const [looks, setLooks] = useState<Record<string, Lookalike>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const n = (v: number) => formatNumber(v, locale);
  const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 3 }).format(v);
  const patch = (x: Partial<WizardState>) => setS((cur) => ({ ...cur, ...x, ...(x.groups || "objective" in x ? { planned: x.planned ?? false } : {}) }));
  const setGroup = (i: number, g: Partial<WizardGroup>) => setS((cur) => ({ ...cur, planned: "angleA" in g || "angleB" in g || "steps" in g ? cur.planned : false, groups: cur.groups.map((x, j) => (j === i ? { ...x, ...g } : x)) }));
  const call = <R extends { ok: boolean }>(fn: () => Promise<R>, then: (r: R) => void) => start(async () => {
    const r = await callAction(fn);
    if (isNetworkFailure(r)) { toast(t.feedback.errors.network, "error"); return; }
    if (!r.ok) { toast((r as unknown as { error: string }).error, "error"); return; }
    then(r);
  });
  const persist = (next: WizardState, silent = true) => call(() => saveDraft(next, draftId), (r) => {
    const id = (r as unknown as { id: string }).id;
    if (id !== draftId) { setDraftId(id); window.history.replaceState(null, "", `/outreach/new?draft=${id}`); }
    if (!silent) toast(w.saved);
  });
  const go = (step: number) => { const next = { ...s, step }; setS(next); if (s.name.trim() || draftId) persist(next); };
  const prospects = p.rate > 0 ? Math.floor(s.budgetUsd / p.rate) : 0;
  const volume = expectedVolume(s, p.today);

  const canNext = [
    Boolean(s.name.trim()) && (s.objective !== "custom" || Boolean(s.customObjective.trim())) && (s.objective !== "promote" || /^https?:\/\/\S+\.\S+/.test(s.ctaUrl)),
    s.budgetUsd > 0 && (!s.endDate || s.endDate >= (s.startDate || p.today)) && s.runDays.length > 0 && s.dailyLimit > 0,
    s.groups.every((g) => g.name.trim() && (g.source === "find_new" || g.source === "saved" ? hasAny(g.targeting) : g.source === "lookalike" ? g.seeds.length > 0 : g.source === "custom" ? Boolean(g.audienceId) : g.source === "previous_campaign" ? Boolean(g.fromCampaignId) : true)),
    true,
    s.planned && s.groups.every((g) => g.angleA.trim()),
    true,
  ][s.step];

  const plan = () => call(() => planCampaign(s), (r) => {
    const groups = (r as unknown as { groups: { key: string; angleA: string; angleB: string; why: string; risks: string }[] }).groups;
    setS((cur) => ({ ...cur, planned: false, groups: cur.groups.map((g) => { const x = groups.find((y) => y.key === g.key); return x ? { ...g, angleA: x.angleA, angleB: x.angleB, why: x.why, risks: x.risks } : g; }) }));
  });
  const checkAudience = () => call(() => estimateAudience(s.groups.map((g) => g.targeting)), (r) => {
    const list = (r as unknown as { estimates: Estimate[] }).estimates;
    setEstimates(Object.fromEntries(s.groups.map((g, i) => [g.key, list[i]])));
  });
  const readSeed = (i: number, kind: SeedKind, audienceId: string | null) => call(() => lookalikeOf(kind, audienceId), (r) => {
    const l = (r as unknown as { lookalike: Lookalike }).lookalike;
    setLooks((x) => ({ ...x, [s.groups[i].key]: l }));
    setGroup(i, { seed: kind, seeds: l.seeds, targeting: { ...l.targeting, description: s.groups[i].targeting.description } as never });
  });
  const launch = () => call(() => launchCampaign(s, draftId), (r) => {
    const x = r as unknown as { id: string; warnings: string[] };
    if (x.warnings.length) { setWarnings(x.warnings); x.warnings.forEach((m) => toast(m, "error")); }
    router.push(`/outreach/${x.id}`);
  });

  const g = s.groups[Math.min(active, s.groups.length - 1)];
  const gi = s.groups.indexOf(g);
  const est = estimates[g.key];
  const look = looks[g.key];

  return (
    <div className="wz">
      <ol className="wz-steps" aria-label={w.title}>
        {w.steps.map((label, i) => (
          <li key={label}><button type="button" className={i === s.step ? "on" : i < s.step ? "done" : ""} aria-current={i === s.step ? "step" : undefined} disabled={i > s.step} onClick={() => go(i)}>
            <span>{i < s.step ? <Check /> : i + 1}</span>{label}
          </button></li>
        ))}
      </ol>

      <section className="wz-card">
        {s.step === 0 && (
          <>
            <h3>{w.steps[0]}</h3>
            <div className="ws-field"><label className="ws-label" htmlFor="wz-name">{w.basics.name}</label><input id="wz-name" className="form-input" dir="auto" maxLength={160} placeholder={w.basics.namePh} value={s.name} onChange={(e) => patch({ name: e.target.value })} /></div>
            <div className="ws-field"><span className="ws-label">{w.basics.objective}</span><p className="ws-hint">{w.basics.objectiveHint}</p>
              <div className="wz-objectives" role="radiogroup">{OBJECTIVES.map((o) => <button key={o} type="button" role="radio" aria-checked={s.objective === o} className={s.objective === o ? "on" : ""} onClick={() => patch({ objective: o })}>{t.camp.manager.objectives[o]}</button>)}</div></div>
            {s.objective === "custom" && <div className="ws-field"><label className="ws-label" htmlFor="wz-co">{w.basics.custom}</label><input id="wz-co" className="form-input" dir="auto" maxLength={300} value={s.customObjective} onChange={(e) => patch({ customObjective: e.target.value })} /></div>}
            {s.objective === "promote" && <div className="ws-field"><label className="ws-label" htmlFor="wz-url">{w.basics.link}</label><input id="wz-url" className="form-input" dir="ltr" placeholder="https://" maxLength={500} value={s.ctaUrl} onChange={(e) => patch({ ctaUrl: e.target.value })} /></div>}
            <div className="ws-field"><label className="ws-label" htmlFor="wz-desc">{w.basics.description}</label><textarea id="wz-desc" className="form-input" rows={3} dir="auto" maxLength={3000} placeholder={w.basics.descriptionPh} value={s.description} onChange={(e) => patch({ description: e.target.value })} /></div>
            {p.members.length > 1 && <div className="ws-field"><label className="ws-label" htmlFor="wz-owner">{w.basics.owner}</label><select id="wz-owner" className="form-input" value={s.ownerId ?? ""} onChange={(e) => patch({ ownerId: e.target.value || null })}>{p.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>}
          </>
        )}

        {s.step === 1 && (
          <>
            <h3>{w.steps[1]}</h3>
            <div className="ws-grid-2">
              <div className="ws-field"><span className="ws-label">{w.budget.type}</span>
                <div className="wz-seg">{(["total", "daily", "monthly"] as const).map((b) => <button key={b} type="button" className={s.budgetType === b ? "on" : ""} onClick={() => patch({ budgetType: b })}>{w.budget.types[b]}</button>)}</div></div>
              <div className="ws-field"><label className="ws-label" htmlFor="wz-amount">{w.budget.amount}</label><input id="wz-amount" className="form-input" type="number" min={1} step={1} value={s.budgetUsd} onChange={(e) => patch({ budgetUsd: Math.max(0, Number(e.target.value) || 0) })} />
                <p className="ws-hint">{s.budgetType === "total" ? fmt(w.budget.rate, { n: n(prospects), rate: usd(p.rate) }) : fmt(w.budget.period, { period: w.budget.periods[s.budgetType], n: n(prospects) })}</p></div>
            </div>
            <p className={p.balance > 0 ? "ws-hint" : "form-error"}>{p.balance > 0 ? fmt(w.budget.balance, { n: n(p.balance) }) : w.budget.noBalance} {w.budget.separate}</p>
            <div className="ws-grid-2">
              <div className="ws-field"><span className="ws-label">{w.budget.start}</span><div className="wz-pair"><input className="form-input" type="date" min={p.today} value={s.startDate} onChange={(e) => patch({ startDate: e.target.value })} aria-label={w.budget.start} /><input className="form-input" type="time" value={s.startTime} onChange={(e) => patch({ startTime: e.target.value })} aria-label={w.budget.start} /></div></div>
              <div className="ws-field"><span className="ws-label">{w.budget.end}</span><div className="wz-pair"><input className="form-input" type="date" min={s.startDate || p.today} value={s.endDate} onChange={(e) => patch({ endDate: e.target.value })} aria-label={w.budget.end} /><input className="form-input" type="time" value={s.endTime} disabled={!s.endDate} onChange={(e) => patch({ endTime: e.target.value })} aria-label={w.budget.end} /></div>
                <label className="wiz-check"><input type="checkbox" checked={!s.endDate} onChange={(e) => patch({ endDate: e.target.checked ? "" : p.today })} />{w.budget.noEnd}</label></div>
            </div>
            <div className="ws-grid-2">
              <div className="ws-field"><label className="ws-label" htmlFor="wz-tz">{w.budget.timezone}</label><select id="wz-tz" className="form-input" value={s.timezone} onChange={(e) => patch({ timezone: e.target.value })}>{p.zones.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}</select></div>
              <div className="ws-field"><label className="ws-label" htmlFor="wz-daily">{w.budget.daily}</label><input id="wz-daily" className="form-input" type="number" min={1} max={500} value={s.dailyLimit} onChange={(e) => patch({ dailyLimit: Math.max(1, Number(e.target.value) || 1) })} /></div>
            </div>
            <div className="ws-field"><span className="ws-label">{w.budget.days}</span><div className="wz-days">{DAYS.map((d) => <button key={d} type="button" aria-pressed={s.runDays.includes(d)} className={s.runDays.includes(d) ? "on" : ""} onClick={() => patch({ runDays: s.runDays.includes(d) ? s.runDays.filter((x) => x !== d) : [...s.runDays, d] })}>{w.budget.dayNames[d]}</button>)}</div></div>
            <div className="ws-field"><span className="ws-label">{w.budget.hours}</span><p className="ws-hint">{w.budget.hoursHint}</p><div className="wz-pair narrow"><input className="form-input" type="time" value={s.contactFrom} onChange={(e) => patch({ contactFrom: e.target.value })} aria-label={w.budget.hours} /><input className="form-input" type="time" value={s.contactTo} onChange={(e) => patch({ contactTo: e.target.value })} aria-label={w.budget.hours} /></div></div>
            <div className="ws-field"><label className="ws-label" htmlFor="wz-target">{w.budget.target}</label><p className="ws-hint">{w.budget.targetHint}</p><input id="wz-target" className="form-input wiz-num" type="number" min={0} max={1000} value={s.targetMeetings} onChange={(e) => patch({ targetMeetings: Math.max(0, Number(e.target.value) || 0) })} /></div>
            <p className="wz-note">{volume != null ? fmt(w.budget.volume, { n: n(Math.min(volume, prospects || volume)) }) : fmt(w.budget.volumeOpen, { n: n(s.dailyLimit) })}</p>
          </>
        )}

        {s.step === 2 && (
          <>
            <h3>{w.audience.groups}</h3>
            <p className="ws-hint">{w.audience.groupsHint}</p>
            <div className="wz-tabs" role="tablist">
              {s.groups.map((x, i) => <button key={x.key} type="button" role="tab" aria-selected={i === gi} className={i === gi ? "on" : ""} onClick={() => setActive(i)} dir="auto">{x.name || `#${i + 1}`}</button>)}
              {s.groups.length < 8 && <button type="button" className="wz-add" onClick={() => { const ng = emptyGroup(s.groups.length, `${t.camp.groups.name} ${s.groups.length + 1}`); patch({ groups: [...s.groups, ng] }); setActive(s.groups.length); }}><Plus />{w.audience.add}</button>}
            </div>
            <div className="ws-grid-2">
              <div className="ws-field"><label className="ws-label" htmlFor="wz-gname">{w.audience.name}</label><input id="wz-gname" className="form-input" dir="auto" maxLength={120} value={g.name} onChange={(e) => setGroup(gi, { name: e.target.value })} /></div>
              <div className="ws-field"><label className="ws-label" htmlFor="wz-src">{w.audience.source}</label><select id="wz-src" className="form-input" value={g.source} onChange={(e) => setGroup(gi, { source: e.target.value as WizardGroup["source"], audienceId: null, fromCampaignId: null, seed: null, seeds: [] })}>{SOURCES.map((x) => <option key={x} value={x}>{t.camp.groups.sources[x]}</option>)}</select></div>
            </div>
            {s.groups.length > 1 && <button type="button" className="sdr-btn sm danger wz-remove" onClick={() => { patch({ groups: s.groups.filter((_, i) => i !== gi) }); setActive(0); }}><Trash2 />{w.audience.remove}</button>}

            {g.source === "saved" && (
              <div className="ws-field"><label className="ws-label" htmlFor="wz-saved">{w.audience.pickAudience}</label>
                {p.audiences.some((a) => a.kind === "saved") ? (
                  <select id="wz-saved" className="form-input" value={g.audienceId ?? ""} onChange={(e) => { const a = p.audiences.find((x) => x.id === e.target.value); setGroup(gi, { audienceId: a?.id ?? null, targeting: (a?.targeting ?? {}) as never }); }}>
                    <option value="">–</option>{p.audiences.filter((a) => a.kind === "saved").map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                ) : <p className="ws-hint">{w.audience.noAudiences}</p>}
              </div>
            )}
            {g.source === "lookalike" && (
              <div className="wz-look">
                <div className="ws-field"><span className="ws-label">{w.audience.seed}</span>
                  <div className="wz-seg">{SEEDS.map((k) => <button key={k} type="button" className={g.seed === k ? "on" : ""} onClick={() => k === "audience" ? setGroup(gi, { seed: k }) : readSeed(gi, k, null)}>{w.audience.seeds[k]}</button>)}</div></div>
                {g.seed === "audience" && (
                  <select className="form-input" value={g.audienceId ?? ""} onChange={(e) => { setGroup(gi, { audienceId: e.target.value || null }); if (e.target.value) readSeed(gi, "audience", e.target.value); }}>
                    <option value="">{w.audience.pickAudience}</option>{p.audiences.filter((a) => a.kind === "custom").map((a) => <option key={a.id} value={a.id}>{a.name} ({n(a.members)})</option>)}
                  </select>
                )}
                {pending && !look && <p className="wiz-wait"><Loader2 className="spin" />{w.audience.estimating}</p>}
                {look && (look.seedSize ? (
                  <div className="wz-traits"><strong>{fmt(w.audience.seedSize, { n: n(look.seedSize) })} {w.audience.confidence[look.confidence]}</strong>
                    {look.traits.length > 0 && <><span>{w.audience.traits}</span><ul>{look.traits.map((x) => <li key={`${x.field}${x.value}`} dir="auto">{x.field === "countries" ? countryLabel(x.value, locale) : x.value} · {fmt(w.audience.share, { pct: `${Math.round(x.share * 100)}%` })}</li>)}</ul></>}
                    <p className="ws-hint">{w.audience.similarNote}</p></div>
                ) : <p className="form-error">{w.audience.seedEmpty}</p>)}
              </div>
            )}
            {g.source === "custom" && (
              <div className="ws-field"><label className="ws-label" htmlFor="wz-custom">{w.audience.pickAudience}</label>
                {p.audiences.some((a) => a.kind === "custom") ? (
                  <select id="wz-custom" className="form-input" value={g.audienceId ?? ""} onChange={(e) => setGroup(gi, { audienceId: e.target.value || null })}><option value="">–</option>{p.audiences.filter((a) => a.kind === "custom").map((a) => <option key={a.id} value={a.id}>{a.name} ({n(a.members)})</option>)}</select>
                ) : <p className="ws-hint">{w.audience.noAudiences} <Link className="ws-link" href="/prospects/audiences">{t.camp.aud.title}</Link></p>}
                <p className="ws-hint">{w.audience.listNote}</p></div>
            )}
            {g.source === "previous_campaign" && (
              <div className="ws-field"><label className="ws-label" htmlFor="wz-prev">{w.audience.pickCampaign}</label>
                <select id="wz-prev" className="form-input" value={g.fromCampaignId ?? ""} onChange={(e) => setGroup(gi, { fromCampaignId: e.target.value || null })}><option value="">–</option>{p.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <p className="ws-hint">{w.audience.listNote}</p></div>
            )}
            {(g.source === "imported" || g.source === "customers") && <p className="ws-hint">{w.audience.listNote}</p>}
            {(g.source === "find_new" || g.source === "saved" || g.source === "lookalike") && (
              <>
                <TargetingEditor value={g.targeting as Targeting} onChange={(tg) => setGroup(gi, { targeting: tg as never })} />
                <div className="wz-summary">
                  <strong>{w.audience.summary}</strong>
                  <ul>{targetingSummary(g.targeting as Targeting, lang, (c) => countryLabel(c, locale)).map((l) => <li key={l} dir="auto">{l}</li>)}</ul>
                  <div className="wz-row">
                    <button type="button" className="sdr-btn sm" disabled={pending || !hasAny(g.targeting)} onClick={checkAudience}>{pending ? w.audience.estimating : w.audience.estimate}</button>
                    {g.source === "find_new" && hasAny(g.targeting) && <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => call(() => saveAudience({ kind: "saved", name: g.name, targeting: g.targeting }), () => toast(w.audience.audienceSaved))}>{w.audience.saveAudience}</button>}
                  </div>
                  {est && (
                    <dl className="wz-est">
                      <dt>{fmt(w.audience.inWorkspace, { n: n(est.inWorkspace) })}</dt>
                      {est.inWorkspace > 0 && <dd>{fmt(w.audience.withEmail, { n: n(est.withEmail), pct: `${Math.round((est.completeness ?? 0) * 100)}%` })} · {fmt(w.audience.verified, { n: n(est.verified) })}</dd>}
                      {est.overlapGroups > 0 && <dd>{fmt(w.audience.overlap, { n: n(est.overlapGroups) })}</dd>}
                      {est.inRunningCampaigns > 0 && <dd>{fmt(w.audience.running, { n: n(est.inRunningCampaigns) })}</dd>}
                      <dd>{est.canFindNew ? w.audience.newMarket : w.audience.noSource}</dd>
                      <dd className="ws-hint">{w.audience.estimateNote}</dd>
                    </dl>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {s.step === 3 && (
          <>
            <h3>{w.channels.title}</h3>
            {CHANNELS.filter((c) => c.available).map((c) => (
              <label key={c.id} className="wz-channel">
                <input type="checkbox" checked={s.channels.includes(c.id)} onChange={() => patch({ channels: s.channels.includes(c.id) && s.channels.length > 1 ? s.channels.filter((x) => x !== c.id) : [...new Set([...s.channels, c.id])] })} />
                <Mail />
                <div><strong>{c.label[lang]}</strong>
                  <span>{p.mailbox ? fmt(w.channels.connected, { email: p.mailbox }) : <>{w.channels.notConnected} <Link className="ws-link" href="/integrations">{w.channels.connect}</Link></>}</span>
                  <span>{w.channels.capabilities}</span><span>{w.channels.limits}</span><span>{w.channels.compliance} {c.compliance[lang]}</span></div>
              </label>
            ))}
            <p className="ws-hint">{w.channels.only}</p>
          </>
        )}

        {s.step === 4 && (
          <>
            <div className="wz-row spread"><h3>{w.plan.title}</h3>
              {s.groups.some((x) => x.angleA) && <button type="button" className="sdr-btn sm" disabled={pending} onClick={plan}><Sparkles />{w.plan.regenerate}</button>}</div>
            {!s.groups.some((x) => x.angleA) && (pending ? <p className="wiz-wait"><Loader2 className="spin" />{w.plan.making}</p> : <button type="button" className="sdr-btn primary" onClick={plan}><Sparkles />{w.plan.make}</button>)}
            <p className="wz-note">{w.plan.volume}: {fmt(w.plan.volumeLine, { prospects: n(prospects), daily: n(s.dailyLimit) })}</p>
            {s.groups.some((x) => x.angleA) && s.groups.map((x, i) => (
              <div key={x.key} className="wz-plan">
                <h4 dir="auto">{x.name} · {t.camp.groups.sources[x.source]}</h4>
                {x.why && <p className="ws-hint" dir="auto"><strong>{w.plan.why}:</strong> {x.why}</p>}
                {x.risks && <p className="ws-hint" dir="auto"><strong>{w.plan.risks}:</strong> {x.risks}</p>}
                <div className="ws-field"><label className="ws-label">{w.plan.angleA}</label><textarea className="form-input" rows={2} dir="auto" maxLength={1000} value={x.angleA} onChange={(e) => setGroup(i, { angleA: e.target.value })} /></div>
                <div className="ws-field"><label className="ws-label">{w.plan.angleB}</label><textarea className="form-input" rows={2} dir="auto" maxLength={1000} value={x.angleB} onChange={(e) => setGroup(i, { angleB: e.target.value })} /></div>
                <div className="ws-field"><span className="ws-label">{w.plan.sequence}</span>
                  <ol className="wz-seq">{x.steps.map((st, k) => (
                    <li key={k}>
                      <span>{fmt(w.plan.step, { n: String(k + 1) })} · {k === 0 ? w.plan.first : w.plan.followUp}</span>
                      {k > 0 && <label>{fmt(w.plan.day, { n: "" })}<input className="sdr-input sm" type="number" min={1} max={60} value={st.delayDays} onChange={(e) => setGroup(i, { steps: x.steps.map((y, j) => (j === k ? { ...y, delayDays: Math.max(1, Number(e.target.value) || 1) } : y)) })} /></label>}
                      <input className="sdr-input sm wz-ins" dir="auto" maxLength={500} placeholder={w.plan.instruction} value={st.instruction} onChange={(e) => setGroup(i, { steps: x.steps.map((y, j) => (j === k ? { ...y, instruction: e.target.value } : y)) })} />
                      {k > 0 && <button type="button" className="sdr-btn sm" onClick={() => setGroup(i, { steps: x.steps.filter((_, j) => j !== k) })}>{w.plan.removeStep}</button>}
                    </li>
                  ))}</ol>
                  {x.steps.length < 5 && <button type="button" className="sdr-btn sm" onClick={() => setGroup(i, { steps: [...x.steps, { delayDays: (x.steps.at(-1)?.delayDays ?? 0) + 4, objective: "follow_up", instruction: "" }] })}><Plus />{w.plan.addStep}</button>}
                  <p className="ws-hint">{w.plan.stops}</p></div>
              </div>
            ))}
            {s.groups.some((x) => x.angleA) && (
              <button type="button" className={`sdr-btn ${s.planned ? "" : "primary"}`} disabled={s.planned || !s.groups.every((x) => x.angleA.trim())} onClick={() => setS((cur) => ({ ...cur, planned: true }))}>{s.planned ? <><Check />{w.plan.approved}</> : w.plan.approve}</button>
            )}
            {!s.planned && s.groups.some((x) => x.angleA) && <p className="ws-hint">{w.plan.needApprove}</p>}
          </>
        )}

        {s.step === 5 && (
          <>
            <h3>{w.review.title}</h3>
            <dl className="wiz-plan">
              <dt>{w.basics.name}</dt><dd dir="auto">{s.name}</dd>
              <dt>{w.basics.objective}</dt><dd>{s.objective === "custom" ? s.customObjective : t.camp.manager.objectives[s.objective]}</dd>
              <dt>{w.budget.amount}</dt><dd>{usd(s.budgetUsd)} · {w.budget.types[s.budgetType]} · ≈ {n(prospects)}</dd>
              <dt>{w.budget.start}</dt><dd>{s.startDate || p.today} {s.startTime}{s.endDate ? ` → ${s.endDate} ${s.endTime}` : ` · ${w.budget.noEnd}`} · {s.timezone}</dd>
              <dt>{w.budget.days}</dt><dd>{s.runDays.map((d) => w.budget.dayNames[d]).join("، ")} · {s.contactFrom}–{s.contactTo} · {fmt(w.budget.volumeOpen, { n: n(s.dailyLimit) })}</dd>
              <dt>{w.audience.groups}</dt><dd>{s.groups.map((x) => <div key={x.key} dir="auto">{x.name} · {t.camp.groups.sources[x.source]}</div>)}</dd>
              <dt>{w.channels.title}</dt><dd>{s.channels.map((c) => CHANNELS.find((x) => x.id === c)?.label[lang]).join(" + ")}</dd>
            </dl>
            <div className="wiz-next"><strong>{w.review.what}</strong><p>{w.review.whatLine}</p></div>
            {warnings.length > 0 && <div className="ws-note"><strong>{w.review.warnings}</strong><ul>{warnings.map((x) => <li key={x}>{x}</li>)}</ul></div>}
          </>
        )}
      </section>

      <div className="wiz-actions">
        <button type="button" className="sdr-btn" disabled={pending || !s.name.trim()} onClick={() => persist(s, false)}>{w.saveDraft}</button>
        <span className="cm-spacer" />
        {s.step > 0 && <button type="button" className="sdr-btn" disabled={pending} onClick={() => go(s.step - 1)}>{w.back}</button>}
        {s.step < 5
          ? <button type="button" className="sdr-btn primary" disabled={!canNext || pending} onClick={() => go(s.step + 1)}>{w.next}</button>
          : <button type="button" className="sdr-btn primary" disabled={pending} onClick={launch}>{pending && <Loader2 className="spin" />}{pending ? w.launching : w.launch}</button>}
      </div>
    </div>
  );
}

function hasAny(tg: unknown): boolean {
  const t = tg as Record<string, { include?: string[] } | string | undefined>;
  return Object.entries(t ?? {}).some(([k, v]) => (k === "description" ? Boolean((v as string)?.trim()) : ((v as { include?: string[] })?.include?.length ?? 0) > 0));
}
