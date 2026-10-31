"use client";

import { useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { countryLabel, formatNumber } from "@/lib/format";
import { useRun } from "@/components/app/ws/bits";
import { CUSTOM_SOURCES, type CustomSource } from "@/lib/campaigns/audience-sources";
import { deleteAudience, previewCustom, refreshAudience, saveAudience } from "@/app/(app)/prospects/audiences/actions";
import { targetingSummary } from "./TargetingEditor";
import type { Targeting } from "@/lib/campaigns/targeting";

// Audiences (D-272): saved targeting (made in the campaign wizard) and custom
// lists built from people the workspace already has, with a preview first.

interface Aud { id: string; name: string; kind: "saved" | "custom" | "lookalike"; targeting: Targeting; origin: unknown; members: number; updated_at: string }

export function AudiencesView({ audiences, campaigns }: { audiences: Aud[]; campaigns: { id: string; name: string }[] }) {
  const { t, locale } = useI18n();
  const a = t.camp.aud;
  const lang = locale === "ar" ? "ar" : "en";
  const { run, pending } = useRun();
  const [name, setName] = useState("");
  const [source, setSource] = useState<CustomSource>("customers");
  const [campaignId, setCampaignId] = useState("");
  const [preview, setPreview] = useState<{ total: number; withEmail: number; doNotContact: number } | null>(null);
  const n = (v: number) => formatNumber(v, locale);
  const date = (iso: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-US", { dateStyle: "medium" }).format(new Date(iso));
  const row = (x: Aud, detail: React.ReactNode) => (
    <li key={x.id} className="aud-row">
      <div><strong dir="auto">{x.name}</strong>{detail}<small>{fmt(a.updated, { date: date(x.updated_at) })}</small></div>
      <span>
        {x.kind === "custom" && <button type="button" className="sdr-icon-btn" aria-label={a.refresh} title={a.refresh} disabled={pending} onClick={() => run(() => refreshAudience(x.id))}><RefreshCw /></button>}
        <button type="button" className="sdr-icon-btn" aria-label={a.delete} title={a.delete} disabled={pending} onClick={() => { if (confirm(a.deleteConfirm)) run(() => deleteAudience(x.id)); }}><Trash2 /></button>
      </span>
    </li>
  );
  return (
    <div className="aud">
      <section className="sdr-panel"><div className="sdr-panel-body pad aud-new">
        <div className="sdr-panel-title">{a.newCustom}</div>
        <div className="ws-grid-2">
          <label className="ws-field"><span className="ws-label">{a.name}</span><input className="form-input" dir="auto" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="ws-field"><span className="ws-label">{a.source}</span><select className="form-input" value={source} onChange={(e) => { setSource(e.target.value as CustomSource); setPreview(null); }}>{CUSTOM_SOURCES.map((s) => <option key={s} value={s}>{a.sources[s]}</option>)}</select></label>
        </div>
        {source === "previous_campaign" && <select className="form-input" value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setPreview(null); }}><option value="">–</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        {source === "imported" && <p className="ws-hint">{a.importHint}</p>}
        <div className="wz-row">
          <button type="button" className="sdr-btn" disabled={pending || (source === "previous_campaign" && !campaignId)} onClick={() => run(() => previewCustom(source, campaignId || null), { onOk: (r) => setPreview(r as never), refresh: false })}>{a.preview}</button>
          <button type="button" className="sdr-btn primary" disabled={pending || !name.trim() || !preview} onClick={() => run(() => saveAudience({ kind: "custom", name, source, campaignId: campaignId || null }), { onOk: () => { setName(""); setPreview(null); } })}>{a.build}</button>
        </div>
        {preview && <p className="ws-hint">{fmt(a.previewLine, { total: n(preview.total), withEmail: n(preview.withEmail), dnc: n(preview.doNotContact) })}</p>}
      </div></section>
      <section className="sdr-panel"><div className="sdr-panel-body pad">
        <div className="sdr-panel-title">{a.custom}</div>
        {audiences.some((x) => x.kind === "custom") ? <ul className="aud-list">{audiences.filter((x) => x.kind === "custom").map((x) => row(x, <span>{fmt(a.members, { n: n(x.members) })} · {a.sources[((x.origin as { source?: CustomSource } | null)?.source ?? "customers")]}</span>))}</ul> : <p className="ws-hint">{a.noCustom}</p>}
      </div></section>
      <section className="sdr-panel"><div className="sdr-panel-body pad">
        <div className="sdr-panel-title">{a.saved}</div>
        {audiences.some((x) => x.kind === "saved") ? <ul className="aud-list">{audiences.filter((x) => x.kind === "saved").map((x) => row(x, <span dir="auto">{targetingSummary(x.targeting, lang, (c) => countryLabel(c, locale)).join(" · ")}</span>))}</ul> : <p className="ws-hint">{a.noSaved}</p>}
      </div></section>
    </div>
  );
}
