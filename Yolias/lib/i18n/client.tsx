"use client";

import { createContext, useContext } from "react";
import { dictionaries, dirOf, type Dictionary, type Locale } from "./config";

const I18nContext = createContext<{ locale: Locale; t: Dictionary }>({ locale: "en", t: dictionaries.en });

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, t: dictionaries[locale] }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  return { ...ctx, dir: dirOf(ctx.locale) };
}
