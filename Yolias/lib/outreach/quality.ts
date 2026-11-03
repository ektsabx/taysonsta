// Pre-send checks (audit, 2026-11-03), pure and shared by the writer:
//  - Freshness: hiring and other signals go stale; a company found more than
//    SIGNAL_DAYS days ago keeps its firmographics but loses its signals and open roles.
//  - Quality: a draft is rejected (the next model tries) when it claims a fact
//    that isn't in the input, shouts, asks too many questions, or is too short
//    or too long to read like a person wrote it.

export const SIGNAL_DAYS = 60;

export function freshSignals<T extends Record<string, unknown>>(company: T, updatedAt: string | null | undefined, now = Date.now()): T {
  if (updatedAt && now - Date.parse(updatedAt) <= SIGNAL_DAYS * 86_400_000) return company;
  const { signals: _s, open_roles: _o, ...rest } = company as Record<string, unknown>;
  void _s; void _o;
  return rest as T;
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
// Arabic words carry prefixes ("ال", "و", "ب", "ل"): compare their stems.
const stem = (w: string) => (w.length >= 5 ? w.replace(/^(وال|بال|لل|ال|و|ب|ل)/u, "") : w);
const significant = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4).map(stem);

export type QualityIssue = "unsupported_fact" | "exclamation" | "questions" | "too_short" | "too_long";

export function draftIssues(body: string, personalizationUsed: string[], facts: unknown): QualityIssue[] {
  const out: QualityIssue[] = [];
  const source = JSON.stringify(facts ?? {}).toLowerCase();
  // A claimed fact must share at least one significant word with the input.
  if (personalizationUsed.some((f) => { const w = significant(f); return w.length > 0 && !w.some((x) => source.includes(x)); })) out.push("unsupported_fact");
  if (/[!！]/.test(body)) out.push("exclamation");
  if ((body.match(/[?؟]/g) ?? []).length > 2) out.push("questions");
  const n = words(body);
  if (n < 12) out.push("too_short");
  if (n > 220) out.push("too_long");
  return out;
}
