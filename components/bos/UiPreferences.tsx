"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { setUiPreferenceAction } from "@/app/admin/_actions/preferences";
import { useT, Tx } from "@/components/bos/I18n";
import type { BosLocale, BosTheme } from "@/lib/bos/i18n/core";

// Language + theme switches (profile menu, sign-in page, profile page).
export function UiPreferenceSwitches({ locale, theme, compact }: { locale: BosLocale; theme: BosTheme; compact?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (v: { language?: string; theme?: string }) => start(async () => { await setUiPreferenceAction(v); router.refresh(); });
  const themes: { key: BosTheme; label: string }[] = [
    { key: "dark", label: t("داكن") },
    { key: "light", label: t("فاتح") },
    { key: "system", label: t("حسب النظام") },
  ];
  return (
    <div className={`bos-ui-prefs${compact ? " compact" : ""}`} aria-busy={pending}>
      <div className="bos-seg" role="group" aria-label={t("اللغة")}>
        <button type="button" className={locale === "ar" ? "on" : ""} disabled={pending} onClick={() => set({ language: "ar" })} lang="ar"><Tx>العربية</Tx></button>
        <button type="button" className={locale === "en" ? "on" : ""} disabled={pending} onClick={() => set({ language: "en" })} lang="en">English</button>
      </div>
      <div className="bos-seg" role="group" aria-label={t("المظهر")}>
        {themes.map((th) => (
          <button key={th.key} type="button" className={theme === th.key ? "on" : ""} disabled={pending} onClick={() => set({ theme: th.key })}><Tx>{th.label}</Tx></button>
        ))}
      </div>
    </div>
  );
}

// Header buttons (docs/bos/35 B3): language and theme each open a small menu,
// outside the user card. Saved through the same preference action.
function HeaderMenu({ label, icon, options, value, onPick, pending }: {
  label: string; icon: ReactNode; options: { key: string; label: string; lang?: string }[]; value: string; onPick: (k: string) => void; pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className="bos-hmenu" ref={ref}>
      <button type="button" className="admin-icon-btn bos-hmenu-btn" aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label} disabled={pending} onClick={() => setOpen((v) => !v)}>
        {icon}
      </button>
      {open ? (
        <div className="bos-hmenu-list" role="menu" aria-label={label}>
          {options.map((o) => (
            <button key={o.key} type="button" role="menuitemradio" aria-checked={value === o.key} lang={o.lang} className={value === o.key ? "on" : undefined} onClick={() => { setOpen(false); if (o.key !== value) onPick(o.key); }}>
              <span className="bos-hmenu-check" aria-hidden>{value === o.key ? "✓" : ""}</span>{o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HeaderUiMenus({ locale, theme }: { locale: BosLocale; theme: BosTheme }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (v: { language?: string; theme?: string }) => start(async () => { await setUiPreferenceAction(v); router.refresh(); });
  const sun = <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
  const moon = <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
  const monitor = <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>;
  return (
    <div className="bos-row" style={{ gap: 4 }}>
      <HeaderMenu
        label={t("اللغة")}
        icon={<span className="bos-hmenu-lang">{locale === "en" ? "EN" : "ع"}</span>}
        value={locale}
        pending={pending}
        options={[{ key: "ar", label: "العربية", lang: "ar" }, { key: "en", label: "English", lang: "en" }]}
        onPick={(k) => set({ language: k })}
      />
      <HeaderMenu
        label={t("المظهر")}
        icon={theme === "light" ? sun : theme === "dark" ? moon : monitor}
        value={theme}
        pending={pending}
        options={[{ key: "light", label: t("فاتح") }, { key: "dark", label: t("داكن") }, { key: "system", label: t("حسب النظام") }]}
        onPick={(k) => set({ theme: k })}
      />
    </div>
  );
}
