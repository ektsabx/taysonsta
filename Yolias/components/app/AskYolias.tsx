"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, Loader2, Sparkles, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { useToast } from "@/components/Toast";
import { createStrategy } from "@/app/(app)/actions";

// Yolias AI on every screen (owner, 2026-10-31, D-270): a button that opens a
// short box. What is typed goes to Yolias AI exactly as from its own page
// (createStrategy: a question or an action becomes a conversation, a request
// for new customers becomes a search), and the answer opens there. Hidden on
// Yolias AI's own pages, where the box is already on screen.

export function AskYolias() {
  const { t } = useI18n();
  const a = t.camp.ai;
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (open) box.current?.focus(); }, [open]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  if (pathname === "/" || pathname.startsWith("/search/")) return null;

  const send = () => {
    const prompt = text.trim();
    if (!prompt) return;
    start(async () => {
      const fd = new FormData();
      fd.set("prompt", prompt);
      const r = await callAction(() => createStrategy(fd));
      if (isNetworkFailure(r)) { toast(t.feedback.errors.network, "error"); return; }
      if (!r.ok) { toast(r.error, "error"); return; }
      setOpen(false);
      setText("");
      router.push(`/search/${r.id}`);
    });
  };

  return (
    <div className="ask-yolias">
      {open && (
        <div className="ask-panel" role="dialog" aria-label={a.open}>
          <div className="ask-head"><Sparkles /><strong>Yolias AI</strong><button type="button" className="ask-x" aria-label={t.common.close} onClick={() => setOpen(false)}><X /></button></div>
          <p className="ask-hint">{a.hint}</p>
          <div className="ask-input">
            <textarea ref={box} rows={3} dir="auto" maxLength={4000} value={text} placeholder={a.placeholder} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button type="button" className="ask-send" aria-label={a.send} disabled={pending || !text.trim()} onClick={send}>{pending ? <Loader2 className="spin" /> : <ArrowUp />}</button>
          </div>
        </div>
      )}
      <button type="button" className="ask-fab" aria-expanded={open} onClick={() => setOpen((o) => !o)}><Sparkles /><span>{a.open}</span></button>
    </div>
  );
}
