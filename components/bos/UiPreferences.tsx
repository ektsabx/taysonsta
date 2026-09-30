"use client";

import { useTransition } from "react";
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
