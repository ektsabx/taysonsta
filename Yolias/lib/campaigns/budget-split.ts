// A new budget period split between a campaign's audiences by the optimizer's shares (D-274; pure, unit-tested).

export function splitPeriod(perPeriod: number, groups: { id: string; share: number | null }[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!groups.length || perPeriod <= 0) return out;
  const set = groups.every((g) => g.share != null);
  const shares = set ? groups.map((g) => Math.max(0, g.share!)) : groups.map(() => 1 / groups.length);
  const sum = shares.reduce((a, b) => a + b, 0);
  if (sum <= 0) return out;
  groups.forEach((g, i) => { const n = Math.floor((perPeriod * shares[i]) / sum); if (n > 0) out.set(g.id, n); });
  return out;
}
