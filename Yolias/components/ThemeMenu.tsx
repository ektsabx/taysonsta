"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { THEME_COOKIE, type ThemePref } from "@/lib/theme";

function saveThemeCookie(v: ThemePref) {
  document.cookie = `${THEME_COOKIE}=${v}; path=/; max-age=31536000; samesite=lax`;
}

// Theme switcher in the header, next to the language menu and built the same
// way (quiet trigger + small popover with a check). Applies at once, then
// saves the choice (cookie, and the profile when signed in).
export function ThemeMenu({ align = "end" }: { align?: "start" | "end" }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePref>("dark");
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"), []);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const choose = (next: ThemePref) => {
    setOpen(false);
    if (next === theme) return;
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    saveThemeCookie(next);
    start(async () => {
      await fetch("/api/theme", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme: next }) }).catch(() => null);
      router.refresh();
    });
  };
  const Icon = theme === "light" ? Sun : Moon;
  const labels = t.settings.general;

  return (
    <div className={`lang-menu${open ? " open" : ""}`} ref={ref}>
      <button type="button" className="lang-trigger" aria-haspopup="menu" aria-expanded={open} aria-label={labels.theme} onClick={() => setOpen((o) => !o)}>
        <Icon className="lang-globe" />
        <span>{labels[theme]}</span>
        <ChevronDown className="lang-chevron" />
      </button>
      {open && (
        <div className={`lang-popover ${align}`} role="menu">
          {(["light", "dark"] as const).map((v) => (
            <button key={v} type="button" role="menuitemradio" aria-checked={v === theme} className="lang-option" onClick={() => choose(v)}>
              <span>{labels[v]}</span>
              {v === theme && <Check />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
