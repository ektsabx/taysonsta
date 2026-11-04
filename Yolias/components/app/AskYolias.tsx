"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUp, Loader2, Maximize2, MessageSquareText, Plus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { useToast } from "@/components/Toast";
import { createStrategy } from "@/app/(app)/actions";
import { AgentThread } from "@/components/app/AgentThread";
import { YoliasMark } from "@/components/YoliasMark";

// Yolias AI on every screen (owner, 2026-10-31, D-270, D-273; D-274): like
// the business assistant in Facebook Ads Manager, a panel docked on the end
// side of the page (the page makes room for it) with a few ready questions.
// What is typed starts a conversation with Yolias AI that knows the page it
// came from; the answer streams in the panel, the conversation is kept in its
// history, and it can be opened full size. Hidden on Yolias AI's own pages.

const OPEN_CLASS = "ay-docked";

export function AskYolias({ chats }: { chats: { id: string; title: string }[] }) {
  const { t } = useI18n();
  const a = t.camp.ai;
  const P = t.ag.rx.ask;
  const pathname = usePathname();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [thread, setThread] = useState<{ id: string; prompt: string } | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);
  const hidden = pathname === "/" || pathname.startsWith("/search/");
  useEffect(() => { if (open && !thread) box.current?.focus(); }, [open, thread]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  // The page makes room for the panel, like an ads manager's side assistant.
  useEffect(() => {
    document.documentElement.classList.toggle(OPEN_CLASS, open && !hidden);
    return () => document.documentElement.classList.remove(OPEN_CLASS);
  }, [open, hidden]);
  if (hidden) return null;

  const send = (value = text) => {
    const prompt = value.trim();
    if (!prompt) return;
    start(async () => {
      const fd = new FormData();
      fd.set("prompt", prompt);
      // The page it was opened from, so "this campaign" means the one on screen (D-273).
      fd.set("page", pathname);
      const r = await callAction(() => createStrategy(fd));
      if (isNetworkFailure(r)) { toast(t.feedback.errors.network, "error"); return; }
      if (!r.ok) { toast(r.error, "error"); return; }
      setText("");
      setThread({ id: r.id, prompt });
    });
  };

  return (
    <>
      {open && (
        <aside className="ay-panel" role="dialog" aria-label={a.open}>
          <header className="ay-head">
            <button type="button" className="sdr-icon-btn" aria-label={P.newChat} title={P.newChat} onClick={() => setThread(null)} disabled={!thread}><Plus /></button>
            <span className="ay-spacer" />
            {thread && <Link className="sdr-icon-btn" href={`/search/${thread.id}`} aria-label={P.full} title={P.full} onClick={() => setOpen(false)}><Maximize2 /></Link>}
            <button type="button" className="sdr-icon-btn" aria-label={t.common.close} onClick={() => setOpen(false)}><X /></button>
          </header>
          {thread ? (
            <div className="ay-thread chat-view">
              <AgentThread key={thread.id} strategyId={thread.id} initial={[]} cards={{}} plan={{ label: "", canUpgrade: false }} autoSend={thread.prompt} />
            </div>
          ) : (
            <div className="ay-home">
              <div className="ay-hero"><YoliasMark size={56} className="ay-logo" /><h2>{P.title}</h2><p>{a.hint}</p></div>
              <div className="ay-input">
                <textarea ref={box} rows={3} dir="auto" maxLength={4000} value={text} placeholder={a.placeholder} onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                <button type="button" className="ay-send" aria-label={a.send} disabled={pending || !text.trim()} onClick={() => send()}>{pending ? <Loader2 className="spin" /> : <ArrowUp />}</button>
              </div>
              <ul className="ay-suggest">
                {P.suggestions.map((s) => <li key={s}><button type="button" disabled={pending} onClick={() => send(s)}><MessageSquareText />{s}</button></li>)}
              </ul>
              {/* The same conversations as the sidebar's Yolias AI (owner, 2026-11-05). */}
              {chats.length > 0 && (
                <div className="ay-chats">
                  <h3>{t.nav.recentStrategy}</h3>
                  {chats.slice(0, 6).map((c) => <Link key={c.id} href={`/search/${c.id}`} dir="auto" onClick={() => setOpen(false)}>{c.title}</Link>)}
                </div>
              )}
            </div>
          )}
        </aside>
      )}
      {!open && <div className="ask-yolias"><button type="button" className="ask-fab" aria-expanded={open} onClick={() => setOpen(true)}><MessageSquareText /><span>{t.nav.yoliasAi}</span></button></div>}
    </>
  );
}
