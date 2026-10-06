"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ExternalLink, Eye, Mail, Phone, Send, Sparkles, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { useToast } from "@/components/Toast";
import { revealPeople, startOutreach, type OutreachItem } from "@/app/(app)/prospects/people-actions";
import { prepareMessage } from "@/app/(app)/outreach/actions";
import { LinkedInIcon } from "./ConnectorIcons";
import { AvatarStack, PersonAvatar } from "./Media";

export interface GridPerson {
  id: string;
  name: string;
  title: string | null;
  place: string;
  company: string | null;
  companyId: string | null;
  photoUrl: string | null;
  linkedinUrl: string | null;
  emailStatus: string;
  hasEmail: boolean;
  hasPhone: boolean;
  /** Present once revealed. */
  email: string | null;
  phone: string | null;
  revealed: boolean;
  matchScore: number | null;
}

interface Props {
  people: GridPerson[];
  mailboxes: { id: string; email: string }[];
  /** Show the company line on each card (results across companies). */
  showCompany?: boolean;
}

// Decision makers as cards (D-147, owner's reference): photo, title, place,
// LinkedIn, whether an email / phone is available, reveal, select → start
// outreach to the selection from a popup.
export function PeopleGrid({ people, mailboxes, showCompany = false }: Props) {
  const { t } = useI18n();
  const r = t.results;
  const toast = useToast();
  const [rows, setRows] = useState(people);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState(false);
  const [pending, start] = useTransition();
  // New rows from the server (refresh, filters) replace the local copy.
  const [from, setFrom] = useState(people);
  if (from !== people) {
    setFrom(people);
    setRows(people);
  }

  const all = rows.length > 0 && rows.every((p) => selected.has(p.id));
  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const chosen = rows.filter((p) => selected.has(p.id));

  const reveal = (id: string) => start(async () => {
    const res = await revealPeople([id]);
    if (!res.ok) return;
    const c = res.contacts[0];
    setRows((list) => list.map((p) => (p.id === id ? { ...p, revealed: true, email: c?.email ?? null, phone: c?.phone ?? null } : p)));
  });

  if (!rows.length) return null;
  return (
    <>
      <div className="people-grid-head">
        <label className="select-all"><input type="checkbox" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((p) => p.id)))} /> {r.selectAll}</label>
      </div>
      <ul className="people-grid">
        {rows.map((p) => (
          <li key={p.id} className={`person-card${selected.has(p.id) ? " selected" : ""}`}>
            <div className="person-card-top">
              <input type="checkbox" aria-label={p.name} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
              <PersonAvatar name={p.name} photoUrl={p.photoUrl} size={52} />
              <div className="person-card-id">
                <Link className="person-card-name" href={`/prospects/person/${p.id}`}>{p.name}</Link>
                {p.title && <div className="person-card-title">{p.title}</div>}
                {showCompany && p.company && <div className="person-card-sub">{p.companyId ? <Link href={`/prospects/company/${p.companyId}`}>{p.company}</Link> : p.company}</div>}
                {p.place && <div className="person-card-sub">{p.place}</div>}
                {p.emailStatus === "verified" && <span className="chip-ok">{r.verified}</span>}
              </div>
              {p.linkedinUrl && <a className="person-card-li" href={p.linkedinUrl} target="_blank" rel="noreferrer" aria-label="LinkedIn"><LinkedInIcon /></a>}
            </div>
            <dl className="person-card-contact">
              <dt><Mail /> {r.email}</dt>
              <dd dir={p.revealed && p.email ? "ltr" : undefined}>{p.revealed ? (p.email ?? <span className="muted">{r.notFound}</span>) : p.hasEmail ? <span className="ok">{r.available}</span> : <span className="muted">{r.notFound}</span>}</dd>
              <dt><Phone /> {r.phone}</dt>
              <dd dir={p.revealed && p.phone ? "ltr" : undefined}>{p.revealed ? (p.phone ?? <span className="muted">{r.notFound}</span>) : p.hasPhone ? <span className="ok">{r.available}</span> : <span className="muted">{r.notFound}</span>}</dd>
            </dl>
            <div className="person-card-actions">
              <Link className="btn-secondary" href={`/prospects/person/${p.id}`}>{r.viewProfile} <ExternalLink /></Link>
              {p.revealed ? (
                <span className="revealed-pill"><CheckCircle2 /> {r.revealed}</span>
              ) : (
                <button className="btn-outline-accent" type="button" disabled={pending || (!p.hasEmail && !p.hasPhone)} onClick={() => reveal(p.id)}><Eye /> {r.reveal}</button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {chosen.length > 0 && (
        <div className="selection-bar" role="region" aria-label={fmt(r.selected, { count: chosen.length })}>
          <AvatarStack people={chosen.map((p) => ({ name: p.name, photoUrl: p.photoUrl }))} max={3} size={30} />
          <span>{fmt(r.selected, { count: chosen.length })}</span>
          <button className="btn-primary" type="button" onClick={() => setDrawer(true)}><Send /> {fmt(r.startOutreach, { count: chosen.length })} <ArrowRight className="flip-rtl" /></button>
        </div>
      )}
      {drawer && <OutreachDrawer people={chosen} mailboxes={mailboxes} onClose={() => setDrawer(false)} onSent={(n) => toast(fmt(r.progressLead, { count: n }))} />}
    </>
  );
}

const DEFAULT_BODY = {
  en: "Hi {first_name},\n\nI came across {company} and thought it would be worth connecting.\n\nWould you be open to a short call this week?\n\nBest,",
  ar: "أهلاً {first_name}،\n\nاطّلعت على {company} وأعتقد أن هناك فرصة جيدة للتعاون.\n\nهل يناسبك اتصال قصير هذا الأسبوع؟\n\nمع التحية،",
};

function fill(text: string, p: GridPerson) {
  return text.replaceAll("{first_name}", p.name.split(/\s+/)[0] ?? p.name).replaceAll("{company}", p.company ?? "");
}

function OutreachDrawer({ people, mailboxes, onClose, onSent }: { people: GridPerson[]; mailboxes: { id: string; email: string }[]; onClose: () => void; onSent: (n: number) => void }) {
  const { t, locale } = useI18n();
  const r = t.results;
  const router = useRouter();
  const lang: "en" | "ar" = locale === "ar" ? "ar" : "en";
  const [index, setIndex] = useState(0);
  const [shared, setShared] = useState({ subject: lang === "ar" ? "فكرة سريعة لـ {company}" : "Quick idea for {company}", body: DEFAULT_BODY[lang] });
  // Yolias's own draft per person, once personalized.
  const [own, setOwn] = useState<Record<string, { id: string; subject: string; body: string }>>({});
  const [from, setFrom] = useState(mailboxes[0]?.id ?? "");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const current = people[Math.min(index, people.length - 1)];
  const withoutEmail = useMemo(() => people.filter((p) => !p.hasEmail).length, [people]);
  const mine = current ? own[current.id] : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const personalize = () => start(async () => {
    setError(null);
    const targets = people.filter((p) => p.hasEmail && !own[p.id]);
    setProgress({ done: 0, total: targets.length });
    for (const [k, p] of targets.entries()) {
      const res = await prepareMessage(p.id, "", lang);
      if (res.ok) setOwn((o) => ({ ...o, [p.id]: { id: res.message.id, subject: res.message.subject, body: res.message.body } }));
      else setError(res.error);
      setProgress({ done: k + 1, total: targets.length });
    }
    setProgress(null);
  });

  const send = () => start(async () => {
    setError(null);
    const items: OutreachItem[] = people.filter((p) => p.hasEmail).map((p) => {
      const m = own[p.id];
      return { prospectId: p.id, messageId: m?.id ?? null, subject: m ? m.subject : fill(shared.subject, p), body: m ? m.body : fill(shared.body, p), language: lang };
    });
    const res = await startOutreach(items, from);
    if (!res.ok) return setError(res.error);
    onSent(res.ids.length);
    router.push(`/outreach/progress?ids=${res.ids.join(",")}`);
  });

  if (!current) return null;
  const subject = mine ? mine.subject : shared.subject;
  const body = mine ? mine.body : shared.body;
  const edit = (field: "subject" | "body", v: string) => {
    if (mine) setOwn((o) => ({ ...o, [current.id]: { ...mine, [field]: v } }));
    else setShared((s) => ({ ...s, [field]: v }));
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={r.drawerTitle} onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <h3>{r.drawerTitle}</h3>
            <p>{r.drawerLead}</p>
          </div>
          <button className="icon-btn" type="button" aria-label={r.cancel} onClick={onClose}><X /></button>
        </header>

        <div className="drawer-body">
          {people.length > 1 && (
            <div className="drawer-people" role="tablist">
              {people.map((p, k) => (
                <button key={p.id} type="button" role="tab" aria-selected={k === index} className={k === index ? "active" : ""} onClick={() => setIndex(k)} title={p.name}>
                  <PersonAvatar name={p.name} photoUrl={p.photoUrl} size={28} />
                  {own[p.id] && <Sparkles className="drawer-person-mark" />}
                </button>
              ))}
            </div>
          )}

          <div className="drawer-person">
            <PersonAvatar name={current.name} photoUrl={current.photoUrl} size={64} />
            <div>
              <strong>{current.name}</strong>
              {current.title && <div className="person-card-title">{current.title}</div>}
              {current.company && <div className="person-card-sub">{current.company}</div>}
              {current.place && <div className="person-card-sub">{current.place}</div>}
            </div>
            {current.linkedinUrl && <a className="btn-secondary small" href={current.linkedinUrl} target="_blank" rel="noreferrer"><LinkedInIcon /> {r.openLinkedIn}</a>}
          </div>

          <div className="drawer-label-row">
            <span className="drawer-label">{r.message}</span>
            <span className="cell-sub">{mine ? r.personalized : r.sharedMessage}</span>
          </div>
          <input className="form-input" dir="auto" value={mine ? subject : subject} placeholder={r.subject} maxLength={300} onChange={(e) => edit("subject", e.target.value)} aria-label={r.subject} />
          <textarea className="form-input drawer-message" dir="auto" rows={9} value={body} maxLength={10_000} onChange={(e) => edit("body", e.target.value)} aria-label={r.message} />
          <div className="drawer-preview-row">
            {!mine && <span className="cell-sub">{r.placeholders}</span>}
            <span className="cell-sub" dir="ltr">{body.length}/10000</span>
          </div>

          <div className="drawer-personalize">
            <button className="btn-outline-accent" type="button" disabled={pending} onClick={personalize}><Sparkles /> {progress ? fmt(r.personalizing, progress) : r.personalize}</button>
            <span className="cell-sub">{r.personalizeHint}</span>
          </div>

          <div className="drawer-label">{r.delivery}</div>
          {mailboxes.length ? (
            <label className="field">
              <span className="cell-sub">{r.sendFrom}</span>
              <select className="form-select" value={from} onChange={(e) => setFrom(e.target.value)}>
                {mailboxes.map((m) => <option key={m.id} value={m.id}>{m.email}</option>)}
              </select>
            </label>
          ) : (
            <p className="drawer-note">{r.noMailbox} <Link href="/outreach">{r.connect}</Link></p>
          )}
          <p className="drawer-note">{r.linkedinNote}</p>
          {withoutEmail > 0 && <p className="drawer-note warn">{fmt(r.noEmail, { count: withoutEmail })}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>

        <footer className="drawer-foot">
          <button className="btn-secondary" type="button" onClick={onClose}>{r.cancel}</button>
          <button className="btn-primary" type="button" disabled={pending || !from || people.every((p) => !p.hasEmail)} onClick={send}><Send /> {pending && !progress ? r.starting : r.start} <ArrowRight className="flip-rtl" /></button>
        </footer>
      </aside>
    </div>
  );
}
