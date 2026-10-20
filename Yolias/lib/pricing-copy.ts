import { fmt, type Dictionary } from "@/lib/i18n/config";

/**
 * The pricing FAQ as shown and as structured data: the free-trial answer
 * says what checkout really offers today (trialDays null = no trial).
 */
export function pricingFaq(t: Dictionary["pricing"], trialDays: number | null): [string, string][] {
  const [q, yes, no] = t.faqTrial;
  const trial: [string, string] = [q, trialDays ? fmt(yes, { days: trialDays }) : no];
  const faq = t.faq as [string, string][];
  return [...faq.slice(0, 2), trial, ...faq.slice(2)];
}
