// Deal Radar scoring (docs/bos/30 §17). Rule-based and transparent: the
// estimate starts from the stage's probability and every adjustment is a
// named signal with its effect, so the UI can show *why*. Results are
// estimates, rounded to 5 and shown as a band; with too few signals the
// confidence is "low".

export interface DealSignals {
  stageProbability: number;                  // 0–100 from the pipeline stage
  stageKey: string;
  expectedClose: string | null;              // YYYY-MM-DD
  today: string;                             // YYYY-MM-DD
  daysSinceLastActivity: number | null;      // completed activity
  hasNextActivity: boolean;                  // pending activity due in the future
  nextActivityOverdue: boolean;              // pending activity past due
  inboundLast14: boolean;                    // client replied recently
  proposalStatus: string | null;
  contractStatus: string | null;
  openBlockers: number;
  historicStageWinRate: number | null;       // % from ≥ minHistory closed deals, else null
}

export interface Contribution { key: string; label: string; effect: number }

export interface RadarSettings { horizonDays: number; inactivityDays: number; minProbability: number }
export const defaultRadarSettings: RadarSettings = { horizonDays: 30, inactivityDays: 14, minProbability: 40 };

const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400_000);

export function scoreDeal(s: DealSignals, cfg: RadarSettings = defaultRadarSettings) {
  const c: Contribution[] = [];
  const add = (key: string, label: string, effect: number) => c.push({ key, label, effect });
  // Base: historic win rate for this stage when there is enough history, else the stage probability.
  const base = s.historicStageWinRate ?? s.stageProbability;
  if (s.proposalStatus === "accepted") add("proposal_accepted", "العرض مقبول", 15);
  else if (s.proposalStatus === "viewed") add("proposal_viewed", "العميل فتح العرض", 5);
  else if (s.proposalStatus === "rejected") add("proposal_rejected", "العرض مرفوض", -25);
  else if (s.proposalStatus === "expired") add("proposal_expired", "انتهت صلاحية العرض", -10);
  if (s.contractStatus === "partially_signed") add("contract_partial", "العقد موقّع جزئياً", 15);
  else if (s.contractStatus === "viewed") add("contract_viewed", "العميل فتح العقد", 10);
  else if (s.contractStatus === "sent") add("contract_sent", "العقد مُرسل", 8);
  if (s.inboundLast14) add("client_replied", "العميل تواصل خلال 14 يوماً", 5);
  if (s.daysSinceLastActivity != null && s.daysSinceLastActivity <= 7) add("recent_activity", "نشاط خلال آخر 7 أيام", 5);
  if (s.daysSinceLastActivity == null) add("no_activity_ever", "لا يوجد أي نشاط مسجل", -10);
  else if (s.daysSinceLastActivity >= 30) add("inactive_30", "بلا نشاط منذ 30 يوماً أو أكثر", -20);
  else if (s.daysSinceLastActivity >= cfg.inactivityDays) add("inactive", "بلا نشاط حديث", -10);
  if (!s.hasNextActivity) add("no_next_step", "لا توجد خطوة تالية مجدولة", -5);
  if (s.nextActivityOverdue) add("followup_overdue", "متابعة متأخرة", -5);
  if (s.openBlockers > 0) add("blockers", "عوائق مفتوحة", -10);
  if (s.expectedClose) {
    const late = daysBetween(s.expectedClose, s.today);
    if (late > 30) add("close_overdue_30", "تجاوز تاريخ الإغلاق المتوقع بأكثر من 30 يوماً", -20);
    else if (late > 0) add("close_overdue", "تجاوز تاريخ الإغلاق المتوقع", -10);
  }
  const raw = base + c.reduce((t, x) => t + x.effect, 0);
  const estimate = Math.max(5, Math.min(95, Math.round(raw / 5) * 5));
  const band = estimate < 35 ? "low" : estimate <= 65 ? "medium" : "high";
  // Confidence: how much evidence beyond the stage itself.
  const evidence = [s.proposalStatus, s.contractStatus, s.daysSinceLastActivity != null ? 1 : null, s.historicStageWinRate].filter((x) => x != null).length;
  const confidence = evidence >= 3 ? "medium" : "low";
  return { estimate, band, confidence, base: Math.round(base), baseSource: s.historicStageWinRate != null ? "history" : "stage", contributions: c };
}

export function radarFlags(s: DealSignals, value: number, interventionValue: number, cfg: RadarSettings = defaultRadarSettings) {
  const closeIn = s.expectedClose ? daysBetween(s.today, s.expectedClose) : null;
  const overdue = closeIn != null && closeIn < 0;
  const nearClosing = s.stageProbability >= cfg.minProbability || (closeIn != null && closeIn >= 0 && closeIn <= cfg.horizonDays);
  const stale = s.daysSinceLastActivity == null || s.daysSinceLastActivity >= cfg.inactivityDays;
  const risky = s.proposalStatus === "rejected" || s.openBlockers > 0 || s.nextActivityOverdue;
  const bigDeal = interventionValue > 0 && value >= interventionValue;
  const intervention = bigDeal && (overdue || stale || risky);
  const followUp = !s.hasNextActivity || s.nextActivityOverdue || (s.proposalStatus === "viewed" && !s.inboundLast14);
  return { nearClosing, overdue, stale, risky, intervention, followUp, closeIn };
}

// Value of the top quartile — used as the intervention threshold when none is configured.
export function topQuartile(values: number[]) {
  if (values.length < 4) return values.length ? Math.max(...values) : 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.75)];
}
