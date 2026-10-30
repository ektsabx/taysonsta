"use client";

import { IdealCustomerFields, customerFromAnalysis, customerPayload, emptyCustomer, toCustomerForm, type CustomerForm } from "./ProfilesView";
import { useEffect, useRef, useState } from "react";
import { Check, Globe, Info, LoaderCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { deleteKnowledgeItem, discoverCompetitorsAction, saveCompetitor, saveKnowledge, saveOffer, saveProfile } from "@/app/(app)/ai/actions";
import { updateOrganization } from "@/app/(app)/settings/actions";
import { fmt } from "@/lib/i18n/config";
import type { WebsiteAnalysis } from "@/lib/website-analysis";
import type { AnalysisStreamEvent } from "@/app/api/website-analysis/route";
import { CompanyProfileForm, type CompanyProfileValues } from "../CompanyProfileForm";
import { useRun } from "./bits";
import type { BusinessOfferRow, CompetitorRow, CustomerProfileRow, WorkspaceKnowledgeRow } from "@/types/database";

const SECTIONS = ["about", "value_proposition", "services", "products", "pricing", "differentiators", "case_studies", "faqs", "contact", "reply_policy"] as const;
const OFFER_FIELDS = ["description", "problem", "audience", "benefits", "price", "terms"] as const;
const COMPETITOR_FIELDS = ["website", "description", "strengths", "weaknesses", "differences", "notes"] as const;

export function KnowledgeView({ manage, profile, knowledge, offers, competitors, customer: initialCustomer }: {
  manage: boolean; profile: CompanyProfileValues; knowledge: WorkspaceKnowledgeRow | null; offers: BusinessOfferRow[]; competitors: CompetitorRow[];
  /** The ideal customer (the workspace's default Customer Profile). */
  customer: CustomerProfileRow | null;
}) {
  const { t } = useI18n();
  const k = t.ws.ai.knowledge;
  const { run, pending } = useRun();
  const [form, setForm] = useState(Object.fromEntries(SECTIONS.map((s) => [s, knowledge?.[s] ?? ""])) as Record<(typeof SECTIONS)[number], string>);
  const [basics, setBasics] = useState(profile);
  const [basicsKey, setBasicsKey] = useState(0);
  const [analysis, setAnalysis] = useState<WebsiteAnalysis | null>(null);
  const [customer, setCustomer] = useState<CustomerForm>(() => (initialCustomer ? toCustomerForm(initialCustomer) : { ...emptyCustomer, name: t.ws.ai.profiles.defaultName }));

  // Analyze website (D-232): what the site supports fills the fields; the rest stays as it was.
  const applyAnalysis = (a: WebsiteAnalysis) => {
    setAnalysis(a);
    const next = { ...basics, website: a.url };
    for (const [key, v] of Object.entries(a.profile)) if (v) (next as Record<string, string>)[key] = v;
    setBasics(next);
    setBasicsKey((n) => n + 1);
    setForm((cur) => {
      const f = { ...cur };
      for (const [key, v] of Object.entries(a.knowledge)) if (v && key in f) f[key as (typeof SECTIONS)[number]] = v;
      return f;
    });
    setCustomer((cur) => customerFromAnalysis(cur, a.customer));
  };

  return (
    <>
      {!manage && <div className="ws-note"><Info /><span>{t.ws.common.onlyManagers}</span></div>}
      {manage && <AnalyzeWebsite initialUrl={basics.website} onResult={applyAnalysis} />}
      {analysis && (
        <div className="ws-card analyze-result" role="status">
          <p>{fmt(k.analyze.done, { count: analysis.pages.length })}</p>
          {analysis.notFound.length ? <p className="ws-muted">{k.analyze.notFound} {analysis.notFound.map((f) => (f in k.fields ? k.fields[f as keyof typeof k.fields] : fieldLabel(t, f))).join(", ")}</p> : null}
          <p className="ws-muted">{k.analyze.reviewThenSave}</p>
        </div>
      )}
      <section className="ws-section">
        <div className="ws-section-head"><h3>{k.basics}</h3></div>
        <div className="ws-card"><CompanyProfileForm key={basicsKey} initial={basics} manage={manage} onChange={setBasics} /></div>
      </section>

      <section className="ws-section">
        <div className="ws-section-head"><h3>{k.sections}</h3></div>
        <div className="ws-card ws-form">
          <div className="ws-grid-2">
            {SECTIONS.map((s) => (
              <div key={s} className="ws-field">
                <label className="ws-label" htmlFor={`kn-${s}`}>{k.fields[s]}</label>
                <p className="ws-hint">{k.hints[s]}</p>
                <textarea id={`kn-${s}`} className="form-input" rows={4} disabled={!manage} value={form[s]} maxLength={s === "case_studies" || s === "faqs" ? 6000 : 4000} onChange={(e) => setForm({ ...form, [s]: e.target.value })} dir="auto" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ws-section">
        <div className="ws-section-head"><h3>{t.ws.ai.profiles.title}</h3></div>
        {/* The one-line description lives with the rest of the ideal customer, not in the company basics (D-269). */}
        <div className="ws-card ws-form" style={{ marginBottom: 12 }}>
          <div className="ws-field">
            <label className="ws-label" htmlFor="kn-ideal">{t.settings.organization.idealCustomer}</label>
            <p className="ws-hint">{t.settings.organization.idealCustomerDesc}</p>
            <textarea id="kn-ideal" className="form-input" rows={3} maxLength={2000} disabled={!manage} value={basics.ideal_customer} onChange={(e) => setBasics({ ...basics, ideal_customer: e.target.value })} dir="auto" />
          </div>
        </div>
        <IdealCustomerFields form={customer} onChange={setCustomer} manage={manage} />
      </section>

      <ItemSection
        title={k.offers} empty={k.offer.empty} addLabel={k.offer.add} manage={manage}
        items={offers.map((o) => ({ id: o.id, name: o.name, sub: [o.price, o.active ? null : "-"].filter(Boolean).join(" · "), values: o as unknown as Record<string, string | boolean | null> }))}
        fields={OFFER_FIELDS.map((f) => ({ key: f, label: k.offer[f], long: f !== "price" }))}
        nameLabel={k.offer.name} activeLabel={k.offer.active}
        onSave={(v) => saveOffer(v as Parameters<typeof saveOffer>[0])}
        onDelete={(id) => deleteKnowledgeItem("offer", id)}
      />

      <ItemSection
        title={k.competitors} empty={k.competitor.empty} addLabel={k.competitor.add} manage={manage}
        action={manage ? <FindCompetitors /> : null}
        items={competitors.map((c) => ({
          id: c.id, name: c.name, sub: c.website ?? "", values: c as unknown as Record<string, string | boolean | null>,
          // Found by Yolias AI (D-251): direct / indirect, how sure, and the source.
          badges: c.source === "ai_research" ? [c.kind === "direct" ? k.competitor.direct : k.competitor.indirect, c.confidence === "high" ? k.competitor.high : k.competitor.medium] : [],
          link: c.source === "ai_research" && c.source_url ? { href: c.source_url, label: k.competitor.source } : null,
        }))}
        fields={COMPETITOR_FIELDS.map((f) => ({ key: f, label: k.competitor[f], long: f !== "website" }))}
        nameLabel={k.competitor.name}
        onSave={(v) => saveCompetitor(v as Parameters<typeof saveCompetitor>[0])}
        onDelete={(id) => deleteKnowledgeItem("competitor", id)}
      />

      {/* One page and one Save (owner, 2026-10-28 and 2026-10-30): the company basics, the knowledge
          sections and the ideal customer; offers and competitors save as you add them. */}
      {manage && (
        <div className="knowledge-save">
          <button className="btn-primary" type="button" disabled={pending} onClick={() => run(async () => {
            const a = await updateOrganization(basics);
            if (!a.ok) return a;
            const k2 = await saveKnowledge(form);
            if (!k2.ok) return k2;
            const c = await saveProfile(customerPayload(customer));
            if (c.ok) setCustomer((cur) => ({ ...cur, id: c.id }));
            return c;
          }, { success: t.ws.common.saved, onOk: () => setAnalysis(null) })}>{t.ws.common.save}</button>
        </div>
      )}
    </>
  );
}

type Values = Record<string, string | boolean | null>;

function ItemSection({ title, empty, addLabel, manage, note, action, items, fields, nameLabel, activeLabel, onSave, onDelete }: {
  title: string; empty: string; addLabel: string; manage: boolean; note?: string; action?: React.ReactNode;
  items: { id: string; name: string; sub: string; values: Values; badges?: string[]; link?: { href: string; label: string } | null }[];
  fields: { key: string; label: string; long: boolean }[]; nameLabel: string; activeLabel?: string;
  onSave: (v: Values) => Promise<{ ok: true } | { ok: false; error: string }>; onDelete: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const { t } = useI18n();
  const { run, pending } = useRun();
  const [editing, setEditing] = useState<Values | null>(null);
  const blank = (): Values => ({ name: "", ...Object.fromEntries(fields.map((f) => [f.key, ""])), ...(activeLabel ? { active: true } : {}) });
  return (
    <section className="ws-section">
      <div className="ws-section-head">
        <h3>{title}</h3>
        {manage && !editing && <span className="ws-inline">{action}<button className="btn-secondary ws-btn-sm" type="button" onClick={() => setEditing(blank())}><Plus size={13} /> {addLabel}</button></span>}
      </div>
      {note && <div className="ws-note"><Info /><span>{note}</span></div>}
      {editing && (
        <div className="ws-card ws-form" style={{ marginBottom: 12 }}>
          <div className="ws-field"><label className="ws-label" htmlFor={`it-name-${title}`}>{nameLabel}</label><input id={`it-name-${title}`} className="form-input" maxLength={160} value={String(editing.name ?? "")} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
          <div className="ws-grid-2">
            {fields.map((f) => (
              <div key={f.key} className="ws-field">
                <label className="ws-label" htmlFor={`it-${title}-${f.key}`}>{f.label}</label>
                {f.long
                  ? <textarea id={`it-${title}-${f.key}`} className="form-input" rows={3} value={String(editing[f.key] ?? "")} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} dir="auto" />
                  : <input id={`it-${title}-${f.key}`} className="form-input" value={String(editing[f.key] ?? "")} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />}
              </div>
            ))}
          </div>
          {activeLabel && <label className="ws-check"><input type="checkbox" checked={editing.active !== false} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> {activeLabel}</label>}
          <div className="ws-actions">
            <button className="btn-secondary" type="button" onClick={() => setEditing(null)}>{t.ws.common.cancel}</button>
            <button className="btn-primary" type="button" disabled={pending || !String(editing.name ?? "").trim()} onClick={() => {
              const v = Object.fromEntries(Object.entries(editing).filter(([key]) => key === "id" || key === "name" || key === "active" || fields.some((f) => f.key === key)).map(([key, val]) => [key, val ?? ""]));
              run(() => onSave(v), { success: t.ws.common.saved, onOk: () => setEditing(null) });
            }}>{t.ws.common.save}</button>
          </div>
        </div>
      )}
      {!items.length && !editing ? <div className="ws-empty">{empty}</div> : (
        <div className="ws-card ws-list">
          {items.map((it) => (
            <div key={it.id} className="ws-list-row">
              <div>
                <strong>{it.name}</strong>
                {it.sub && <span className="cell-sub">{it.sub}</span>}
                {(it.badges?.length || it.link) ? <span className="ws-inline">{it.badges?.map((b) => <span key={b} className="ws-chip">{b}</span>)}{it.link && <a className="cell-sub" href={it.link.href} target="_blank" rel="noopener noreferrer">{it.link.label}</a>}</span> : null}
                {fields.filter((f) => f.long && it.values[f.key]).slice(0, 2).map((f) => <span key={f.key} className="cell-sub">{f.label}: {String(it.values[f.key]).slice(0, 160)}</span>)}
              </div>
              {manage && (
                <span className="ws-inline">
                  <button className="ws-icon-btn" type="button" aria-label={t.ws.common.edit} title={t.ws.common.edit} onClick={() => setEditing({ ...it.values })}><Pencil /></button>
                  <button className="ws-icon-btn" type="button" aria-label={t.ws.common.delete} title={t.ws.common.delete} disabled={pending} onClick={() => { if (confirm(t.ws.common.confirmDelete)) run(() => onDelete(it.id)); }}><Trash2 /></button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type Dict = ReturnType<typeof useI18n>["t"];
function fieldLabel(t: Dict, f: string): string {
  const o = t.settings.organization;
  return ({ name: o.name, industry: o.industry, offering: o.offering, ideal_customer: o.idealCustomer, target_markets: o.targetMarkets } as Record<string, string>)[f] ?? f;
}

type Step = "open" | "pages" | "extract" | "result";
const STEPS: Step[] = ["open", "pages", "extract", "result"];
interface Run { step: Step; read: number; total: number; pages: { url: string; ok: boolean }[] }

/**
 * The website box at the top of Company Knowledge (also used in onboarding).
 * While it runs it shows what is really happening (owner brief 2026-10-20):
 * each step lights up when the server reports it, the pages count up as they
 * are read (the only step with a real total, so the only bar), and the page
 * addresses appear as they come in. No step is shown before it happens.
 */
export function AnalyzeWebsite({ initialUrl, onResult, compact = false, context = "knowledge", url: controlled, onUrl }: {
  initialUrl: string; onResult: (a: WebsiteAnalysis) => void; compact?: boolean;
  /** Who is asking: Company Knowledge / Customer Profiles, or onboarding (checked again on the server). */
  context?: "knowledge" | "onboarding";
  /** Controlled address (onboarding uses its own website field). */
  url?: string; onUrl?: (v: string) => void;
}) {
  const { t } = useI18n();
  const a = t.ws.ai.knowledge.analyze;
  const [own, setOwn] = useState(initialUrl);
  const url = controlled ?? own;
  const setUrl = onUrl ?? setOwn;
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const busy = useRef<AbortController | null>(null);
  // Leaving the page stops reading the answer; nothing restarts on its own.
  useEffect(() => () => busy.current?.abort(), []);

  const go = async () => {
    if (busy.current || !url.trim()) return; // one analysis at a time
    const ctrl = new AbortController();
    busy.current = ctrl;
    setError(null);
    setRun({ step: "open", read: 0, total: 0, pages: [] });
    try {
      const res = await fetch("/api/website-analysis", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, context }), signal: ctrl.signal });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error && j.error.length > 12 ? j.error : a.errors.failed);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as AnalysisStreamEvent;
          if (e.type === "progress") {
            setRun((r) => {
              const cur = r ?? { step: "open" as Step, read: 0, total: 0, pages: [] };
              if (e.stage === "pages") return { ...cur, step: "pages", total: e.total };
              if (e.stage === "page") return { ...cur, step: "pages", read: e.read, total: e.total, pages: [...cur.pages, { url: e.url, ok: e.ok }] };
              return { ...cur, step: e.stage };
            });
          } else if (e.type === "done") {
            finished = true;
            setRun(null);
            onResult(e.data);
          } else {
            finished = true;
            setRun(null);
            setError(e.error);
          }
        }
      }
      if (!finished) throw new Error(a.errors.failed);
    } catch (e) {
      setRun(null);
      if (!ctrl.signal.aborted) setError(e instanceof TypeError ? t.feedback.errors.network : e instanceof Error ? e.message : a.errors.failed);
    } finally {
      busy.current = null;
    }
  };

  const pending = run !== null;
  const at = run ? STEPS.indexOf(run.step) : -1;
  return (
    <div className={compact ? "analyze-box compact" : "ws-card analyze-box"}>
      {!compact && <div><h3 className="ws-label">{a.title}</h3><p className="ws-hint">{a.lead}</p></div>}
      <div className="analyze-row">
        {controlled === undefined && <input className="form-input" dir="ltr" aria-label={a.url} placeholder="yourcompany.com" value={url} maxLength={200} disabled={pending} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void go(); } }} />}
        {pending
          ? <button className="btn-secondary" type="button" onClick={() => busy.current?.abort()}><X size={14} /> {a.stop}</button>
          : <button className="btn-secondary" type="button" disabled={!url.trim()} onClick={() => void go()}><Globe size={14} /> {error ? a.retry : a.run}</button>}
      </div>
      {run && (
        <ol className="analyze-steps" aria-live="polite">
          {STEPS.map((s, i) => {
            const state = i < at ? "done" : i === at ? "current" : "todo";
            if (state === "todo") return null; // only steps that have started are shown
            return (
              <li key={s} className={`analyze-step ${state}`}>
                <span className="analyze-step-icon" aria-hidden="true">{state === "done" ? <Check size={13} /> : <LoaderCircle className="spin" size={13} />}</span>
                <span className="analyze-step-text">
                  {a.steps[s]}
                  {s === "pages" && run.total > 0 && <span className="analyze-step-count">{fmt(a.pagesCount, { read: run.read, total: run.total })}</span>}
                </span>
                {s === "pages" && run.total > 0 && (
                  <span className="analyze-bar" role="progressbar" aria-valuemin={0} aria-valuemax={run.total} aria-valuenow={run.read} aria-label={a.steps.pages}>
                    <span style={{ width: `${(run.read / run.total) * 100}%` }} />
                  </span>
                )}
                {s === "pages" && run.pages.length > 0 && (
                  <ul className="analyze-pages">
                    {run.pages.map((p) => <li key={p.url} className={p.ok ? "" : "missed"} dir="ltr">{pathOf(p.url)}{p.ok ? "" : <span dir="auto"> · {a.pageMissed}</span>}</li>)}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

function pathOf(u: string): string {
  try { const x = new URL(u); return `${x.hostname.replace(/^www\./, "")}${x.pathname === "/" ? "" : x.pathname}`; } catch { return u; }
}

/** Yolias AI finds the company's real competitors (D-251); new ones are added to the list. */
function FindCompetitors() {
  const { t } = useI18n();
  const k = t.ws.ai.knowledge.competitor;
  const { run, pending } = useRun();
  const [note, setNote] = useState<string | null>(null);
  return (
    <>
      <button className="btn-secondary ws-btn-sm" type="button" disabled={pending} onClick={() => {
        setNote(null);
        run(async () => {
          const r = await discoverCompetitorsAction();
          if (r.ok) setNote(fmt(k.foundAdded, { count: r.added ?? 0 }));
          return r;
        });
      }}>{pending ? <LoaderCircle size={13} className="spin" /> : <Search size={13} />} {pending ? k.finding : k.find}</button>
      {note && <span className="cell-sub" role="status">{note}</span>}
    </>
  );
}
