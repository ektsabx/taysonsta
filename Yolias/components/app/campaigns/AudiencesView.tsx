"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus, Sparkles, Target, Users, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { countryLabel, formatDate, formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { ImportCsvButton } from "@/components/app/ImportCsvButton";
import type { Lookalike } from "@/lib/campaigns/audience";
import type { Targeting } from "@/lib/campaigns/targeting";
import { analyzeLookalike, createCustom, createLookalike, deleteAudience, previewCustom, refreshAudience, renameAudience, saveAudience } from "@/app/(app)/audiences/actions";
import { TargetingEditor, targetingSummary } from "./TargetingEditor";

// Audiences (owner, 2026-10-31, D-273): one table of every audience (custom,
// lookalike, saved targeting) with its size, where it comes from, how sure a
// lookalike is and how many campaigns use it; "Create audience" opens the
// form for each kind. Building an audience never contacts anyone.

export interface AudienceItem {
  id: string; name: string; kind: "saved" | "custom" | "lookalike"; targeting: Targeting; origin: Record<string, unknown>; members: number; updated_at: string;
  expansion: number | null; seed_size: number | null; confidence: "low" | "medium" | "high" | null; used: number;
}

type Kind = "custom" | "lookalike" | "saved";
type CustomSourceUi = "previous_campaign" | "customers" | "meetings" | "interested" | "file";

