"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/client";

// Cloudflare Turnstile widget (lib/auth/captcha.ts verifies its token on the
// server). Usually invisible or a single tap; it adds the hidden
// `cf-turnstile-response` field to the surrounding form. Loaded only on the
// pages that render it.

type TurnstileApi = {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile_unavailable"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** `resetKey`: change it (e.g. the form's last result) to get a fresh token after a failed submit. */
export function Turnstile({ siteKey, resetKey }: { siteKey: string; resetKey?: unknown }) {
  const { locale } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);

  useEffect(() => {
    let gone = false;
    loadTurnstile()
      .then(() => {
        if (gone || !box.current || !window.turnstile) return;
        id.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          theme: "auto",
          size: "flexible",
          language: locale,
          "response-field-name": "cf-turnstile-response",
          "refresh-expired": "auto",
        });
      })
      // The server explains a missing token; the form stays usable (Google sign-up too).
      .catch(() => {});
    return () => {
      gone = true;
      if (id.current) window.turnstile?.remove(id.current);
      id.current = null;
    };
  }, [siteKey, locale]);

  useEffect(() => {
    if (id.current) window.turnstile?.reset(id.current);
  }, [resetKey]);

  return <div ref={box} className="captcha-box" />;
}
