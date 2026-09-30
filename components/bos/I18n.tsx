"use client";

import { createContext, Fragment, useCallback, useContext, useEffect, type ReactNode } from "react";
import { translate, dirFor, type BosLocale, type TFn } from "@/lib/bos/i18n/core";

const LocaleContext = createContext<BosLocale>("ar");

// Provides the interface language to client components and keeps <html>
// lang/dir in sync inside the admin (docs/bos/30 §4).
export function I18nProvider({ locale, children }: { locale: BosLocale; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirFor(locale);
  }, [locale]);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): BosLocale {
  return useContext(LocaleContext);
}

export function useT(): TFn {
  const locale = useLocale();
  return useCallback((text, vars) => translate(locale, text, vars), [locale]);
}

// Translates a plain string child; anything else renders unchanged. Usable
// from server components, so shared UI can translate the labels it gets.
// With vars, "{name}" placeholders are filled with the given values, which
// may be elements (e.g. <Money/>): <Tx vars={{ n: count }}>{"{n} موظف"}</Tx>.
export function Tx({ children, vars }: { children?: ReactNode; vars?: Record<string, ReactNode> }) {
  const t = useT();
  if (typeof children !== "string") return <>{children}</>;
  if (!vars) return <>{t(children)}</>;
  const parts = t(children).split(/\{(\w+)\}/);
  return <>{parts.map((part, i) => (i % 2 ? <Fragment key={i}>{part in vars ? vars[part] : `{${part}}`}</Fragment> : part))}</>;
}

// <option> with a translated label (options may only contain text).
export function Opt({ children, suffix, ...rest }: React.OptionHTMLAttributes<HTMLOptionElement> & { children: string; suffix?: string }) {
  const t = useT();
  return <option {...rest}>{suffix ? `${t(children)} — ${suffix}` : t(children)}</option>;
}

// SVG <title> may hold a single text node only: translate the parts and join
// them into one string (several <Tx> children break hydration).
export function SvgTitle({ parts, suffix = "" }: { parts: string[]; suffix?: string }) {
  const t = useT();
  return <title>{parts.map((p) => t(p)).join(" · ") + suffix}</title>;
}
