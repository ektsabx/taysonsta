"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, Copy, Download, Mail, Sparkles, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { exportedPeople, openMessage, prepareMessage } from "@/app/(app)/prospects/message-actions";
import {
  channelLimit, isMessageLanguage, languageLabels, messageLanguages, objectives, tones,
  DEFAULT_LANGUAGE, DEFAULT_OBJECTIVE, DEFAULT_TONE, type MessageLanguage,
} from "@/lib/outreach/channels";
import type { MessageChannel, MessageObjective, MessageOpenedVia, MessageTone } from "@/types/database";
import { FacebookIcon, InstagramIcon, LinkedInIcon, WhatsAppIcon } from "./ConnectorIcons";
import { CompanyLogo, PersonAvatar } from "./Media";
import type { GridPerson } from "./PeopleGrid";

// Prospect actions (MVP, D-155 / D-160): Email / LinkedIn / WhatsApp /
// Facebook / Instagram / Export CSV. Yolias writes each message (goal, tone
// and language chosen by the member, only verified facts); the member edits
// it and opens it in their own Gmail, Outlook, email app, WhatsApp,
// Messenger, Instagram or LinkedIn. Nothing is sent by Yolias.

/** Someone a message can be written for: a person, or a company / local business. */
export interface MessageRecipient {
  kind: "person" | "company";
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  photoUrl: string | null;
  logo?: { logoUrl: string | null; domain: string | null };
  can: Record<MessageChannel, boolean>;
}

export function personRecipient(p: GridPerson): MessageRecipient {
  return {
    kind: "person", id: p.id, name: p.name, title: p.title, company: p.company, photoUrl: p.photoUrl,
    can: { email: p.hasEmail, linkedin: Boolean(p.linkedinUrl), whatsapp: p.hasWhatsapp, facebook: Boolean(p.facebookUrl), instagram: Boolean(p.instagramUrl) },
  };
}

type Draft = { id: string | null; subject: string; body: string; personalization: string[]; cta: string | null };
type MailClient = "gmail" | "outlook" | "mail_app";
const MAIL_CLIENT_KEY = "yolias_mail_client";
const SETTINGS_KEY = "yolias_message_settings";
const empty: Draft = { id: null, subject: "", body: "", personalization: [], cta: null };

const enc = encodeURIComponent;
function composeUrl(client: MailClient, to: string, subject: string, body: string) {
  if (client === "gmail") return `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}`;
  if (client === "outlook") return `https://outlook.office.com/mail/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`;
  return `mailto:${enc(to)}?subject=${enc(subject)}&body=${enc(body)}`;
}

export function ChannelIcon({ channel }: { channel: MessageChannel }) {
  if (channel === "email") return <Mail />;
  if (channel === "linkedin") return <LinkedInIcon />;
  if (channel === "whatsapp") return <WhatsAppIcon />;
  if (channel === "facebook") return <FacebookIcon />;
  return <InstagramIcon />;
}

/** One button per channel; Email and LinkedIn always show, the others when someone has them. */
function ChannelButtons({ recipients, onPick }: { recipients: MessageRecipient[]; onPick: (c: MessageChannel) => void }) {
  const { t } = useI18n();
  const o = t.outreach;
  const has = (c: MessageChannel) => recipients.some((r) => r.can[c]);
  const list: MessageChannel[] = (["email", "linkedin", "whatsapp", "facebook", "instagram"] as const).filter((c) => (recipients[0]?.kind === "person" && (c === "email" || c === "linkedin")) || has(c));
  return (
    <>
      {list.map((c, i) => (
        <button key={c} className={i === 0 ? "btn-primary" : "btn-secondary"} type="button" disabled={!has(c)} onClick={() => onPick(c)}><ChannelIcon channel={c} /> {o[c]}</button>
      ))}
    </>
  );
}