export function AudiencesView({ audiences, campaigns, importAvailable }: { audiences: AudienceItem[]; campaigns: { id: string; name: string }[]; importAvailable: number }) {
  const { t, locale } = useI18n();
  const A = t.ag.aud;
  const lang = locale === "ar" ? "ar" : "en";
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"all" | Kind>("all");
  const [creating, setCreating] = useState<Kind | null>(null);
  const [chooser, setChooser] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<AudienceItem | null>(null);
  const n = (v: number) => formatNumber(v, locale);
  const run = <R extends { ok: boolean; message?: string }>(fn: () => Promise<R>, after?: (r: R) => void) => start(async () => {
    const r = await callAction(fn);
    if (isNetworkFailure(r)) { toast(t.feedback.errors.network, "error"); return; }
    if (!r.ok) { toast((r as unknown as { error: string }).error, "error"); return; }
    if (r.message) toast(r.message);
    after?.(r);
    router.refresh();
  });
  const shown = audiences.filter((a) => tab === "all" || a.kind === tab);
  const sourceOf = (a: AudienceItem) => {
    const o = a.origin as { source?: string; base?: string; campaign_id?: string; file?: string };
    if (a.kind === "custom") return o.source === "file" ? `${A.custom.sources.file}${o.file ? ` · ${o.file}` : ""}` : `${A.custom.sources[(o.source ?? "customers") as CustomSourceUi] ?? o.source}${o.campaign_id ? ` · ${campaigns.find((c) => c.id === o.campaign_id)?.name ?? ""}` : ""}`;
    if (a.kind === "lookalike") return `${A.lookalike.base} ${A.lookalike.bases[(o.base ?? "customers") as keyof typeof A.lookalike.bases]}${a.expansion ? ` · ${a.expansion}/10` : ""}`;
    return targetingSummary(a.targeting, lang, (c) => countryLabel(c, lang)).slice(0, 2).join(" · ") || "–";
  };

  return (
    <div>
      <div className="aud-bar">
        <div className="sdr-seg" role="tablist">
          {(["all", "custom", "lookalike", "saved"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
              {A.tabs[k]} <span className="n">{n(k === "all" ? audiences.length : audiences.filter((a) => a.kind === k).length)}</span>
            </button>
          ))}
        </div>
        <div className="aud-create">
          <button type="button" className="sdr-btn primary" aria-expanded={chooser} onClick={() => setChooser((v) => !v)}><Plus />{A.create}</button>
          {chooser && (
            <div className="sdr-menu-panel aud-chooser" role="menu">
              {(["custom", "lookalike", "saved"] as const).map((k) => (
                <button key={k} type="button" role="menuitem" onClick={() => { setChooser(false); setCreating(k); }}>
                  {k === "custom" ? <Users /> : k === "lookalike" ? <Sparkles /> : <Target />}
                  <span><strong>{A.kinds[k]}</strong><small>{A.kindDesc[k]}</small></span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!audiences.length ? (
        <div className="aud-empty"><Users /><h3>{A.empty}</h3><p>{A.emptyLine}</p></div>
      ) : (
        <div className="sdr-table-wrap">
          <table className="sdr-table aud-table">
            <thead><tr><th>{A.colName}</th><th>{A.colType}</th><th>{A.colSize}</th><th>{A.colSource}</th><th>{A.colConfidence}</th><th>{A.colUsed}</th><th>{A.colUpdated}</th><th aria-label={A.edit} /></tr></thead>
            <tbody>
              {shown.map((a) => (
                <tr key={a.id}>
                  <td><span className="sdr-cell-main" dir="auto">{a.name}</span></td>
                  <td><span className={`sdr-badge nodot ${a.kind === "lookalike" ? "purple" : a.kind === "custom" ? "blue" : "gray"}`}>{A.kinds[a.kind]}</span></td>
                  <td className="num">{a.kind === "custom" ? fmt(A.size, { n: n(a.members) }) : a.kind === "lookalike" ? fmt(A.sizeLookalike, { n: n(a.seed_size ?? 0) }) : A.sizeSaved}</td>
                  <td className="aud-source" dir="auto">{sourceOf(a)}</td>
                  <td>{a.kind === "lookalike" && a.confidence ? <span className={`sdr-badge ${a.confidence === "high" ? "green" : a.confidence === "medium" ? "amber" : "gray"}`} title={A.lookalike.confidence[a.confidence]}>{A.lookalike.confidence[a.confidence].split(":")[0]}</span> : "–"}</td>
                  <td className="num">{a.used ? fmt(A.used, { n: n(a.used) }) : "–"}</td>
                  <td>{formatDate(a.updated_at, locale)}</td>
                  <td className="num">
                    <div className="sdr-menu">
                      <button type="button" className="sdr-icon-btn" aria-label={A.edit} aria-expanded={menu === a.id} onClick={() => setMenu(menu === a.id ? null : a.id)}><MoreHorizontal /></button>
                      {menu === a.id && (
                        <div className="sdr-menu-panel" role="menu" onMouseLeave={() => setMenu(null)}>
                          <Link role="menuitem" href="/campaigns/new">{A.use}</Link>
                          <button type="button" role="menuitem" onClick={() => { setMenu(null); setEditing(a); }}>{a.kind === "saved" ? A.edit : A.rename}</button>
                          {a.kind !== "saved" && (a.origin as { source?: string }).source !== "file" && <button type="button" role="menuitem" disabled={pending} onClick={() => { setMenu(null); run(() => refreshAudience(a.id)); }}>{A.refresh}</button>}
                          <hr />
                          <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(null); if (window.confirm(A.deleteConfirm)) run(() => deleteAudience(a.id)); }}>{A.delete}</button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating === "custom" && <CustomForm campaigns={campaigns} importAvailable={importAvailable} onClose={() => setCreating(null)} run={run} pending={pending} />}
      {creating === "lookalike" && <LookalikeForm audiences={audiences.filter((a) => a.kind === "custom")} onClose={() => setCreating(null)} run={run} pending={pending} />}
      {(creating === "saved" || editing?.kind === "saved") && (
        <SavedForm initial={editing?.kind === "saved" ? editing : null} onClose={() => { setCreating(null); setEditing(null); }} run={run} pending={pending} />
      )}
      {editing && editing.kind !== "saved" && (
        <Dialog title={A.rename} onClose={() => setEditing(null)}>
          <RenameForm a={editing} onDone={() => setEditing(null)} run={run} pending={pending} />
        </Dialog>
      )}
    </div>
  );
}

type Run = <R extends { ok: boolean; message?: string }>(fn: () => Promise<R>, after?: (r: R) => void) => void;

function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="sdr-dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sdr-dialog${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sdr-dialog-head"><h4>{title}</h4><button type="button" className="sdr-icon-btn" aria-label={t.common.close} onClick={onClose}><X /></button></div>
        <div className="sdr-dialog-body">{children}</div>
      </div>
    </div>
  );
}

function RenameForm({ a, onDone, run, pending }: { a: AudienceItem; onDone: () => void; run: Run; pending: boolean }) {
  const { t } = useI18n();
  const [name, setName] = useState(a.name);
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => renameAudience(a.id, name), onDone); }}>
      <label className="ws-field"><span className="ws-label">{t.ag.aud.name}</span><input className="form-input" dir="auto" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="sdr-foot"><button type="submit" className="sdr-btn primary" disabled={pending || !name.trim()}>{t.ag.aud.save}</button></div>
    </form>
  );
}

function CustomForm({ campaigns, importAvailable, onClose, run, pending }: { campaigns: { id: string; name: string }[]; importAvailable: number; onClose: () => void; run: Run; pending: boolean }) {
  const { t, locale } = useI18n();
  const C = t.ag.aud.custom;
  const [name, setName] = useState("");
  const [source, setSource] = useState<CustomSourceUi>("customers");
  const [campaignId, setCampaignId] = useState<string>("");
  const [preview, setPreview] = useState<{ total: number; withEmail: number; doNotContact: number } | null>(null);
  const n = (v: number) => formatNumber(v, locale);
  return (
    <Dialog title={t.ag.aud.kinds.custom} onClose={onClose}>
      <label className="ws-field"><span className="ws-label">{t.ag.aud.name}</span><input className="form-input" dir="auto" maxLength={120} placeholder={t.ag.aud.namePh} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="ws-field">
        <span className="ws-label">{C.source}</span>
        <div className="aud-sources">
          {(["customers", "meetings", "interested", "previous_campaign", "file"] as const).map((k) => (
            <label key={k} className={`aud-source-opt${source === k ? " on" : ""}`}><input type="radio" name="aud-source" checked={source === k} onChange={() => { setSource(k); setPreview(null); }} />{C.sources[k]}</label>
          ))}
        </div>
      </div>
      {source === "previous_campaign" && (
        <select className="form-input" value={campaignId} aria-label={C.pickCampaign} onChange={(e) => { setCampaignId(e.target.value); setPreview(null); }}>
          <option value="">{C.pickCampaign}</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      {source === "file" ? (
        <ImportCsvButton available={importAvailable} primary label={C.file} />
      ) : (
        <>
          {preview && <p className="ws-hint">{fmt(C.previewLine, { total: n(preview.total), withEmail: n(preview.withEmail), dnc: n(preview.doNotContact) })}</p>}
          <div className="sdr-foot">
            <button type="button" className="sdr-btn" disabled={pending || (source === "previous_campaign" && !campaignId)} onClick={() => run(() => previewCustom(source, campaignId || null), (r) => setPreview(r as unknown as { total: number; withEmail: number; doNotContact: number }))}>{C.preview}</button>
            <button type="button" className="sdr-btn primary" disabled={pending || !name.trim() || (source === "previous_campaign" && !campaignId)} onClick={() => run(() => createCustom({ name, source, campaignId: campaignId || null }), onClose)}>{C.build}</button>
          </div>
        </>
      )}
    </Dialog>
  );
}

function LookalikeForm({ audiences, onClose, run, pending }: { audiences: AudienceItem[]; onClose: () => void; run: Run; pending: boolean }) {
  const { t, locale } = useI18n();
  const L = t.ag.aud.lookalike;
  const lang = locale === "ar" ? "ar" : "en";
  const [name, setName] = useState("");
  const [base, setBase] = useState<"customers" | "meetings" | "interested" | "audience">("customers");
  const [audienceId, setAudienceId] = useState("");
  const [expansion, setExpansion] = useState(3);
  const [result, setResult] = useState<Lookalike | null>(null);
  const n = (v: number) => formatNumber(v, locale);
  const fieldLabel = { industries: t.ag.builder.audience.companies, countries: t.ag.builder.location.countries, titles: t.ag.builder.audience.people, sizes: t.ag.builder.audience.companies };
  const value = (f: string, v: string) => (f === "countries" ? countryLabel(v, lang) : v);
  return (
    <Dialog title={t.ag.aud.kinds.lookalike} onClose={onClose} wide>
      <label className="ws-field"><span className="ws-label">{t.ag.aud.name}</span><input className="form-input" dir="auto" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="ws-field">
        <span className="ws-label">{L.base}</span>
        <div className="aud-sources">
          {(["customers", "meetings", "interested", "audience"] as const).map((k) => (
            <label key={k} className={`aud-source-opt${base === k ? " on" : ""}`}><input type="radio" name="look-base" checked={base === k} onChange={() => { setBase(k); setResult(null); }} />{L.bases[k]}</label>
          ))}
        </div>
        {base === "audience" && (
          <select className="form-input" value={audienceId} onChange={(e) => { setAudienceId(e.target.value); setResult(null); }}>
            <option value="">{t.ag.builder.audience.pick}</option>
            {audiences.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>
      <div className="ws-field">
        <span className="ws-label">{L.expansion}: {expansion}/10</span>
        <div className="aud-range"><span>{L.closest}</span><input type="range" min={1} max={10} value={expansion} onChange={(e) => { setExpansion(Number(e.target.value)); setResult(null); }} aria-label={L.expansion} /><span>{L.broader}</span></div>
        <p className="ws-hint">{L.expansionHint}</p>
      </div>
      <button type="button" className="sdr-btn" disabled={pending || (base === "audience" && !audienceId)} onClick={() => run(() => analyzeLookalike({ base, audienceId: audienceId || null, expansion }), (r) => setResult((r as unknown as { lookalike: Lookalike }).lookalike))}>
        {pending ? L.analyzing : L.analyze}
      </button>
      {result && (
        <div className="aud-result">
          {result.seedSize ? (
            <>
              <p><strong>{fmt(L.seed, { n: n(result.seedSize) })}</strong> <span className={`sdr-badge ${result.confidence === "high" ? "green" : result.confidence === "medium" ? "amber" : "gray"}`}>{L.confidence[result.confidence]}</span></p>
              {result.traits.length > 0 && (
                <>
                  <span className="ws-label">{L.traits}</span>
                  <ul className="aud-traits">{result.traits.map((x) => <li key={`${x.field}:${x.value}`}><span>{fieldLabel[x.field]}</span><strong dir="auto">{value(x.field, x.value)}</strong><small>{fmt(L.share, { pct: `${Math.round(x.share * 100)}%` })}</small></li>)}</ul>
                </>
              )}
              {result.seeds.length > 0 && <p className="ws-hint"><strong>{L.seeds}:</strong> <span dir="auto">{result.seeds.slice(0, 8).join(", ")}{result.seeds.length > 8 ? "…" : ""}</span></p>}
              <p className="ws-hint">{L.note}</p>
            </>
          ) : <p className="ws-hint">{L.empty}</p>}
        </div>
      )}
      <div className="sdr-foot">
        <button type="button" className="sdr-btn primary" disabled={pending || !name.trim() || !result?.seedSize} onClick={() => run(() => createLookalike({ name, base, audienceId: audienceId || null, expansion }), onClose)}>{L.create}</button>
      </div>
    </Dialog>
  );
}

function SavedForm({ initial, onClose, run, pending }: { initial: AudienceItem | null; onClose: () => void; run: Run; pending: boolean }) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? "");
  const [tg, setTg] = useState<Targeting>(initial?.targeting ?? {});
  return (
    <Dialog title={t.ag.aud.kinds.saved} onClose={onClose} wide>
      <label className="ws-field"><span className="ws-label">{t.ag.aud.name}</span><input className="form-input" dir="auto" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <TargetingEditor value={tg} onChange={setTg} />
      <div className="sdr-foot">
        <button type="button" className="sdr-btn primary" disabled={pending || !name.trim()} onClick={() => run(() => saveAudience({ id: initial?.id, kind: "saved", name, targeting: tg as never }), onClose)}>{t.ag.aud.saved.create}</button>
      </div>
    </Dialog>
  );
}
