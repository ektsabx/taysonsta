"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, Copy, Download, Mail, Sparkles, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { exportedPeople, openMessage, prepareMessage } from "@/app/(app)/prospects/message-actions";
import type { MessageChannel, MessageOpenedVia } from "@/types/database";
import { LinkedInIcon } from "./ConnectorIcons";
import { PersonAvatar } from "./Media";
import type { GridPerson } from "./PeopleGrid";

// Prospect actions (MVP, D-155): Email / LinkedIn / Export CSV for the
// selected people. Yolias writes each message; the member edits it and opens
// it in their own Gmail, Outlook or email app, or on LinkedIn. Nothing is
// sent by Yolias.

type Draft = { id: string | null; subject: string; body: string };
type MailClient = "gmail" | "outlook" | "mail_app";
const MAIL_CLIENT_KEY = "yolias_mail_client";
const LINKEDIN_MAX = 300;

const enc = encodeURIComponent;
function composeUrl(client: MailClient, to: string, subject: string, body: string) {
  if (client === "gmail") return `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}`;
  if (client === "outlook") return `https://outlook.office.com/mail/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`;
  return `mailto:${enc(to)}?subject=${enc(subject)}&body=${enc(body)}`;
}

/** The buttons under a selection: Email, LinkedIn, Export CSV. */
export function ProspectActionButtons({ people, source, onExport }: { people: GridPerson[]; source: "results" | "prospects"; onExport?: () => void }) {
  const { t } = useI18n();
  const o = t.outreach;
  const [channel, setChannel] = useState<MessageChannel | null>(null);
  const exportForm = useRef<HTMLFormElement>(null);
  const exportCsv = () => {
    if (onExport) onExport();
    else exportForm.current?.requestSubmit();
    void exportedPeople(people.length, source);
  };
  return (
    <>
      <button className="btn-primary" type="button" disabled={!people.some((p) => p.hasEmail)} onClick={() => setChannel("email")}><Mail /> {o.email}</button>
      <button className="btn-secondary" type="button" disabled={!people.some((p) => p.linkedinUrl)} onClick={() => setChannel("linkedin")}><LinkedInIcon /> {o.linkedin}</button>
      <button className="btn-secondary" type="button" onClick={exportCsv}><Download /> {o.exportCsv}</button>
      {!onExport && (
        <form ref={exportForm} method="post" action="/prospects/export" hidden>
          <input type="hidden" name="query" value="tab=people" />
          {people.map((p) => <input key={p.id} type="hidden" name="id" value={p.id} />)}
        </form>
      )}
      {channel && <MessageComposer people={people} channel={channel} onClose={() => setChannel(null)} />}
    </>
  );
}

