"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, AtSign, ChevronLeft, Clock, Gauge, Mail, MailCheck, MoreHorizontal, Plug, Search, SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { timeZoneChoices } from "@/lib/regions";
import { useToast } from "@/components/Toast";
import { GmailIcon } from "@/components/app/ConnectorIcons";
import { connectImapMailbox, connectTestMailbox, mailboxDomainChecks, mailboxState, removeMailbox, saveSendingRules, updateMailboxSending, type EmailState, type MailboxView } from "@/app/(app)/settings/mailbox-actions";
import type { SendingRules } from "@/lib/outreach/sending-rules";
import type { CheckState, DomainCheck } from "@/lib/mailbox/domain-check";
import { DEFAULT_SENDING_RULES } from "@/lib/outreach/sending-rules";

// Integrations → Email (D-256), after AgentSDR Settings → Email:
// Mailboxes (stats + the member's mailboxes with limits, hours and health),
// Connection (how mailboxes connect), Sending rules (the workspace defaults).


/** One integration card opened (D-268): a provider's mailboxes, or the sending rules shared by every mailbox. */
export type EmailCard = "gmail" | "imap" | "rules";

export function EmailSettings({ card, onBack, backLabel }: { card: EmailCard; onBack?: () => void; backLabel?: string }) {
  const { t } = useI18n();
  const it = t.settings.integration;
  const toast = useToast();
  const [state, setState] = useState<EmailState | null>(null);
  const [imapOpen, setImapOpen] = useState(false);
  const load = () => mailboxState().then(setState).catch(() => setState(null));
  useEffect(() => { void load(); }, []);

  return (
    <div>
      {onBack && <button type="button" className="integration-back" onClick={onBack}><ChevronLeft className="flip-rtl" />{backLabel}</button>}
      {card === "rules" ? <Rules state={state} reload={load} /> : <Mailboxes provider={card} state={state} reload={load} onImap={() => setImapOpen(true)} />}
      {imapOpen && <ImapDialog onClose={() => setImapOpen(false)} onConnected={() => { setImapOpen(false); toast(it.mailboxConnected); void load(); }} />}
    </div>
  );
}

/* ── helpers ── */

/** "Mon–Fri", "Sun, Tue, Thu", "Every day". */
export function daysLabel(days: number[], short: readonly string[], every: string, none: string, sep = ", "): string {
  const d = [...new Set(days)].sort();
  if (!d.length) return none;
  if (d.length === 7) return every;
  const runs: number[][] = [];
  for (const x of d) { const last = runs.at(-1); if (last && x === last.at(-1)! + 1) last.push(x); else runs.push([x]); }
  return runs.map((r) => (r.length >= 3 ? `${short.at(r[0])}–${short.at(r.at(-1)!)}` : r.map((x) => short.at(x)).join(sep))).join(sep);
}

const initials = (v: string) => v.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join("") || "?";

function Menu({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);
  return (
    <div className="sdr-menu" ref={ref}>
      <button type="button" className="sdr-icon-btn" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}><MoreHorizontal /></button>
      {open && <div className="sdr-menu-panel" role="menu">{children(() => setOpen(false))}</div>}
    </div>
  );
}

/* ── Mailboxes ── */

