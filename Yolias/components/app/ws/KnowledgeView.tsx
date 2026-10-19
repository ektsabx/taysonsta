"use client";

import { useState, useTransition } from "react";
import { Globe, Info, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { analyzeWebsiteAction, deleteKnowledgeItem, saveCompetitor, saveCustomerFromAnalysis, saveKnowledge, saveOffer } from "@/app/(app)/ai/actions";
import { updateOrganization } from "@/app/(app)/settings/actions";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { fmt } from "@/lib/i18n/config";
import type { WebsiteAnalysis } from "@/lib/website-analysis";
import { CompanyProfileForm, type CompanyProfileValues } from "../CompanyProfileForm";
import { useRun } from "./bits";
import type { BusinessOfferRow, CompetitorRow, WorkspaceKnowledgeRow } from "@/types/database";

const SECTIONS = ["about", "value_proposition", "services", "products", "pricing", "differentiators", "case_studies", "faqs", "contact", "reply_policy"] as const;
const OFFER_FIELDS = ["description", "problem", "audience", "benefits", "price", "terms"] as const;
const COMPETITOR_FIELDS = ["website", "description", "strengths", "weaknesses", "differences", "notes"] as const;

export function KnowledgeView({ manage, profile, knowledge, offers, competitors }: {
  manage: boolean; profile: CompanyProfileValues; knowledge: WorkspaceKnowledgeRow | null; offers: BusinessOfferRow[]; competitors: CompetitorRow[];
}) {
  const { t } = useI18n();
  const k = t.ws.ai.knowledge;
  const { run, pending } = useRun();
  const [form, setForm] = useState(Object.fromEntries(SECTIONS.map((s) => [s, knowledge?.[s] ?? ""])) as Record<(typeof SECTIONS)[number], string>);
  const [basics, setBasics] = useState(profile);
  const [basicsKey, setBasicsKey] = useState(0);
  const [analysis, setAnalysis] = useState<WebsiteAnalysis | null>(null);

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
  };

  return (
    <>
      {!manage && <div className="ws-note"><Info /><span>{t.ws.common.onlyManagers}</span></div>}
      {manage && <AnalyzeWebsite initialUrl={basics.website} onResult={applyAnalysis} />}
      {analysis && (
        <div className="ws-card analyze-result" role="status">
          <p>{fmt(k.analyze.done, { count: analysis.pages.length })}</p>
          {analysis.notFound.length ? <p className="ws-muted">{k.analyze.notFound} {analysis.notFound.map((f) => (f in k.fields ? k.fields[f as keyof typeof k.fields] : fieldLabel(t, f))).join(", ")}</p> : null}
          <div className="ws-actions">
            <button className="btn-primary" type="button" disabled={pending} onClick={() => run(async () => {
              const a = await updateOrganization(basics);
              if (!a.ok) return a;
              const k2 = await saveKnowledge(form);
              if (!k2.ok) return k2;
              // The analysis also writes the ideal customer into Customer Profiles (D-241).
              return saveCustomerFromAnalysis(analysis.customer);
            }, { success: t.ws.common.saved, onOk: () => setAnalysis(null) })}>{k.analyze.saveAll}</button>
          </div>
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
          {manage && <div className="ws-actions"><button className="btn-primary" type="button" disabled={pending} onClick={() => run(() => saveKnowledge(form), { success: t.ws.common.saved })}>{t.ws.common.save}</button></div>}
        </div>
      </section>

      <ItemSection
        title={k.offers} empty={k.offer.empty} addLabel={k.offer.add} manage={manage}
        items={offers.map((o) => ({ id: o.id, name: o.name, sub: [o.price, o.active ? null : "—"].filter(Boolean).join(" · "), values: o as unknown as Record<string, string | boolean | null> }))}
        fields={OFFER_FIELDS.map((f) => ({ key: f, label: k.offer[f], long: f !== "price" }))}
        nameLabel={k.offer.name} activeLabel={k.offer.active}
        onSave={(v) => saveOffer(v as Parameters<typeof saveOffer>[0])}
        onDelete={(id) => deleteKnowledgeItem("offer", id)}
      />

      <ItemSection
        title={k.competitors} empty={k.competitor.empty} addLabel={k.competitor.add} manage={manage} note={k.competitor.note}
        items={competitors.map((c) => ({ id: c.id, name: c.name, sub: c.website ?? "", values: c as unknown as Record<string, string | boolean | null> }))}
        fields={COMPETITOR_FIELDS.map((f) => ({ key: f, label: k.competitor[f], long: f !== "website" }))}
        nameLabel={k.competitor.name}
        onSave={(v) => saveCompetitor(v as Parameters<typeof saveCompetitor>[0])}
        onDelete={(id) => deleteKnowledgeItem("competitor", id)}
      />
    </>
  );
}

type Values = Record<string, string | boolean | null>;

function ItemSection({ title, empty, addLabel, manage, note, items, fields, nameLabel, activeLabel, onSave, onDelete }: {
  title: string; empty: string; addLabel: string; manage: boolean; note?: string;
  items: { id: string; name: string; sub: string; values: Values }[];
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
        {manage && !editing && <button className="btn-secondary ws-btn-sm" type="button" onClick={() => setEditing(blank())}><Plus size={13} /> {addLabel}</button>}
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

/** The website box at the top of Company Knowledge (also used in onboarding). */
export function AnalyzeWebsite({ initialUrl, onResult, compact = false, action = analyzeWebsiteAction, url: controlled, onUrl }: {
  initialUrl: string; onResult: (a: WebsiteAnalysis) => void; compact?: boolean; action?: (url: string) => Promise<{ ok: true; data: WebsiteAnalysis } | { ok: false; error: string }>;
  /** Controlled address (onboarding uses its own website field). */
  url?: string; onUrl?: (v: string) => void;
}) {
  const { t } = useI18n();
  const a = t.ws.ai.knowledge.analyze;
  const [own, setOwn] = useState(initialUrl);
  const url = controlled ?? own;
  const setUrl = onUrl ?? setOwn;
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const go = () => start(async () => {
    setError(null);
    const r = await callAction(() => action(url));
    if (isNetworkFailure(r)) return setError(t.feedback.errors.network);
    if (!r.ok) return setError(r.error);
    onResult(r.data);
  });
  return (
    <div className={compact ? "analyze-box compact" : "ws-card analyze-box"}>
      {!compact && <div><h3 className="ws-label">{a.title}</h3><p className="ws-hint">{a.lead}</p></div>}
      <div className="analyze-row">
        {controlled === undefined && <input className="form-input" dir="ltr" aria-label={a.url} placeholder="yourcompany.com" value={url} maxLength={200} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }} />}
        <button className="btn-secondary" type="button" disabled={pending || !url.trim()} onClick={go}>{pending ? <LoaderCircle className="spin" size={14} /> : <Globe size={14} />} {pending ? a.running : a.run}</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
