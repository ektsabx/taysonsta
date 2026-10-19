import { affiliatesPage } from "@/lib/content/affiliates-page";
import { en } from "@/lib/i18n/dictionaries/en";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { fmt, type Locale } from "@/lib/i18n/config";
import type { Block } from "@/lib/content/types";
import { commissionLabel, formatCents, type ProgramSettings } from "./program";

/** Live program numbers for the {placeholders} of the partner terms (/partners/terms, the AI knowledge feed). */
export function termsValues(s: ProgramSettings | undefined, locale: Locale): Record<string, string> {
  if (!s) return {};
  const n = (v: number) => new Intl.NumberFormat("en-US").format(v);
  const days = (d: number) => (locale === "ar" ? `${n(d)} يومًا` : `${n(d)} days`);
  const facts = affiliatesPage[locale].facts;
  const link = (locale === "ar" ? ar : en).affiliate.link;
  return {
    rate: commissionLabel(s, formatCents),
    recurring: !s.recurring.enabled ? facts.firstOnly : s.recurring.maxPayments ? fmt(facts.recurringFor, { count: n(s.recurring.maxPayments) }) : facts.recurringAlways,
    hold: days(s.holdDays),
    minPayout: formatCents(s.minPayoutCents),
    window: days(s.attribution.days),
    model: s.attribution.model === "last_touch" ? link.lastTouch : link.firstTouch,
  };
}

export function fillBlocks(blocks: Block[], values: Record<string, string>): Block[] {
  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
  return blocks.map((b) => ("p" in b ? { ...b, p: fill(b.p) } : "ul" in b ? { ...b, ul: b.ul.map(fill) } : b));
}