function Mailboxes({ provider, state, reload, onImap }: { provider: "gmail" | "imap"; state: EmailState | null; reload: () => void; onImap: () => void }) {
  const { t, locale } = useI18n();
  const a = t.sdr.email.accounts;
  const [filter, setFilter] = useState<"all" | "healthy" | "attention">("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<MailboxView | null>(null);
  const [pending, start] = useTransition();
  // Only this card's mailboxes (the test mailbox of local development sits with IMAP).
  const boxes = (state?.mailboxes ?? []).filter((m) => m.status !== "disconnected" && (provider === "gmail" ? m.provider === "gmail" : m.provider !== "gmail"));
  const connected = boxes.filter((m) => m.status === "connected");
  const attention = boxes.filter((m) => m.status === "error");
  const sent = connected.reduce((n, m) => n + m.sentToday, 0);
  const capacity = connected.reduce((n, m) => n + m.dailyLimit, 0);
  const shown = boxes
    .filter((m) => filter === "all" || (filter === "healthy" ? m.status === "connected" : m.status === "error"))
    .filter((m) => !q || `${m.email} ${m.displayName ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const num = (n: number) => formatNumber(n, locale);

  return (
    <div>
      <div className="sdr-section-head">
        <div><h4>{a.title}</h4><p>{a.subtitle}</p></div>
        <AddMailbox provider={provider} state={state} reload={reload} onImap={onImap} />
      </div>
      <div className="sdr-stats" style={{ marginBottom: 20 }}>
        <div className="sdr-stat"><div className="sdr-stat-icon"><MailCheck /></div><div className="sdr-stat-label">{a.connected}</div><div className="sdr-stat-value">{num(connected.length)}</div><div className="sdr-stat-note">{fmt(a.connectedNote, { total: num(boxes.length) })}</div></div>
        <div className="sdr-stat"><div className="sdr-stat-icon"><AlertCircle /></div><div className="sdr-stat-label" title={a.attentionHint}>{a.attention}</div><div className="sdr-stat-value">{num(attention.length)}</div><div className="sdr-stat-note">{attention.length ? a.attentionSome : a.attentionNone}</div></div>
        <div className="sdr-stat"><div className="sdr-stat-icon"><Mail /></div><div className="sdr-stat-label">{a.sentToday}</div><div className="sdr-stat-value">{num(sent)}</div><div className="sdr-stat-note">{fmt(a.sentNote, { pct: capacity ? (Math.round((sent / capacity) * 1000) / 10).toString() : "0" })}</div></div>
        <div className="sdr-stat"><div className="sdr-stat-icon"><Gauge /></div><div className="sdr-stat-label" title={a.leftHint}>{a.leftToday}</div><div className="sdr-stat-value">{num(Math.max(capacity - sent, 0))}</div><div className="sdr-stat-note">{fmt(a.leftNote, { total: num(capacity) })}</div></div>
      </div>
      <div className="sdr-panel">
        <div className="sdr-panel-head">
          <div><div className="sdr-panel-title">{a.panelTitle}</div><div className="sdr-panel-sub">{a.panelSub}</div></div>
          <div className="sdr-panel-tools">
            <div className="sdr-seg" role="tablist">
              {([["all", a.all, boxes.length], ["healthy", a.healthy, connected.length], ["attention", a.attention, attention.length]] as const).map(([k, label, n]) => (
                <button key={k} type="button" className={filter === k ? "active" : ""} onClick={() => setFilter(k)}>{label} <span className="n">{num(n)}</span></button>
              ))}
            </div>
            <label className="sdr-search" style={{ minWidth: 180 }}><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={a.search} aria-label={a.search} /></label>
          </div>
        </div>
        <div className="sdr-panel-body">
          <div className="sdr-table-wrap sdr-table-inset">
            <table className="sdr-table">
              <thead><tr><th>{a.colMailbox}</th><th>{a.colStatus}</th><th>{a.colSent}</th><th>{a.colHours}</th><th aria-label={a.edit} /></tr></thead>
              <tbody>
                {!state && <tr><td colSpan={5} className="empty">…</td></tr>}
                {state && !shown.length && <tr><td colSpan={5} className="empty">{boxes.length ? a.noMatch : a.empty}</td></tr>}
                {shown.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="sdr-who">
                        <span className="sdr-avatar">{initials(m.displayName || m.email)}<span className={`dot${m.status === "error" ? " bad" : ""}`} /></span>
                        <div><span className="sdr-cell-main" dir="ltr">{m.email}</span>{m.displayName && <span className="sdr-cell-sub">{m.displayName}</span>}</div>
                      </div>
                    </td>
                    <td><span className={`sdr-badge ${m.status === "connected" ? "green" : "red"}`} title={m.status === "error" ? m.lastError ?? undefined : undefined}>{a.status[m.status]}</span></td>
                    <td style={{ minWidth: 150 }}>
                      <div className="sdr-bar-row"><span className="sdr-bar"><span style={{ width: `${Math.min(100, (m.sentToday / Math.max(m.dailyLimit, 1)) * 100)}%` }} /></span><span>{num(m.sentToday)} <span className="muted">/ {num(m.dailyLimit)}</span></span></div>
                    </td>
                    <td>
                      <div className="sdr-hours"><Clock /><div>
                        <span className="sdr-cell-main" style={{ fontWeight: 400, whiteSpace: "nowrap" }}>{daysLabel(m.sendDays, t.sdr.days.short, a.everyDay, a.noDays, t.sdr.days.sep)}{t.sdr.days.sep}{m.sendStart === m.sendEnd ? a.allDay : <span dir="ltr">{m.sendStart}–{m.sendEnd}</span>}</span>
                        <span className="sdr-cell-sub" dir="ltr">{m.effectiveTimeZone}</span>
                      </div></div>
                    </td>
                    <td className="num">
                      <Menu label={a.edit}>{(close) => (<>
                        <button type="button" onClick={() => { close(); setEditing(m); }}><SlidersHorizontal />{a.edit}</button>
                        {m.status === "error" && m.provider === "gmail" && <a href="/api/integrations/gmail/start"><Plug />{a.reconnect}</a>}
                        {m.status === "error" && m.provider === "imap" && <button type="button" onClick={() => { close(); onImap(); }}><Plug />{a.reconnect}</button>}
                        <hr />
                        <button type="button" className="danger" disabled={pending} onClick={() => {
                          close();
                          if (!window.confirm(fmt(a.disconnectConfirm, { email: m.email }))) return;
                          start(async () => { await removeMailbox(m.id); reload(); });
                        }}>{a.disconnect}</button>
                      </>)}</Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {boxes.length > 0 && <DomainHealth key={boxes.map((m) => m.email).join(",")} />}
      {editing && state && <EditMailbox box={editing} state={state} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

/* ── Sending domain: SPF / DKIM / DMARC (owner, 2026-10-28) ── */

function DomainHealth() {
  const { t } = useI18n();
  const d = t.sdr.email.domain;
  const [checks, setChecks] = useState<DomainCheck[] | null>(null);
  useEffect(() => { mailboxDomainChecks().then(setChecks).catch(() => setChecks([])); }, []);
  const own = (checks ?? []).filter((c) => !c.shared);
  if (checks && !own.length) return null;
  const mark = (v: CheckState) => <span className={`sdr-badge ${v === "ok" ? "green" : v === "missing" ? "red" : "gray"}`}>{d.state[v]}</span>;
  return (
    <div className="sdr-panel" style={{ marginTop: 20 }}>
      <div className="sdr-panel-head"><div><div className="sdr-panel-title">{d.title}</div><div className="sdr-panel-sub">{d.subtitle}</div></div></div>
      <div className="sdr-panel-body pad">
        {!checks && <p className="sdr-panel-sub">{d.checking}</p>}
        {own.map((c) => {
          const missing = (["spf", "dkim", "dmarc"] as const).filter((k) => c[k] === "missing");
          return (
            <div key={c.domain} className="domain-health">
              <div className="domain-health-row"><strong dir="ltr">{c.domain}</strong><span>SPF {mark(c.spf)}</span><span>DKIM {mark(c.dkim)}</span><span>DMARC {mark(c.dmarc)}</span></div>
              {missing.length > 0
                ? <ul className="domain-health-fix">{missing.map((k) => <li key={k}>{d.fix[k]}</li>)}<li>{d.fixWhere}</li></ul>
                : c.spf === "ok" && c.dkim === "ok" && c.dmarc === "ok" ? <p className="sdr-panel-sub">{d.allGood}</p> : <p className="sdr-panel-sub">{d.unknown}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddMailbox({ provider, state, reload, onImap }: { provider: "gmail" | "imap"; state: EmailState | null; reload: () => void; onImap: () => void }) {
  const { t } = useI18n();
  const a = t.sdr.email.accounts;
  const [pending, start] = useTransition();
  const has = (p: string) => state?.mailboxes.some((m) => m.provider === p && m.status !== "disconnected");
  if (provider === "gmail") {
    return state?.available.includes("gmail") && !has("gmail") ? <a className="sdr-btn primary" href="/api/integrations/gmail/start"><GmailIcon />{a.addGmail}</a> : null;
  }
  return (
    <span style={{ display: "flex", gap: 8 }}>
      {state?.available.includes("test") && !has("test") && <button type="button" className="sdr-btn" disabled={pending} onClick={() => start(async () => { await connectTestMailbox(); reload(); })}><Plug />{a.addTest}</button>}
      {!has("imap") && <button type="button" className="sdr-btn primary" disabled={!state} onClick={onImap}><AtSign />{a.addImap}</button>}
    </span>
  );
}

function DayPicker({ value, onChange }: { value: number[]; onChange: (d: number[]) => void }) {
  const { t } = useI18n();
  // The week from Monday, as AgentSDR shows it.
  return (
    <div className="sdr-days">
      {[0, 1, 2, 3, 4, 5, 6].map((d) => {
        const on = value.includes(d);
        return (
          <label key={d} className={`sdr-day${on ? " on" : ""}`}>
            <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())} />
            {t.sdr.days.short.at(d)}
          </label>
        );
      })}
    </div>
  );
}

function ZoneSelect({ value, onChange, emptyLabel }: { value: string | null; onChange: (v: string | null) => void; emptyLabel?: string }) {
  const zones = useMemo(() => timeZoneChoices(value ?? "UTC"), [value]);
  return (
    <select className="sdr-input" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} dir="ltr">
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {zones.map((z) => <option key={z} value={z}>{z}</option>)}
    </select>
  );
}

function EditMailbox({ box, state, onClose, onSaved }: { box: MailboxView; state: EmailState; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const e = t.sdr.email.edit;
  const toast = useToast();
  const [f, setF] = useState({ dailyLimit: box.dailyLimit, days: box.sendDays, start: box.sendStart, end: box.sendEnd, timeZone: box.timeZone });
  const [pending, start] = useTransition();
  const fallback = state.rules.timezone ?? state.memberTimeZone ?? "UTC";
  return (
    <div className="sdr-dialog-overlay" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <form className="sdr-dialog" role="dialog" aria-modal="true" onSubmit={(ev) => {
        ev.preventDefault();
        start(async () => {
          const r = await updateMailboxSending(box.id, f);
          if (r.ok) { toast(e.saved); onSaved(); } else toast(e.failed, "error");
        });
      }}>
        <div className="sdr-dialog-head"><h4>{fmt(e.title, { email: box.email })}</h4><p>{e.subtitle}</p></div>
        <div className="sdr-dialog-body">
          <label><span>{e.limit}</span><input className="sdr-input num" type="number" min={1} max={500} required value={f.dailyLimit} onChange={(ev) => setF({ ...f, dailyLimit: Number(ev.target.value) })} /></label>
          <div><span style={{ display: "block", fontSize: ".8rem", fontWeight: 500, marginBottom: 6 }}>{e.days}</span><DayPicker value={f.days} onChange={(days) => setF({ ...f, days })} /></div>
          <div className="sdr-grid2">
            <label><span>{e.from}</span><input className="sdr-input" type="time" required value={f.start} onChange={(ev) => setF({ ...f, start: ev.target.value })} /></label>
            <label><span>{e.to}</span><input className="sdr-input" type="time" required value={f.end} onChange={(ev) => setF({ ...f, end: ev.target.value })} /></label>
          </div>
          <label><span>{e.timeZone}</span><ZoneSelect value={f.timeZone} onChange={(timeZone) => setF({ ...f, timeZone })} emptyLabel={fmt(e.useWorkspace, { tz: fallback })} /></label>
        </div>
        <div className="sdr-dialog-foot">
          <button type="button" className="sdr-btn" onClick={onClose}>{e.cancel}</button>
          <button type="submit" className="sdr-btn primary" disabled={pending}>{e.save}</button>
        </div>
      </form>
    </div>
  );
}

/* ── Connection ── */

function Rules({ state, reload }: { state: EmailState | null; reload: () => void }) {
  const { t } = useI18n();
  const r = t.sdr.email.rules;
  const toast = useToast();
  const [f, setF] = useState<SendingRules | null>(state?.rules ?? null);
  const [pending, start] = useTransition();
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (state && !f) setF(state.rules); }, [state, f]);
  if (!state || !f) return <p className="sdr-panel-sub">…</p>;
  const ro = !state.canEditRules;
  const dirty = JSON.stringify(f) !== JSON.stringify(state.rules);
  const d = DEFAULT_SENDING_RULES;
  const zone = f.timezone ?? state.memberTimeZone ?? "UTC";
  const set = (patch: Partial<SendingRules>) => setF({ ...f, ...patch });
  return (
    <div>
      <div className="sdr-section-head"><div><h4>{r.title}</h4><p>{r.subtitle}</p></div></div>
      <div className="sdr-rules"><div className="sdr-rules-body">
        <div className="sdr-rule">
          <div><div className="sdr-rule-label">{r.perDay}</div><div className="sdr-rule-desc">{r.perDayDesc}</div></div>
          <div className="sdr-rule-ctl">
            <div className="row"><input className="sdr-input num" type="number" min={1} max={500} disabled={ro} value={f.daily_per_mailbox} onChange={(e) => set({ daily_per_mailbox: Number(e.target.value) })} /><span className="unit">{r.unitDay}</span></div>
            <span className="hint">{fmt(r.defaultPerDay, { n: d.daily_per_mailbox })}</span>
          </div>
        </div>
        <div className="sdr-rule">
          <div><div className="sdr-rule-label">{r.gap}</div><div className="sdr-rule-desc">{r.gapDesc}</div></div>
          <div className="sdr-rule-ctl">
            <div className="row">
              <input className="sdr-input num" type="number" min={0} max={240} disabled={ro} value={f.gap_min} onChange={(e) => set({ gap_min: Number(e.target.value) })} />
              <span className="unit">{r.to}</span>
              <input className="sdr-input num" type="number" min={0} max={240} disabled={ro} value={f.gap_max} onChange={(e) => set({ gap_max: Number(e.target.value) })} />
              <span className="unit">{r.unitMinutes}</span>
            </div>
            <span className="hint">{fmt(r.defaultGap, { min: d.gap_min, max: d.gap_max })}</span>
          </div>
        </div>
        <div className="sdr-rule">
          <div><div className="sdr-rule-label">{r.hours}</div><div className="sdr-rule-desc">{r.hoursDesc}</div></div>
          <div className="sdr-rule-ctl" style={{ maxWidth: 340 }}>
            <ZoneSelect value={f.timezone} onChange={(timezone) => set({ timezone })} emptyLabel={`${state.memberTimeZone ?? "UTC"} (${r.memberZone})`} />
            <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0 }}><DayPicker value={f.days} onChange={(days) => set({ days })} /></fieldset>
            <div className="row">
              <input className="sdr-input" type="time" disabled={ro} value={f.start} onChange={(e) => set({ start: e.target.value })} />
              <span className="unit">{r.to}</span>
              <input className="sdr-input" type="time" disabled={ro} value={f.end} onChange={(e) => set({ end: e.target.value })} />
            </div>
            <span className="hint">
              {fmt(r.defaultHours, { days: daysLabel(d.days, t.sdr.days.short, t.sdr.email.accounts.everyDay, t.sdr.email.accounts.noDays, t.sdr.days.sep), start: d.start, end: d.end, tz: zone })}
              {!ro && <> · <button type="button" className="sdr-btn ghost sm" style={{ height: "auto", padding: 0, color: "var(--blue)" }} onClick={() => set({ days: [...d.days], start: d.start, end: d.end, timezone: null })}>{r.useDefault}</button></>}
            </span>
          </div>
        </div>
      </div></div>
      <p className="sdr-panel-sub" style={{ marginTop: 12 }}>{ro ? r.readOnly : r.replies}</p>
      {!ro && (
        <div className="sdr-foot">
          <button type="button" className="sdr-btn" disabled={!dirty || pending} onClick={() => setF(state.rules)}>{r.discard}</button>
          <button type="button" className="sdr-btn primary" disabled={!dirty || pending} onClick={() => start(async () => {
            const res = await saveSendingRules(f);
            if (res.ok) { toast(r.saved); reload(); setF(null); } else toast(r.failed, "error");
          })}>{r.save}</button>
        </div>
      )}
    </div>
  );
}

/* ── IMAP / SMTP ── */

export function ImapDialog({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const { t } = useI18n();
  const im = t.settings.integration.imap;
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ email: "", name: "", user: "", pass: "", imapHost: "", imapPort: "993", smtpHost: "", smtpPort: "465" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setF((o) => {
      const next = { ...o, [k]: v };
      // Typing the address suggests the usual server names; the member can change them.
      if (k === "email") {
        const domain = v.split("@")[1] ?? "";
        if (!o.user || o.user === o.email) next.user = v;
        if (domain && (!o.imapHost || o.imapHost === `imap.${o.email.split("@")[1] ?? ""}`)) next.imapHost = `imap.${domain}`;
        if (domain && (!o.smtpHost || o.smtpHost === `smtp.${o.email.split("@")[1] ?? ""}`)) next.smtpHost = `smtp.${domain}`;
      }
      return next;
    });
  };
  return (
    <div className="sdr-dialog-overlay" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <form className="sdr-dialog" style={{ width: "min(620px, 100%)" }} role="dialog" aria-modal="true" onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startBusy(async () => {
          const r = await connectImapMailbox({ ...f, imapPort: Number(f.imapPort), smtpPort: Number(f.smtpPort) });
          if (r.ok) onConnected(); else setError(im.errors[r.error]);
        });
      }}>
        <div className="sdr-dialog-head"><h4>{im.name}</h4><p>{im.help}</p></div>
        <div className="sdr-dialog-body">
          <div className="sdr-grid2">
            <label><span>{im.email}</span><input className="sdr-input" dir="ltr" type="email" required autoComplete="email" value={f.email} onChange={set("email")} /></label>
            <label><span>{im.senderName}</span><input className="sdr-input" value={f.name} onChange={set("name")} /></label>
            <label><span>{im.user}</span><input className="sdr-input" dir="ltr" required autoComplete="username" value={f.user} onChange={set("user")} /></label>
            <label><span>{im.pass}</span><input className="sdr-input" dir="ltr" type="password" required autoComplete="current-password" value={f.pass} onChange={set("pass")} /></label>
            <label><span>{im.imapHost}</span><input className="sdr-input" dir="ltr" required value={f.imapHost} onChange={set("imapHost")} /></label>
            <label><span>{im.port}</span><select className="sdr-input" value={f.imapPort} onChange={(e) => setF((o) => ({ ...o, imapPort: e.target.value }))}><option value="993">993 (SSL/TLS)</option><option value="143">143 (STARTTLS)</option></select></label>
            <label><span>{im.smtpHost}</span><input className="sdr-input" dir="ltr" required value={f.smtpHost} onChange={set("smtpHost")} /></label>
            <label><span>{im.port}</span><select className="sdr-input" value={f.smtpPort} onChange={(e) => setF((o) => ({ ...o, smtpPort: e.target.value }))}><option value="465">465 (SSL/TLS)</option><option value="587">587 (STARTTLS)</option><option value="2525">2525 (STARTTLS)</option></select></label>
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="sdr-dialog-foot">
          <button type="button" className="sdr-btn" onClick={onClose}>{im.cancel}</button>
          <button type="submit" className="sdr-btn primary" disabled={busy}>{busy ? im.checking : im.save}</button>
        </div>
      </form>
    </div>
  );
}
