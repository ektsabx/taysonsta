"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { countryLabel } from "@/lib/format";
import { COUNTRIES, timeZoneChoices, timeZoneLabel } from "@/lib/regions";
import { useI18n } from "@/lib/i18n/client";
import { updatePreferences } from "@/app/(app)/settings/actions";
import type { ShellData } from "../types";
import { useSave, applyAppearance, SettingRow } from "./shared";

export function GeneralTab({ data }: { data: ShellData }) {
  const { t, locale } = useI18n();
  const g = t.settings.general;
  const router = useRouter();
  // The language row always reflects the interface language actually shown.
  const [prefs, setPrefs] = useState({ ...data.preferences, language: locale });
  const { error, run } = useSave();

  const change = <K extends keyof typeof prefs>(key: K, value: (typeof prefs)[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    if (key === "theme") applyAppearance(value as string);
    if (key === "text_size") applyAppearance(undefined, value as string);
    run(async () => {
      const r = await updatePreferences({ [key]: value });
      // Language switches the whole interface (and direction).
      if (r.ok && key === "language") router.refresh();
      return r;
    });
  };

  return (
    <div className="setting-group">
      <SettingRow id="theme" label={g.theme} desc={g.themeDesc}>
        <select className="form-select" value={prefs.theme} onChange={(e) => change("theme", e.target.value as typeof prefs.theme)}>
          <option value="light">{g.light}</option>
          <option value="dark">{g.dark}</option>
        </select>
      </SettingRow>
      <SettingRow id="text-size" label={g.textSize} desc={g.textSizeDesc}>
        <select className="form-select" value={prefs.text_size} onChange={(e) => change("text_size", e.target.value as typeof prefs.text_size)}>
          <option value="compact">{g.compact}</option>
          <option value="normal">{g.normal}</option>
          <option value="large">{g.large}</option>
        </select>
      </SettingRow>
      <SettingRow id="language" label={g.languages} desc={g.languagesDesc}>
        <select className="form-select" value={prefs.language} onChange={(e) => change("language", e.target.value as typeof prefs.language)}>
          <option value="en">{t.language.en}</option>
          <option value="ar">{t.language.ar}</option>
        </select>
      </SettingRow>
      <SettingRow id="timezone" label={g.timezone} desc={g.timezoneDesc}>
        <select className="form-select" value={prefs.timezone} onChange={(e) => change("timezone", e.target.value)}>
          {timeZoneChoices(prefs.timezone).map((tz) => <option key={tz} value={tz}>{timeZoneLabel(tz, locale)}</option>)}
        </select>
      </SettingRow>
      <SettingRow id="country" label={g.country} desc={g.countryDesc}>
        <select className="form-select" value={prefs.country} onChange={(e) => change("country", e.target.value)}>
          {COUNTRIES.map((c) => <option key={c} value={c}>{countryLabel(c, locale)}</option>)}
        </select>
      </SettingRow>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

/* ─────────────── Account ─────────────── */
