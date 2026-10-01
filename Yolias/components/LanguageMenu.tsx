"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { LOCALE_COOKIE, locales, type Locale } from "@/lib/i18n/config";

// Language switcher (Claude-style): quiet trigger with globe + current
// language, small popover with a check next to the active option.
export function LanguageMenu({ align = "end" }: { align?: "start" | "end" }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (l: Locale) => {
    setOpen(false);
    if (l === locale) return;
    start(async () => {
      const res = await fetch("/api/locale", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: l }),
      }).catch(() => null);
      // The cookie is the source of truth; set it here too in case the request failed.
      if (!res?.ok) document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    });
  };

  return (
    <div className={`lang-menu${open ? " open" : ""}`} ref={ref}>
      <button
        type="button"
        className="lang-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.language.label}
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
      >
        <Globe className="lang-globe" />
        <span>{t.language[locale]}</span>
        <ChevronDown className="lang-chevron" />
      </button>
      {open && (
        <div className={`lang-popover ${align}`} role="menu">
          {locales.map((l) => (
            <button key={l} type="button" role="menuitemradio" aria-checked={l === locale} className="lang-option" onClick={() => choose(l)} lang={l}>
              <span>{t.language[l]}</span>
              {l === locale && <Check />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
