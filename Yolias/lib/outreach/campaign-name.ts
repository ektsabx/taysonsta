// Campaign names as shown in tables (owner, 2026-10-21): the short name only.
// The stored name is never changed; the date is shown in its own column.
// "Campaign Oct 19" → "Campaign", "حملة 20 أكتوبر" → "حملة",
// "وكالات التسويق في دبي - وكيل المبيعات بالذكاء الاصطناعي" → "وكالات التسويق في دبي".

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر";
const DATE = new RegExp(`(?:^|[\\s,·-])(?:\\d{1,2}\\s+(?:${MONTHS})|(?:${MONTHS})\\.?\\s+\\d{1,2})(?:,?\\s+\\d{4})?(?=$|[\\s,·-])`, "giu");
const NUMERIC_DATE = /(?:^|\s)\d{1,4}[/.-]\d{1,2}(?:[/.-]\d{1,4})?(?=$|\s)/g;
const AGENT_SUFFIX = /\s+[-–·|:]\s+(?:وكيل المبيعات(?: بالذكاء الاصطناعي)?|yolias ai|ai sales agent|sales agent|yolias)\s*$/iu;

export function shortCampaignName(name: string | null | undefined, max = 40): string {
  let s = (name ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  s = s.replace(AGENT_SUFFIX, "");
  const withoutDate = s.replace(DATE, " ").replace(NUMERIC_DATE, " ").replace(/\s+[-–·|:,]\s*$/u, "").replace(/\s+/g, " ").trim();
  if (withoutDate) s = withoutDate;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
