// What a plan's prospects can bring (owner, 2026-11-02, D-275): pricing cards
// show the people Yolias reaches a month and the range of positive replies
// and booked meetings that usually follow, like "500 emails / month ·
// 26–47 positive replies". The rates are B2B cold-email averages for a
// personal first email with two follow-ups, not a promise: the card says so,
// and results depend on the market and the offer. One place to change them.

/** Share of the people reached who reply with interest. */
export const POSITIVE_REPLY_RATE = { low: 0.015, high: 0.03 } as const;
/** Share of the people reached who book a meeting. */
export const MEETING_RATE = { low: 0.005, high: 0.015 } as const;

export interface Estimate { low: number; high: number }

const range = (people: number, r: { low: number; high: number }): Estimate => ({
  low: Math.max(0, Math.floor(people * r.low)),
  high: Math.max(0, Math.round(people * r.high)),
});

/** Positive replies and booked meetings a month for this many people reached. */
export function planEstimates(peopleReached: number): { replies: Estimate; meetings: Estimate } {
  return { replies: range(peopleReached, POSITIVE_REPLY_RATE), meetings: range(peopleReached, MEETING_RATE) };
}
