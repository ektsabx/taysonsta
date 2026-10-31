// The campaign engines (owner, 2026-10-31, D-270): pure functions, no
// database, so they are tested on their own (tests/unit/engines.test.ts).
//
// Rules the owner set and every function keeps:
//  - Nothing is invented. A rate comes from the campaign's own sends, the
//    workspace's history, or shared learning (enough workspaces only). With
//    no data the answer is null, and the screen says "not enough data yet".
//  - A forecast is a range (10th to 90th percentile), never one number, and
//    it is labelled as a forecast, never mixed with actual results.
//  - What is optimised is positive replies and meetings, never opens.

/** Counts behind one rate: how many tried and how many succeeded. */
export interface Counts { n: number; s: number }

/** The funnel counts of a campaign or a workspace. */
export interface FunnelCounts {
  contacted: number;
  positive: number;
  meetings: number;
  held: number;
  qualified: number;
}

/** A prior from shared learning, already scaled to a weight (pseudo-counts). */
export interface Prior { a: number; b: number }

/** Below this many contacted leads a rate is too noisy to plan with. */
export const MIN_CONTACTED = 50;
/** Shared learning counts as this many leads of evidence, so the campaign's own data soon outweighs it. */
export const PRIOR_WEIGHT = 40;

// ---------------------------------------------------------------- random draws