/** The buttons under a selection of people: message channels and Export CSV. */
export function ProspectActionButtons({ people, source, onExport }: { people: GridPerson[]; source: "results" | "prospects"; onExport?: () => void }) {
  const { t } = useI18n();
  const o = t.outreach;
  const [channel, setChannel] = useState<MessageChannel | null>(null);
  const exportForm = useRef<HTMLFormElement>(null);
  const recipients = people.map(personRecipient);
  const exportCsv = () => {
    if (onExport) onExport();
    else exportForm.current?.requestSubmit();
    void exportedPeople(people.length, source);
  };
  return (
    <>
      <ChannelButtons recipients={recipients} onPick={setChannel} />
      <button className="btn-secondary" type="button" onClick={exportCsv}><Download /> {o.exportCsv}</button>
      {!onExport && (
        <form ref={exportForm} method="post" action="/prospects/export" hidden>
          <input type="hidden" name="query" value="tab=people" />
          {people.map((p) => <input key={p.id} type="hidden" name="id" value={p.id} />)}
        </form>
      )}
      {channel && <MessageComposer recipients={recipients} channel={channel} onClose={() => setChannel(null)} />}
    </>
  );
}

/** Email (its public inbox) / WhatsApp / Facebook / Instagram for one company or local business (shown when it has them). */
export function CompanyActionButtons({ company }: { company: MessageRecipient }) {
  const [channel, setChannel] = useState<MessageChannel | null>(null);
  if (!company.can.email && !company.can.whatsapp && !company.can.facebook && !company.can.instagram) return null;
  return (
    <>
      <ChannelButtons recipients={[company]} onPick={setChannel} />
      {channel && <MessageComposer recipients={[company]} channel={channel} onClose={() => setChannel(null)} />}
    </>
  );
}

type Settings = { objective: MessageObjective; tone: MessageTone; language: MessageLanguage };

function savedSettings(): Settings {
  const s: Settings = { objective: DEFAULT_OBJECTIVE, tone: DEFAULT_TONE, language: DEFAULT_LANGUAGE };
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<Settings>;
    if (v.objective && objectives.includes(v.objective)) s.objective = v.objective;
    if (v.tone && tones.includes(v.tone)) s.tone = v.tone;
    if (isMessageLanguage(v.language)) s.language = v.language;
  } catch {}
  return s;
}

