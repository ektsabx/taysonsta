/** Plan changes (audit, 2026-11-10): the share of `amount` still unused at `now` in [start, end], to the cent. */
export function prorate(amount: number, start: number, end: number, now: number): number {
  if (!(end > start) || now >= end) return 0;
  const left = Math.min(1, (end - Math.max(now, start)) / (end - start));
  return Math.floor(amount * left * 100) / 100;
}