export function MessageComposer({ people: all, channel, onClose }: { people: GridPerson[]; channel: MessageChannel; onClose: () => void }) {
  const { t, locale } = useI18n();
  const o = t.outreach;
  const router = useRouter();
  const email = channel === "email";
  const people = all.filter((p) => (email ? p.hasEmail : Boolean(p.linkedinUrl)));
  const skipped = all.length - people.length;
  const lang: "en" | "ar" = locale === "ar" ? "ar" : "en";
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [writing, setWriting] = useState<string | null>(null);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [instruction, setInstruction] = useState("");
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
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const write = useCallback(async (p: GridPerson, focus: string) => {
    setError(null);
    setWriting(p.id);
    const res = await prepareMessage(p.id, channel, focus, lang);
    setWriting(null);
    if (res.ok) setDrafts((d) => ({ ...d, [p.id]: { id: res.message.id, subject: res.message.subject, body: res.message.body } }));
    else {
      setError(res.error);
      setDrafts((d) => ({ ...d, [p.id]: d[p.id] ?? { id: null, subject: "", body: "" } }));
    }
  }, [channel, lang]);

  // Yolias prepares the message as soon as a person is shown (once each).
  useEffect(() => {
    if (!current || drafts[current.id] || tried.current.has(current.id)) return;
    tried.current.add(current.id);
    void write(current, "");
  }, [current, drafts, write]);

  if (!current) {
    return (
      <Shell title={email ? o.titleEmail : o.titleLinkedIn} lead={o.lead} onClose={onClose}>
        <p className="drawer-note warn">{email ? o.noEmail : o.noLinkedIn}</p>
      </Shell>
    );
  }

  const edit = (field: "subject" | "body", v: string) => setDrafts((d) => ({ ...d, [current.id]: { ...(d[current.id] ?? { id: null, subject: "", body: "" }), [field]: v } }));
  const subject = draft?.subject ?? "";
  const body = draft?.body ?? "";
  const ready = body.trim().length > 0 && (!email || subject.trim().length > 0) && (email || body.length <= LINKEDIN_MAX);

  const open = (via: MessageOpenedVia) => {
    setError(null);
    // Open the tab inside the click, so the browser doesn't block it; fill it in after the server answers.
    const tab = via === "mail_app" || via === "copy" ? null : window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    if (!email || via === "copy") {
      void navigator.clipboard?.writeText(email && via === "copy" ? `${subject}\n\n${body}` : body).then(() => setCopied(true), () => {});
    }
    if (email && via !== "copy") {
      setClient(via as MailClient);
      try { localStorage.setItem(MAIL_CLIENT_KEY, via); } catch {}
    }
    start(async () => {
      const res = await openMessage({ prospectId: current.id, channel, via, messageId: draft?.id ?? null, subject, body, language: lang });
      if (!res.ok) {
        tab?.close();
        return setError(res.error);
      }
      if (email && via !== "copy" && res.email) {
        const url = composeUrl(via as MailClient, res.email, subject, body);
        if (tab) tab.location.href = url;
        else window.location.href = url;
      } else if (!email && via === "linkedin" && res.linkedinUrl && tab) {
        tab.location.href = res.linkedinUrl;
      } else tab?.close();
      setOpened((s) => new Set(s).add(current.id));
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

  return (
    <Shell title={email ? o.titleEmail : o.titleLinkedIn} lead={o.lead} onClose={onClose}>
      {people.length > 1 && (
        <div className="drawer-label-row">
          <div className="drawer-people" role="tablist">
            {people.map((p, k) => (
              <button key={p.id} type="button" role="tab" aria-selected={k === index} className={k === index ? "active" : ""} onClick={() => setIndex(k)} title={p.name}>
                <PersonAvatar name={p.name} photoUrl={p.photoUrl} size={28} />
                {opened.has(p.id) && <CheckCircle2 className="drawer-person-mark" />}
              </button>
            ))}
          </div>
          <span className="cell-sub">{fmt(o.position, { index: index + 1, count: people.length })}</span>
        </div>
      )}

      <div className="drawer-person">
        <PersonAvatar name={current.name} photoUrl={current.photoUrl} size={56} />
        <div>
          <strong>{current.name}</strong>
          {current.title && <div className="person-card-title">{current.title}</div>}
          {current.company && <div className="person-card-sub">{current.company}</div>}
        </div>
        {opened.has(current.id) && <span className="revealed-pill"><CheckCircle2 /> {o.opened}</span>}
      </div>

      <div className="drawer-personalize">
        <input className="form-input" dir="auto" value={instruction} placeholder={o.instructionPlaceholder} aria-label={o.instruction} maxLength={1000} onChange={(e) => setInstruction(e.target.value)} />
        <button className="btn-outline-accent" type="button" disabled={writing !== null} onClick={() => void write(current, instruction)}>
          <Sparkles /> {writing === current.id ? o.writing : draft?.body ? o.rewrite : o.write}
        </button>
      </div>

      {email && <input className="form-input" dir="auto" value={subject} placeholder={o.subject} aria-label={o.subject} maxLength={300} disabled={writing === current.id} onChange={(e) => edit("subject", e.target.value)} />}
      <textarea
        className="form-input drawer-message" dir="auto" rows={email ? 10 : 5} value={body} aria-label={o.body}
        placeholder={writing === current.id ? o.writing : o.body} maxLength={email ? 10_000 : 2000} disabled={writing === current.id}
        onChange={(e) => edit("body", e.target.value)}
      />
      <div className="drawer-preview-row">
        <span className="cell-sub">{email ? o.note : o.linkedinNote}</span>
        {!email && <span className={`cell-sub${body.length > LINKEDIN_MAX ? " over" : ""}`} dir="ltr">{body.length}/{LINKEDIN_MAX}</span>}
      </div>
      {skipped > 0 && <p className="drawer-note warn">{fmt(email ? o.skippedEmail : o.skippedLinkedIn, { count: skipped })}</p>}
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
          <button className="btn-primary" type="button" disabled={!ready || pending} onClick={() => open("linkedin")}><LinkedInIcon /> {o.openLinkedIn}</button>
        )}
      </footer>
    </Shell>
  );
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
