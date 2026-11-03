// GEO tracking (D-277): reads one AI answer and says whether Yolias is in it,
// whether it is the first brand recommended, whether yolias.com is cited,
// and which competitors appear (in the order they first appear).

export const OWN_BRAND = "Yolias";
const OWN_DOMAIN = "yolias.com";

export interface Brand {
  name: string;
  website?: string | null;
}

export interface Analysis {
  mentioned: boolean;
  firstPick: boolean;
  cited: boolean;
  brands: string[];
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Names a brand is written as: "Apollo.io" is also "Apollo". */
export function aliases(b: Brand): string[] {
  const out = new Set([b.name]);
  const bare = b.name.replace(/\.(io|com|ai|co|net)$/i, "");
  if (bare.length >= 4) out.add(bare);
  if (b.name === OWN_BRAND) out.add("يولياس");
  return [...out];
}

/** Where a brand first appears in the text, or -1. Case-sensitive so "Clay" or "Hunter" don't match ordinary words. */
export function firstIndex(text: string, b: Brand): number {
  let best = -1;
  for (const a of aliases(b)) {
    // Latin names need word edges; Arabic letters have no \b in JS regex.
    const re = /^[\x00-\x7F]+$/.test(a) ? new RegExp(`(^|[^A-Za-z0-9])${escape(a)}(?![A-Za-z0-9])`) : new RegExp(escape(a));
    const m = re.exec(text);
    if (!m) continue;
    const at = m.index + (m[1]?.length ?? 0);
    if (best < 0 || at < best) best = at;
  }
  return best;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return url.toLowerCase().replace(/^www\./, "");
  }
}

export function analyze(answer: string, citations: string[], competitors: Brand[]): Analysis {
  const all: Brand[] = [{ name: OWN_BRAND, website: `https://${OWN_DOMAIN}` }, ...competitors.filter((c) => c.name !== OWN_BRAND)];
  const found = all
    .map((b) => ({ name: b.name, at: firstIndex(answer, b) }))
    .filter((b) => b.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((b) => b.name);
  const cited = citations.some((u) => {
    const h = hostOf(u);
    return h === OWN_DOMAIN || h.endsWith(`.${OWN_DOMAIN}`);
  }) || /\byolias\.com\b/i.test(answer);
  return { mentioned: found.includes(OWN_BRAND), firstPick: found[0] === OWN_BRAND, cited, brands: found };
}

export interface AnswerRow {
  engine: string;
  mentioned: boolean | null;
  first_pick: boolean | null;
  cited: boolean | null;
  brands: string[];
}

export interface Rates {
  answers: number;
  mentionRate: number | null;
  citationRate: number | null;
  firstRate: number | null;
  /** Share of all brand mentions, Yolias included, largest first. */
  share: { name: string; mentions: number; share: number }[];
}

export function rates(rows: AnswerRow[]): Rates {
  const n = rows.length;
  const pct = (k: number) => (n ? k / n : null);
  const counts = new Map<string, number>();
  for (const r of rows) for (const b of r.brands ?? []) counts.set(b, (counts.get(b) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return {
    answers: n,
    mentionRate: pct(rows.filter((r) => r.mentioned).length),
    citationRate: pct(rows.filter((r) => r.cited).length),
    firstRate: pct(rows.filter((r) => r.first_pick).length),
    share: [...counts.entries()].map(([name, mentions]) => ({ name, mentions, share: total ? mentions / total : 0 })).sort((a, b) => b.mentions - a.mentions),
  };
}
