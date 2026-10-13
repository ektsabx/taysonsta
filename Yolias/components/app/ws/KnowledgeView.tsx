"use client";

import { useState } from "react";
import { Info, Pencil, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { deleteKnowledgeItem, saveCompetitor, saveKnowledge, saveOffer } from "@/app/(app)/ai/actions";
import { CompanyProfileForm, type CompanyProfileValues } from "../CompanyProfileForm";
import { useRun } from "./bits";
import type { BusinessOfferRow, CompetitorRow, WorkspaceKnowledgeRow } from "@/types/database";

const SECTIONS = ["about", "services", "products", "pricing", "differentiators", "case_studies", "faqs", "reply_policy"] as const;
const OFFER_FIELDS = ["description", "problem", "audience", "benefits", "price", "terms"] as const;
const COMPETITOR_FIELDS = ["website", "description", "strengths", "weaknesses", "differences", "notes"] as const;

export function KnowledgeView({ manage, profile, knowledge, offers, competitors }: {
  manage: boolean; profile: CompanyProfileValues; knowledge: WorkspaceKnowledgeRow | null; offers: BusinessOfferRow[]; competitors: CompetitorRow[];
}) {
  const { t } = useI18n();
  const k = t.ws.ai.knowledge;
  const { run, pending } = useRun();
  const [form, setForm] = useState(Object.fromEntries(SECTIONS.map((s) => [s, knowledge?.[s] ?? ""])) as Record<(typeof SECTIONS)[number], string>);

  return (
    <>
      {!manage && <div className="ws-note"><Info /><span>{t.ws.common.onlyManagers}</span></div>}
      <section className="ws-section">
        <div className="ws-section-head"><h3>{k.basics}</h3></div>
        <div className="ws-card"><CompanyProfileForm initial={profile} manage={manage} /></div>
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
