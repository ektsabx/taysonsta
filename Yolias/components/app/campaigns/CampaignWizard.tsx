"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Clock, Info, Mail, Plus, Search, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { addProspectsToCampaign, addSearchToCampaign, saveOutreachCampaign } from "@/app/(app)/outreach/actions";
import { openSettingsTab } from "@/components/app/open-settings";
import { AIMS, aimUsesLink } from "@/lib/outreach/aim";
import { languageLabels, messageLanguages, objectives, tones } from "@/lib/outreach/channels";
import { LaunchPanel, type MailboxOption } from "@/components/app/ws/LaunchPanel";
import type { LaunchSummary } from "@/services/outreach-campaigns";
import type { CampaignAim } from "@/types/acquisition";
import type { MessageObjective, MessageTone } from "@/types/database";

type Step = { delay_days: number; objective: MessageObjective; instruction: string };
export interface WizardDraft {
  id: string; name: string; aim: CampaignAim; cta: string; language: string; tone: MessageTone; profile: string | null; offer: string | null;
  steps: Step[]; leads: number;
}
interface Props {
  draft: WizardDraft | null;
  launch: LaunchSummary | null;
  searches: { id: string; name: string }[];
  people: { key: string; kind: "person" | "company"; id: string; name: string; sub: string | null }[];
  profiles: { id: string; name: string }[];
  offers: { id: string; name: string }[];
  mailboxes: MailboxOption[];
  maxSteps: number;
  dailyLimit: number;
  language: string;
  /** Start from a search (?from=). */
  from: string | null;
}