export function MessageComposer({ recipients: all, channel, onClose }: { recipients: MessageRecipient[]; channel: MessageChannel; onClose: () => void }) {
  const { t } = useI18n();
  const o = t.outreach;
  const router = useRouter();
  const email = channel === "email";
  const limit = channel === "email" ? null : channelLimit[channel];
  const people = all.filter((p) => p.can[channel]);
  const skipped = all.length - people.length;
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [writing, setWriting] = useState<string | null>(null);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [instruction, setInstruction] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [client, setClient] = useState<MailClient>("gmail");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const current = people[Math.min(index, Math.max(people.length - 1, 0))];
  const draft = current ? drafts[current.id] : undefined;
  const tried = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MAIL_CLIENT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "gmail" || saved === "outlook" || saved === "mail_app") setClient(saved);
    } catch {}
    setSettings(savedSettings());
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const change = (patch: Partial<Settings>) => setSettings((s) => {
    const next = { ...(s ?? savedSettings()), ...patch };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
    return next;
  });

  const write = useCallback(async (p: MessageRecipient, focus: string, s: Settings) => {
    setError(null);
    setWriting(p.id);
    const res = await prepareMessage({ target: { kind: p.kind, id: p.id }, channel, instruction: focus, ...s });
    setWriting(null);
    if (res.ok) setDrafts((d) => ({ ...d, [p.id]: { id: res.message.id, subject: res.message.subject, body: res.message.body, personalization: res.message.personalization ?? [], cta: res.message.cta } }));
    else {
      setError(res.error);
      setDrafts((d) => ({ ...d, [p.id]: d[p.id] ?? empty }));
    }
  }, [channel]);

  // Yolias prepares the message as soon as a person is shown (once each), with the last-used settings.
  useEffect(() => {
    if (!current || !settings || drafts[current.id] || tried.current.has(current.id)) return;
    tried.current.add(current.id);
    void write(current, instruction, settings);
  }, [current, drafts, write, settings, instruction]);

  const title = o.title[channel];
  if (!current) {
    return (
      <Shell title={title} lead={o.lead} onClose={onClose}>
        <p className="drawer-note warn">{o.missing[channel]}</p>
      </Shell>
    );
  }

  const edit = (field: "subject" | "body", v: string) => setDrafts((d) => ({ ...d, [current.id]: { ...(d[current.id] ?? empty), [field]: v } }));
  const subject = draft?.subject ?? "";
  const body = draft?.body ?? "";
  const ready = body.trim().length > 0 && (!email || subject.trim().length > 0) && (limit === null || body.length <= limit);
  const s = settings ?? { objective: DEFAULT_OBJECTIVE, tone: DEFAULT_TONE, language: DEFAULT_LANGUAGE };

  const open = (via: MessageOpenedVia) => {
    setError(null);
    // Open the tab inside the click, so the browser doesn't block it; fill it in after the server answers.
    const tab = via === "mail_app" || via === "copy" ? null : window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    // Messenger, Instagram and LinkedIn can't take the text: it goes to the clipboard.
    if (via === "copy" || channel === "linkedin" || channel === "facebook" || channel === "instagram") {
      void navigator.clipboard?.writeText(email ? `${subject}\n\n${body}` : body).then(() => setCopied(true), () => {});
    }
    if (email && via !== "copy") {
      setClient(via as MailClient);
      try { localStorage.setItem(MAIL_CLIENT_KEY, via); } catch {}
    }
    start(async () => {
      const res = await openMessage({ target: { kind: current.kind, id: current.id }, channel, via, messageId: draft?.id ?? null, subject, body, language: s.language });
      if (!res.ok) {
        tab?.close();
        return setError(res.error);
      }
      if (email && via !== "copy" && res.email) {
        const url = composeUrl(via as MailClient, res.email, subject, body);
        if (tab) tab.location.href = url;
        else window.location.href = url;
      } else if (!email && via !== "copy" && res.url && tab) {
        tab.location.href = res.url;
      } else tab?.close();
      setOpened((x) => new Set(x).add(current.id));
      // The draft is now the saved message; another edit opens as a new one.
      setDrafts((d) => ({ ...d, [current.id]: { ...d[current.id]!, id: null } }));
      if (index < people.length - 1) setIndex(index + 1);
      router.refresh();
    });
  };

  const clients: { id: MailClient; label: string }[] = [
    { id: "gmail", label: o.gmail },
    { id: "outlook", label: o.outlook },
    { id: "mail_app", label: o.mailApp },
  ];
  const isWriting = writing === current.id;

  return (
    <Shell title={title} lead={o.lead} onClose={onClose}>
      {people.length > 1 && (
        <div className="drawer-label-row">
          <div className="drawer-people" role="tablist">
            {people.map((p, k) => (
              <button key={p.id} type="button" role="tab" aria-selected={k === index} className={k === index ? "active" : ""} onClick={() => setIndex(k)} title={p.name}>
                <Avatar r={p} size={28} />
                {opened.has(p.id) && <CheckCircle2 className="drawer-person-mark" />}
              </button>
            ))}
          </div>
          <span className="cell-sub">{fmt(o.position, { index: index + 1, count: people.length })}</span>
        </div>
      )}

      <div className="drawer-person">
        <Avatar r={current} size={56} />
        <div>
          <strong>{current.name}</strong>
          {current.title && <div className="person-card-title">{current.title}</div>}
          {current.company && <div className="person-card-sub">{current.company}</div>}
        </div>
        {opened.has(current.id) && <span className="revealed-pill"><CheckCircle2 /> {o.opened}</span>}
      </div>

      <div className="composer-settings">
        <label>
          <span>{o.objective}</span>
          <select className="form-select" value={s.objective} onChange={(e) => change({ objective: e.target.value as MessageObjective })}>
            {objectives.map((v) => <option key={v} value={v}>{o.objectives[v]}</option>)}
          </select>
        </label>
        <label>
          <span>{o.tone}</span>
          <select className="form-select" value={s.tone} onChange={(e) => change({ tone: e.target.value as MessageTone })}>
            {tones.map((v) => <option key={v} value={v}>{o.tones[v]}</option>)}
          </select>
        </label>
        <label>
          <span>{o.language}</span>
          <select className="form-select" value={s.language} onChange={(e) => change({ language: e.target.value as MessageLanguage })}>
            {(Object.keys(messageLanguages) as MessageLanguage[]).map((v) => <option key={v} value={v}>{languageLabels[v]}</option>)}
          </select>
        </label>
      </div>

      <div className="drawer-personalize">
        <input className="form-input" dir="auto" value={instruction} placeholder={o.instructionPlaceholder} aria-label={o.instruction} title={o.instruction} maxLength={1000} onChange={(e) => setInstruction(e.target.value)} />
        <button className="btn-outline-accent" type="button" disabled={writing !== null} onClick={() => void write(current, instruction, s)}>
          <Sparkles /> {isWriting ? o.writing : draft?.body ? o.rewrite : o.write}
        </button>
      </div>

      {email && <input className="form-input" dir="auto" value={subject} placeholder={o.subject} aria-label={o.subject} maxLength={300} disabled={isWriting} onChange={(e) => edit("subject", e.target.value)} />}
      <textarea
        className="form-input drawer-message" dir="auto" rows={email ? 10 : 6} value={body} aria-label={o.body}
        placeholder={isWriting ? o.writing : o.body} maxLength={email ? 10_000 : 2000} disabled={isWriting}
        onChange={(e) => edit("body", e.target.value)}
      />
      <div className="drawer-preview-row">
        <span className="cell-sub">{o.channelNote[channel]}</span>
        {limit !== null && <span className={`cell-sub${body.length > limit ? " over" : ""}`} dir="ltr">{body.length}/{limit}</span>}
      </div>
      {draft && !isWriting && draft.cta !== null && (
        <dl className="composer-facts">
          <dt>{o.personalization}</dt>
          <dd>{draft.personalization.length ? draft.personalization.map((f) => <span key={f} className="chip" dir="auto">{f}</span>) : <span className="cell-sub">{o.noPersonalization}</span>}</dd>
          {draft.cta && <><dt>{o.cta}</dt><dd dir="auto">{draft.cta}</dd></>}
        </dl>
      )}
      {skipped > 0 && <p className="drawer-note warn">{fmt(o.skipped[channel], { count: skipped })}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      <footer className="drawer-foot composer-foot">
        <div className="composer-nav">
          <button className="icon-btn" type="button" aria-label={o.previous} disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeft className="flip-rtl" /></button>
          <button className="icon-btn" type="button" aria-label={o.next} disabled={index >= people.length - 1} onClick={() => setIndex(index + 1)}><ChevronRight className="flip-rtl" /></button>
        </div>
        <button className="btn-secondary" type="button" disabled={!ready || pending} onClick={() => open("copy")}><Copy /> {copied ? o.copied : o.copy}</button>
        {email ? (
          <div className="composer-open">
            <span className="cell-sub">{o.openIn}</span>
            {clients.map((c) => (
              <button key={c.id} className={c.id === client ? "btn-primary" : "btn-secondary"} type="button" disabled={!ready || pending} onClick={() => open(c.id)}>{c.label}</button>
            ))}
          </div>
        ) : (
          <button className="btn-primary" type="button" disabled={!ready || pending} onClick={() => open(channel)}><ChannelIcon channel={channel} /> {o.open[channel]}</button>
        )}
      </footer>
    </Shell>
  );
}

function Avatar({ r, size }: { r: MessageRecipient; size: number }) {
  return r.kind === "company" ? <CompanyLogo name={r.name} logoUrl={r.logo?.logoUrl ?? null} domain={r.logo?.domain ?? null} size={size} /> : <PersonAvatar name={r.name} photoUrl={r.photoUrl} size={size} />;
}

function Shell({ title, lead, onClose, children }: { title: string; lead: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer composer" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <h3>{title}</h3>
            <p>{lead}</p>
          </div>
          <button className="icon-btn" type="button" aria-label={t.common.close} onClick={onClose}><X /></button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}
