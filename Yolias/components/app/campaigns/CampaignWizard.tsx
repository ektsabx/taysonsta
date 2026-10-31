"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Check, Globe, Loader2, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { useToast } from "@/components/Toast";
import { launchWizardCampaign, proposeStrategy, understandAudience, type Angles, type AudienceSummary } from "@/app/(app)/outreach/new/actions";
import type { CampaignAim } from "@/types/acquisition";

// The campaign wizard (owner, 2026-10-31, D-270): six steps, after Facebook
// Ads' "objective → audience → budget and schedule → review". The member sets
// what and who; Yolias plans how. Nothing is sent from here: launching starts
// the search, and the first email still waits for the member's approval.

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const split = (s: string) => s.split(/[,،]/).map((x) => x.trim()).filter(Boolean).slice(0, 20);

export function CampaignWizard({ available }: { available: number }) {
  const { t, locale } = useI18n();
  const w = t.camp.wizard;
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);

  const [aim, setAim] = useState<CampaignAim>("meeting");
  const [ctaUrl, setCtaUrl] = useState("");
  const [description, setDescription] = useState("");
  const [countries, setCountries] = useState("");
  const [industries, setIndustries] = useState("");
  const [titles, setTitles] = useState("");
  const [sizeMin, setSizeMin] = useState("");
  const [sizeMax, setSizeMax] = useState("");
  const [audience, setAudience] = useState<AudienceSummary | null>(null);
  const [target, setTarget] = useState(10);
  const [today] = useState(() => isoDay(Date.now()));
  const [startDay, setStartDay] = useState(today);
  const [endDay, setEndDay] = useState(() => isoDay(Date.now() + 30 * DAY));
  const [noEnd, setNoEnd] = useState(false);
  const [budget, setBudget] = useState(Math.min(500, Math.max(available, 10)));
  const [daily, setDaily] = useState(30);
  const [angles, setAngles] = useState<Angles | null>(null);
  const [angleA, setAngleA] = useState("");
  const [angleB, setAngleB] = useState("");
  const [name, setName] = useState("");

  const n = (v: number) => formatNumber(v, locale);
  const fail = (msg: string) => toast(msg, "error");
  const call = <R extends { ok: boolean }>(fn: () => Promise<R>, then: (r: R) => void) => start(async () => {
    const r = await callAction(fn);
    if (isNetworkFailure(r)) { fail(t.feedback.errors.network); return; }
    if (!r.ok) { fail((r as unknown as { error: string }).error); return; }
    then(r);
  });

  const readAudience = () => call(() => understandAudience({
    description, countries: split(countries), industries: split(industries), titles: split(titles),
    sizeMin: sizeMin ? Number(sizeMin) : null, sizeMax: sizeMax ? Number(sizeMax) : null,
  }), (r) => { const a = (r as { audience: AudienceSummary }).audience; setAudience(a); setName((x) => x || a.name); setAngles(null); setStep(2); });

  const plan = () => call(() => proposeStrategy(audience!.strategyId, aim), (r) => {
    const a = (r as { angles: Angles }).angles; setAngles(a); setAngleA(a.a); setAngleB(a.b);
  });

  const launch = () => call(() => launchWizardCampaign({
    strategyId: audience!.strategyId, name: name.trim() || audience!.name, aim, ctaUrl: aim === "sell" ? ctaUrl : null, target,
    startsAt: new Date(`${startDay}T00:00:00`).toISOString(), endsAt: noEnd ? null : new Date(`${endDay}T23:59:00`).toISOString(),
    budget, dailyLimit: daily, angleA: angleA.trim(), angleB: angleB.trim() || null,
  }), (r) => router.push(`/outreach/${(r as { id: string }).id}`));

  const next = () => {
    if (step === 1) return readAudience();
    if (step === 3) { setStep(4); if (!angles) plan(); return; }
    setStep((s) => Math.min(s + 1, 5));
  };
  const canNext = [
    aim === "meeting" || /^https?:\/\/\S+\.\S+/.test(ctaUrl),
    Boolean(description.trim() || industries.trim() || titles.trim()),
    target > 0 && (noEnd || endDay > startDay),
    budget >= 10 && budget <= Math.max(available, 10) && daily > 0,
    Boolean(angles && angleA.trim()),
    true,
  ][step];

  const sizeText = audience && (audience.sizeMin || audience.sizeMax) ? `${audience.sizeMin ?? 1}–${audience.sizeMax ?? "∞"}` : null;
  const audienceLine = audience ? [audience.industries.slice(0, 3).join("، "), [...audience.countries, ...audience.cities].slice(0, 4).join("، "), audience.titles.slice(0, 3).join("، "), sizeText].filter(Boolean).join(" · ") : "";

  return (
    <div className="wiz">
      <ol className="wiz-steps" aria-label={w.title}>
        {w.steps.map((label, i) => (
          <li key={label} className={i === step ? "on" : i < step ? "done" : ""} aria-current={i === step ? "step" : undefined}>
            <span>{i < step ? <Check /> : i + 1}</span>{label}
          </li>
        ))}
      </ol>

      <section className="wiz-card">
        {step === 0 && (
          <>
            <h3>{w.goal.title}</h3>
            <div className="wiz-choices" role="radiogroup">
              <button type="button" role="radio" aria-checked={aim === "meeting"} className={aim === "meeting" ? "on" : ""} onClick={() => setAim("meeting")}>
                <CalendarCheck /><strong>{w.goal.meeting}</strong><span>{w.goal.meetingDesc}</span>
              </button>
              <button type="button" role="radio" aria-checked={aim === "sell"} className={aim === "sell" ? "on" : ""} onClick={() => setAim("sell")}>
                <Globe /><strong>{w.goal.sell}</strong><span>{w.goal.sellDesc}</span>
              </button>
            </div>
            {aim === "sell" && (
              <div className="ws-field"><label className="ws-label" htmlFor="wiz-url">{w.goal.link}</label><p className="ws-hint">{w.goal.linkHint}</p>
                <input id="wiz-url" className="form-input" dir="ltr" value={ctaUrl} maxLength={500} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://" /></div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <h3>{w.audience.title}</h3>
            <div className="ws-field"><label className="ws-label" htmlFor="wiz-desc">{w.audience.description}</label><p className="ws-hint">{w.audience.descriptionHint}</p>
              <textarea id="wiz-desc" className="form-input" rows={3} dir="auto" maxLength={2000} value={description} placeholder={w.audience.descriptionPlaceholder} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="ws-grid-2">
              <div className="ws-field"><label className="ws-label" htmlFor="wiz-ind">{w.audience.industries}</label><p className="ws-hint">{w.audience.listHint}</p><input id="wiz-ind" className="form-input" dir="auto" value={industries} onChange={(e) => setIndustries(e.target.value)} /></div>
              <div className="ws-field"><label className="ws-label" htmlFor="wiz-geo">{w.audience.countries}</label><p className="ws-hint">{w.audience.listHint}</p><input id="wiz-geo" className="form-input" dir="auto" value={countries} onChange={(e) => setCountries(e.target.value)} /></div>
              <div className="ws-field"><label className="ws-label" htmlFor="wiz-titles">{w.audience.titles}</label><p className="ws-hint">{w.audience.listHint}</p><input id="wiz-titles" className="form-input" dir="auto" value={titles} onChange={(e) => setTitles(e.target.value)} /></div>
              <div className="ws-field"><span className="ws-label">{w.audience.size}</span><p className="ws-hint">&nbsp;</p>
                <div className="wiz-range">
                  <input className="form-input" type="number" min={1} inputMode="numeric" aria-label={w.audience.sizeMin} placeholder={w.audience.sizeMin} value={sizeMin} onChange={(e) => setSizeMin(e.target.value)} />
                  <input className="form-input" type="number" min={1} inputMode="numeric" aria-label={w.audience.sizeMax} placeholder={w.audience.sizeMax} value={sizeMax} onChange={(e) => setSizeMax(e.target.value)} />
                </div></div>
            </div>
            {pending && <p className="wiz-wait"><Loader2 className="spin" />{w.audience.reading}</p>}
          </>
        )}

        {step >= 2 && audience && step < 5 && (
          <div className="wiz-understood"><Sparkles /><div><strong>{w.audience.understood}</strong><span dir="auto">{audience.summary}</span>{audienceLine && <small dir="auto">{audienceLine}</small>}</div>
            <button type="button" className="sdr-btn" onClick={() => setStep(1)}>{w.audience.edit}</button></div>
        )}

        {step === 2 && (
          <>
            <h3>{w.target.title}</h3>
            <div className="ws-field"><label className="ws-label" htmlFor="wiz-target">{w.target.meetings}</label><p className="ws-hint">{w.target.meetingsHint}</p>
              <input id="wiz-target" className="form-input wiz-num" type="number" min={1} max={1000} value={target} onChange={(e) => setTarget(Math.max(0, Number(e.target.value) || 0))} /></div>
            <div className="ws-grid-2">
              <div className="ws-field"><label className="ws-label" htmlFor="wiz-start">{w.target.start}</label><input id="wiz-start" className="form-input" type="date" min={today} value={startDay} onChange={(e) => setStartDay(e.target.value)} /></div>
              <div className="ws-field"><label className="ws-label" htmlFor="wiz-end">{w.target.end}</label><input id="wiz-end" className="form-input" type="date" min={startDay} value={endDay} disabled={noEnd} onChange={(e) => setEndDay(e.target.value)} />
                <label className="wiz-check"><input type="checkbox" checked={noEnd} onChange={(e) => setNoEnd(e.target.checked)} />{w.target.noEnd}</label></div>
            </div>
            <p className="ws-hint">{w.target.endHint}</p>
          </>
        )}

        {step === 3 && (
          <>
            <h3>{w.budget.title}</h3>
            <div className="ws-field"><label className="ws-label" htmlFor="wiz-budget">{w.budget.prospects}</label><p className="ws-hint">{w.budget.prospectsHint}</p>
              <input id="wiz-budget" className="form-input wiz-num" type="number" min={10} max={Math.max(available, 10)} step={10} value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))} />
              <p className={available > 0 ? "ws-hint" : "form-error"}>{available > 0 ? fmt(w.budget.available, { count: n(available) }) : w.budget.none}</p></div>
            <div className="ws-field"><label className="ws-label" htmlFor="wiz-daily">{w.budget.daily}</label><p className="ws-hint">{w.budget.dailyHint}</p>
              <input id="wiz-daily" className="form-input wiz-num" type="number" min={1} max={500} value={daily} onChange={(e) => setDaily(Math.max(0, Number(e.target.value) || 0))} /></div>
          </>
        )}

        {step === 4 && (
          <>
            <h3>{w.strategy.title}</h3>
            {!angles && pending && <p className="wiz-wait"><Loader2 className="spin" />{w.strategy.thinking}</p>}
            {!angles && !pending && <button type="button" className="sdr-btn" onClick={plan}>{w.strategy.retry}</button>}
            {angles && (
              <>
                <div className="wiz-block"><h4>{w.strategy.angles}</h4><p className="ws-hint" dir="auto">{angles.why}</p>
                  <div className="ws-field"><label className="ws-label" htmlFor="wiz-a">{w.strategy.angleA}</label><textarea id="wiz-a" className="form-input" rows={2} dir="auto" maxLength={1000} value={angleA} onChange={(e) => setAngleA(e.target.value)} /></div>
                  <div className="ws-field"><label className="ws-label" htmlFor="wiz-b">{w.strategy.angleB}</label><textarea id="wiz-b" className="form-input" rows={2} dir="auto" maxLength={1000} value={angleB} onChange={(e) => setAngleB(e.target.value)} /></div>
                  <p className="ws-hint">{w.strategy.anglesHint}</p></div>
                <dl className="wiz-plan">
                  <dt>{w.strategy.sequence}</dt><dd>{w.strategy.sequenceLine}</dd>
                  <dt>{w.strategy.replies}</dt><dd>{w.strategy.repliesLine}</dd>
                  {aim === "meeting" && <><dt>{w.strategy.meetings}</dt><dd>{w.strategy.meetingsLine}</dd></>}
                  <dt>{w.strategy.forecast}</dt><dd>{w.strategy.forecastLine}</dd>
                </dl>
              </>
            )}
          </>
        )}

        {step === 5 && audience && (
          <>
            <h3>{w.review.title}</h3>
            <div className="ws-field"><label className="ws-label" htmlFor="wiz-name">{w.review.name}</label><input id="wiz-name" className="form-input" dir="auto" maxLength={160} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <dl className="wiz-plan">
              <dt>{w.review.goal}</dt><dd>{aim === "meeting" ? w.goal.meeting : `${w.goal.sell} · ${ctaUrl}`}</dd>
              <dt>{w.review.audience}</dt><dd dir="auto">{audience.summary}</dd>
              <dt>{w.review.target}</dt><dd>{fmt(w.review.meetingsN, { n: n(target) })}</dd>
              <dt>{w.review.dates}</dt><dd>{noEnd ? fmt(w.review.fromOpen, { from: startDay }) : fmt(w.review.fromTo, { from: startDay, to: endDay })}</dd>
              <dt>{w.review.budget}</dt><dd>{fmt(w.review.prospectsN, { n: n(budget) })}</dd>
              <dt>{w.review.daily}</dt><dd>{fmt(w.review.emailsN, { n: n(daily) })}</dd>
            </dl>
            <div className="wiz-next"><strong>{w.review.what}</strong><p>{w.review.whatLine}</p></div>
          </>
        )}
      </section>

      <div className="wiz-actions">
        {step > 0 && <button type="button" className="sdr-btn" disabled={pending} onClick={() => setStep((s) => s - 1)}>{w.back}</button>}
        {step < 5
          ? <button type="button" className="sdr-btn primary" disabled={!canNext || pending} onClick={next}>{pending && <Loader2 className="spin" />}{w.next}</button>
          : <button type="button" className="sdr-btn primary" disabled={pending} onClick={launch}>{pending && <Loader2 className="spin" />}{pending ? w.launching : w.launch}</button>}
      </div>
    </div>
  );
}