// Create a campaign (D-256, after AgentSDR's wizard): 1 details, 2 leads,
// 3 sequence, 4 review & launch. Continuing from step 1 saves a draft; going
// back edits the same draft. Nothing is sent before the approval in step 4.
export function CampaignWizard(p: Props) {
  const { t, locale } = useI18n();
  const w = t.sdr.campaigns.w;
  const sq = t.sdr.campaigns.s;
  const o = t.ws.outreach;
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(p.draft ? (p.draft.leads ? 3 : 2) : 1);
  const [v, setV] = useState<Omit<WizardDraft, "id" | "leads">>(() => p.draft ?? {
    name: "", aim: "meeting", cta: "", language: p.language, tone: "direct", profile: null, offer: null,
    steps: [{ delay_days: 0, objective: "introduction", instruction: "" }, { delay_days: 3, objective: "follow_up", instruction: "" }],
  });
  const [mode, setMode] = useState<"search" | "people">(p.from ? "search" : p.searches.length ? "search" : "people");
  const [search, setSearch] = useState(p.from ?? p.searches[0]?.id ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const n = (x: number) => formatNumber(x, locale);
  const leads = p.draft?.leads ?? 0;
  const shown = useMemo(() => p.people.filter((x) => !q || `${x.name} ${x.sub ?? ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 200), [p.people, q]);

  const save = (next: number) => start(async () => {
    const r = await saveOutreachCampaign({
      id: p.draft?.id, name: v.name.trim(), goal: "", description: "", channel: "email", language: v.language, tone: v.tone,
      customer_profile_id: v.profile, offer_id: v.offer, steps: v.steps, aim: v.aim, cta_url: aimUsesLink(v.aim) ? v.cta.trim() || null : null,
    });
    if (!r.ok) { toast(r.error, "error"); return; }
    setStep(next);
    if (!p.draft) router.replace(`/outreach/new?draft=${r.id}`);
    else router.refresh();
  });
  const addLeads = () => start(async () => {
    if (!p.draft) return;
    const r = mode === "search"
      ? await addSearchToCampaign(p.draft.id, search)
      : await addProspectsToCampaign(p.draft.id, p.people.filter((x) => picked.has(x.key)).map((x) => ({ kind: x.kind, id: x.id })));
    if (!r.ok) { toast(r.error, "error"); return; }
    if (r.message) toast(r.message);
    setPicked(new Set());
    router.refresh();
  });

  const steps = [[w.s1, w.s1Sub], [w.s2, w.s2Sub], [w.s3, w.s3Sub], [w.s4, w.s4Sub]] as const;
  const can = (i: number) => i === 1 || (Boolean(p.draft) && (i <= 3 || leads > 0));
  const setS = (i: number, patch: Partial<Step>) => setV({ ...v, steps: v.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <div className="sdr-page">
      <div>
        <Link className="sdr-back" href="/outreach"><ChevronLeft className="flip-rtl" />{w.back}</Link>
        <div className="sdr-head"><div><h2>{w.title}</h2><p>{w.sub}</p></div></div>
      </div>
      <div className="sdr-wizard">
        <aside className="sdr-panel">
          <div className="sdr-panel-head"><div><div className="sdr-panel-title">{w.steps}</div><div className="sdr-panel-sub">{fmt(w.stepOf, { n: step })}</div></div></div>
          <div className="sdr-panel-body" style={{ padding: 8 }}>
            <ol className="sdr-flow" style={{ margin: 0 }}>
              {steps.map(([title, sub], i) => (
                <li key={title}>
                  <button type="button" className={`sdr-flow-step${step === i + 1 ? " active" : ""}`} disabled={!can(i + 1)} onClick={() => setStep(i + 1)}>
                    <span className="num">{step > i + 1 ? <Check size={13} /> : i + 1}</span>
                    <span><strong>{title}</strong><span className="sdr-cell-sub">{sub}</span></span>
                  </button>
                </li>
              ))}
            </ol>
            <dl className="sdr-summary">
              <dt>{w.summary}</dt>
              <div><dt>{w.sumName}</dt><dd dir="auto">{v.name.trim() || w.notNamed}</dd></div>
              <div><dt>{w.sumLeads}</dt><dd>{n(leads)}</dd></div>
              <div><dt>{w.sumSequence}</dt><dd>{fmt(w.nSteps, { n: n(v.steps.length) })}</dd></div>
            </dl>
          </div>
        </aside>

        <section className="sdr-panel">
          <div className="sdr-panel-body sdr-wizard-body">
            <span className="sdr-wizard-icon"><Mail /></span>
            {step === 1 && (<>
              <h3>{w.nameTitle}</h3><p className="sdr-panel-sub">{w.nameSub}</p>
              <div className="sdr-box">
                <label><span className="sdr-field-label">{w.name}</span><input className="sdr-input" style={{ width: "100%" }} dir="auto" autoFocus value={v.name} maxLength={160} placeholder={w.namePh} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
                <label><span className="sdr-field-label">{w.aimTitle}</span>
                  <select className="sdr-input" style={{ width: "100%" }} value={v.aim} onChange={(e) => setV({ ...v, aim: e.target.value as CampaignAim })}>{AIMS.map((x) => <option key={x} value={x}>{o.launch.aims[x]}</option>)}</select>
                  <span className="sdr-cell-sub" style={{ marginTop: 6 }}>{o.launch.aimHints[v.aim]}</span></label>
                {aimUsesLink(v.aim) && <label><span className="sdr-field-label">{o.launch.ctaUrl[v.aim]}</span><input className="sdr-input" style={{ width: "100%" }} dir="ltr" type="url" placeholder={o.launch.ctaPh} value={v.cta} maxLength={500} onChange={(e) => setV({ ...v, cta: e.target.value })} /></label>}
                <p className="sdr-note"><Info />{w.draftNote}</p>
              </div>
            </>)}

            {step === 2 && (<>
              <h3>{w.leadsTitle}</h3><p className="sdr-panel-sub">{w.leadsSub}</p>
              <div className="sdr-box">
                <div className="sdr-seg">
                  <button type="button" className={mode === "search" ? "active" : ""} disabled={!p.searches.length} onClick={() => setMode("search")}>{w.fromSearch}</button>
                  <button type="button" className={mode === "people" ? "active" : ""} onClick={() => setMode("people")}>{w.fromPeople}</button>
                </div>
                {mode === "search" ? (
                  <label><span className="sdr-field-label">{w.pickSearch}</span>
                    <select className="sdr-input" style={{ width: "100%" }} value={search} onChange={(e) => setSearch(e.target.value)}>{p.searches.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                ) : !p.people.length ? <p className="sdr-panel-sub">{w.noPeople} <Link href="/prospects">{t.nav.prospects}</Link></p> : (<>
                  <label className="sdr-search"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={w.searchPeople} aria-label={w.searchPeople} /></label>
                  <div className="sdr-pick">
                    {shown.map((x) => (
                      <label key={x.key}><input type="checkbox" checked={picked.has(x.key)} onChange={() => setPicked((s) => { const nx = new Set(s); if (nx.has(x.key)) nx.delete(x.key); else nx.add(x.key); return nx; })} />
                        <span><span className="sdr-cell-main" dir="auto">{x.name}</span>{x.sub && <span className="sdr-cell-sub" dir="auto">{x.sub}</span>}</span></label>
                    ))}
                  </div>
                  <span className="sdr-cell-sub">{fmt(w.pickedN, { n: n(picked.size) })}</span>
                </>)}
                <div><button type="button" className="sdr-btn" disabled={pending || (mode === "search" ? !search : !picked.size)} onClick={addLeads}><Plus />{w.add}</button></div>
                <p className="sdr-note"><Info />{fmt(w.inCampaign, { n: n(leads) })}</p>
              </div>
            </>)}

            {step === 3 && (<>
              <h3>{w.seqTitle}</h3><p className="sdr-panel-sub">{w.seqSub}</p>
              <div className="sdr-box">
                {v.steps.map((s, i) => (
                  <div key={i} className="sdr-step-card">
                    <div className="sdr-step-card-head">
                      <strong>{i === 0 ? sq.initial : fmt(sq.followUp, { n: i })}</strong>
                      {i > 0 && <span className="sdr-wait" style={{ border: 0, margin: 0, padding: 0 }}><Clock />{sq.wait}<input className="sdr-input num" type="number" min={1} max={90} value={s.delay_days} onChange={(e) => setS(i, { delay_days: Math.max(1, Math.min(90, Number(e.target.value) || 1)) })} />{sq.days}</span>}
                      {i > 0 && <button type="button" className="sdr-icon-btn" aria-label={sq.remove} onClick={() => setV({ ...v, steps: v.steps.filter((_, j) => j !== i) })}><Trash2 /></button>}
                    </div>
                    <select className="sdr-input" style={{ width: "100%" }} value={s.objective} onChange={(e) => setS(i, { objective: e.target.value as MessageObjective })}>{objectives.map((x) => <option key={x} value={x}>{o.objectives[x]}</option>)}</select>
                    <textarea className="sdr-input" style={{ width: "100%", minHeight: 90, padding: 10, lineHeight: 1.5 }} dir="auto" placeholder={sq.goalPh} value={s.instruction} maxLength={1000} onChange={(e) => setS(i, { instruction: e.target.value })} aria-label={sq.goal} />
                  </div>
                ))}
                <button type="button" className="sdr-btn" disabled={v.steps.length >= p.maxSteps} onClick={() => setV({ ...v, steps: [...v.steps, { delay_days: 3, objective: "follow_up", instruction: "" }] })}><Plus />{sq.add}</button>
                <div className="sdr-grid3" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                  <label><span className="sdr-field-label">{sq.language}</span><select className="sdr-input" value={v.language} onChange={(e) => setV({ ...v, language: e.target.value })}>{(Object.keys(messageLanguages) as (keyof typeof messageLanguages)[]).map((x) => <option key={x} value={x}>{languageLabels[x]}</option>)}</select></label>
                  <label><span className="sdr-field-label">{sq.tone}</span><select className="sdr-input" value={v.tone} onChange={(e) => setV({ ...v, tone: e.target.value as MessageTone })}>{tones.map((x) => <option key={x} value={x}>{o.tones[x]}</option>)}</select></label>
                  <label><span className="sdr-field-label">{sq.profile}</span><select className="sdr-input" value={v.profile ?? ""} onChange={(e) => setV({ ...v, profile: e.target.value || null })}><option value="">{sq.none}</option>{p.profiles.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                  <label><span className="sdr-field-label">{sq.offer}</span><select className="sdr-input" value={v.offer ?? ""} onChange={(e) => setV({ ...v, offer: e.target.value || null })}><option value="">{sq.none}</option>{p.offers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                </div>
                <p className="sdr-note"><Info />{sq.goalSub}</p>
              </div>
            </>)}

            {step === 4 && (<>
              <h3>{w.reviewTitle}</h3><p className="sdr-panel-sub">{w.reviewSub}</p>
              <div className="sdr-box" style={{ padding: 0, border: 0, background: "none" }}>
                {!p.mailboxes.length ? (
                  <div className="sdr-box"><strong>{o.workspace.noMailboxTitle}</strong><span className="sdr-panel-sub">{o.workspace.noMailbox}</span><div><button type="button" className="sdr-btn primary" onClick={() => openSettingsTab("integration")}>{o.workspace.connect}</button></div></div>
                ) : p.launch ? <LaunchPanel summary={p.launch} mailboxes={p.mailboxes} mailboxName={null} dailyLimit={p.dailyLimit} /> : null}
              </div>
            </>)}

            <div className="sdr-wizard-foot">
              {step === 1 ? <Link className="sdr-btn ghost" href="/outreach">{w.cancel}</Link> : <button type="button" className="sdr-btn ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="flip-rtl" />{w.backStep}</button>}
              {step === 1 && <button type="button" className="sdr-btn primary" disabled={pending || !v.name.trim()} onClick={() => save(2)}>{w.continue}<ArrowRight className="flip-rtl" /></button>}
              {step === 2 && <button type="button" className="sdr-btn primary" disabled={pending || !leads} onClick={() => setStep(3)}>{w.continue}<ArrowRight className="flip-rtl" /></button>}
              {step === 3 && <button type="button" className="sdr-btn primary" disabled={pending || !v.steps.length} onClick={() => save(4)}>{w.continue}<ArrowRight className="flip-rtl" /></button>}
              {step === 4 && p.draft && <Link className="sdr-btn primary" href={`/outreach/${p.draft.id}`}>{w.finish}<ArrowRight className="flip-rtl" /></Link>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