/** A seeded generator (mulberry32): the same inputs always give the same forecast. */
export function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(r: () => number): number {
  const u = Math.max(r(), 1e-12), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Gamma(k, 1) by Marsaglia and Tsang (k < 1 boosted). */
function gamma(k: number, r: () => number): number {
  if (k < 1) return gamma(k + 1, r) * Math.pow(Math.max(r(), 1e-12), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do { x = normal(r); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = r();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** One draw from Beta(a, b). */
export function betaDraw(a: number, b: number, r: () => number): number {
  const x = gamma(a, r), y = gamma(b, r);
  return x / (x + y);
}

// ---------------------------------------------------------------- rates

/** The posterior of a rate: Beta(1 + successes, 1 + failures), plus a prior from shared learning when there is one. */
export function posterior(c: Counts, prior?: Prior | null): Prior {
  return { a: 1 + c.s + (prior?.a ?? 0), b: 1 + Math.max(c.n - c.s, 0) + (prior?.b ?? 0) };
}

export const mean = (p: Prior) => p.a / (p.a + p.b);

/** Shared learning (contacted, positive…) turned into a prior worth PRIOR_WEIGHT leads. */
export function priorFrom(rate: { n: number; s: number } | null | undefined): Prior | null {
  if (!rate || rate.n <= 0) return null;
  const p = rate.s / rate.n;
  return { a: p * PRIOR_WEIGHT, b: (1 - p) * PRIOR_WEIGHT };
}

/** Is there enough evidence (own data, or own + shared) to plan with? */
export function enoughData(f: FunnelCounts, shared: boolean): boolean {
  return shared || (f.contacted >= MIN_CONTACTED && f.positive > 0);
}

// ---------------------------------------------------------------- 1. goal planner

export interface Plan {
  /** People to contact in total to expect the target. */
  contactsNeeded: number;
  /** Per day, over the days left. */
  perDay: number;
  /** The rate used: meetings per contacted lead (posterior mean). */
  meetingRate: number;
}

/**
 * How many people a campaign needs to contact to reach its meeting target,
 * from the meeting rate it actually has (or shared learning). Null without
 * enough data: the planner never guesses a rate.
 */
export function planGoal(target: number, f: FunnelCounts, daysLeft: number, prior: Prior | null = null): Plan | null {
  if (target <= 0 || !enoughData(f, Boolean(prior))) return null;
  const rate = mean(posterior({ n: f.contacted, s: f.meetings }, prior));
  if (rate <= 0) return null;
  const remaining = Math.max(target - f.meetings, 0);
  const contactsNeeded = Math.ceil(remaining / rate);
  return { contactsNeeded, perDay: Math.ceil(contactsNeeded / Math.max(daysLeft, 1)), meetingRate: rate };
}

// ---------------------------------------------------------------- 2. forecast

export interface Forecast { low: number; mid: number; high: number }

/**
 * Meetings to expect from the people still to be contacted, as a range: the
 * meeting rate is uncertain (Beta posterior) and each lead is a coin flip.
 * Seeded, so the page shows the same range on every load.
 */
export function forecastMeetings(f: FunnelCounts, contactsAhead: number, prior: Prior | null = null, draws = 2000, seed = 7): Forecast | null {
  if (!enoughData(f, Boolean(prior))) return null;
  const p = posterior({ n: f.contacted, s: f.meetings }, prior);
  const r = rng(seed);
  const out: number[] = [];
  const ahead = Math.max(0, Math.round(contactsAhead));
  for (let i = 0; i < draws; i++) {
    const q = betaDraw(p.a, p.b, r);
    // Binomial(ahead, q) by its normal approximation (exact enough for a range), floored at 0.
    const m = ahead * q, sd = Math.sqrt(ahead * q * (1 - q));
    out.push(Math.max(0, Math.round(m + sd * normal(r))));
  }
  out.sort((a, b) => a - b);
  const at = (x: number) => out[Math.min(out.length - 1, Math.floor(x * out.length))];
  return { low: f.meetings + at(0.1), mid: f.meetings + at(0.5), high: f.meetings + at(0.9) };
}

// ---------------------------------------------------------------- 3. pace monitor

export type Pace = "no_target" | "not_started" | "unknown" | "behind" | "on_track" | "ahead" | "done";

/**
 * Where the campaign stands against its target at this point of its schedule.
 * "unknown" until it has contacted enough people: early weeks say nothing.
 */
export function pace(input: { target: number | null; meetings: number; contacted: number; startsAt: string | null; endsAt: string | null; now?: Date }): Pace {
  const { target, meetings, contacted } = input;
  if (!target) return "no_target";
  if (meetings >= target) return "done";
  const now = (input.now ?? new Date()).getTime();
  const start = input.startsAt ? Date.parse(input.startsAt) : NaN;
  if (Number.isFinite(start) && now < start) return "not_started";
  if (contacted < MIN_CONTACTED) return "unknown";
  const end = input.endsAt ? Date.parse(input.endsAt) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "unknown";
  const elapsed = Math.min(Math.max((now - start) / (end - start), 0), 1);
  const expected = target * elapsed;
  // A band of one meeting or 20%, whichever is larger, before calling it behind or ahead.
  const band = Math.max(1, expected * 0.2);
  if (meetings < expected - band) return "behind";
  if (meetings > expected + band) return "ahead";
  return "on_track";
}

// ---------------------------------------------------------------- 4. angles (Thompson sampling)

export interface Arm { key: string; n: number; s: number }

/**
 * Which message angle the next lead gets: one draw from each angle's Beta
 * posterior of positive replies, the highest wins. Angles that work get more
 * leads; a new angle still gets tried. Below 20 leads per angle, alternate.
 */
export function pickArm(arms: Arm[], r: () => number = Math.random): string {
  if (arms.length === 1) return arms[0].key;
  const fewest = arms.reduce((a, b) => (b.n < a.n ? b : a));
  if (fewest.n < 20) return fewest.key;
  let best = arms[0].key, top = -1;
  for (const a of arms) {
    const d = betaDraw(1 + a.s, 1 + Math.max(a.n - a.s, 0), r);
    if (d > top) { top = d; best = a.key; }
  }
  return best;
}

// ---------------------------------------------------------------- 5. prospect priority

/**
 * Who to contact first: fit (the match score, 0–100), how fresh a timing
 * signal is (hiring, funding: worth up to +50% when new, half after 14 days),
 * and whether the email is verified. Never contactable → 0.
 */
export function priority(input: { matchScore: number | null; signalAgeDays?: number | null; emailStatus?: string | null; contactable: boolean }): number {
  if (!input.contactable) return 0;
  const fit = Math.min(Math.max(input.matchScore ?? 50, 0), 100) / 100;
  const age = input.signalAgeDays;
  const timing = age == null ? 1 : 1 + 0.5 * Math.pow(0.5, Math.max(age, 0) / 14);
  const reach = input.emailStatus === "verified" || input.emailStatus === "valid" ? 1 : input.emailStatus === "catch_all" || input.emailStatus === "risky" ? 0.6 : 0.8;
  return fit * timing * reach;
}

// ---------------------------------------------------------------- 6. deliverability guard

export interface MailboxHealth { sent: number; bounced: number }
export type Guard = "ok" | "watch" | "pause";

/** Over the last 7 days: bounces above 5% (at 20+ sends) pause the mailbox's campaigns; above 3% is a warning. */
export function guard(h: MailboxHealth): Guard {
  if (h.sent < 20) return "ok";
  const rate = h.bounced / h.sent;
  if (rate > 0.05) return "pause";
  if (rate > 0.03) return "watch";
  return "ok";
}

// ---------------------------------------------------------------- 7. shared learning

export interface LearningRow { industry: string; country: string; aim: string; workspaces: number; contacted: number; positive: number; meetings: number; qualified: number }

/**
 * The most specific shared group for a campaign (industry + country, then
 * industry, then country, then any). Rows already passed the privacy floor
 * (5+ workspaces, 200+ leads) when they were aggregated.
 */
export function sharedFor(rows: LearningRow[], industry: string | null, country: string | null, aim: string): LearningRow | null {
  const i = (industry ?? "").toLowerCase() || "*", c = (country ?? "").toLowerCase() || "*";
  const find = (a: string, b: string) => rows.find((r) => r.aim === aim && r.industry === a && r.country === b) ?? null;
  return find(i, c) ?? find(i, "*") ?? find("*", c) ?? find("*", "*");
}

// ---------------------------------------------------------------- ROI

export interface Roi {
  spendUsd: number;
  revenueUsd: number;
  /** null when nothing was spent. */
  roi: number | null;
  perProspect: number | null;
  perPositive: number | null;
  perMeeting: number | null;
  perQualified: number | null;
}

/** Costs per result and return on spend. A cost is null when its count is 0 (never divided by zero, never invented). */
export function roi(input: { spendUsd: number; revenueUsd: number; prospects: number; positive: number; meetings: number; qualified: number }): Roi {
  const per = (n: number) => (n > 0 && input.spendUsd > 0 ? input.spendUsd / n : null);
  return {
    spendUsd: input.spendUsd, revenueUsd: input.revenueUsd,
    roi: input.spendUsd > 0 ? (input.revenueUsd - input.spendUsd) / input.spendUsd : null,
    perProspect: per(input.prospects), perPositive: per(input.positive), perMeeting: per(input.meetings), perQualified: per(input.qualified),
  };
}
