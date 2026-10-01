// Identity resolution helpers (docs/04 "Identity resolution"). Pure, so the
// rules are unit-tested: company = eTLD+1 domain → Place ID → LinkedIn;
// person = LinkedIn → company + normalised name → verified email.

// Multi-part public suffixes common in Yolias markets (enough for eTLD+1 here;
// unknown ones fall back to the last two labels).
const multiSuffixes = new Set([
  "co.uk", "org.uk", "ac.uk", "com.au", "co.nz", "co.za", "co.in", "co.jp", "com.br", "com.tr", "com.mx", "com.sg", "com.my",
  "com.sa", "net.sa", "org.sa", "edu.sa", "gov.sa", "med.sa",
  "com.eg", "net.eg", "org.eg", "edu.eg", "gov.eg",
  "co.ae", "net.ae", "org.ae", "gov.ae", "ac.ae",
  "com.qa", "net.qa", "edu.qa", "gov.qa", "com.kw", "net.kw", "org.kw", "edu.kw",
  "com.bh", "net.bh", "org.bh", "com.om", "net.om", "org.om", "co.om",
  "com.jo", "net.jo", "org.jo", "com.lb", "net.lb", "org.lb", "com.ma", "co.ma", "net.ma", "com.tn", "com.dz", "com.iq", "com.ly", "com.sd", "com.ye", "com.ps",
]);

/** "https://www.Shop.Example.com.sa/about" → "example.com.sa". null when it isn't a domain. */
export function registrableDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let host = input.trim().toLowerCase();
  if (!host) return null;
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split(/[/?#]/)[0].split("@").pop()!.split(":")[0];
  host = host.replace(/^www\d*\./, "").replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || /^\d+(\.\d+){3}$/.test(host)) return null;
  const labels = host.split(".");
  const lastTwo = labels.slice(-2).join(".");
  const take = multiSuffixes.has(lastTwo) && labels.length >= 3 ? 3 : 2;
  return labels.slice(-take).join(".");
}

/** Canonical LinkedIn profile/company URL, or null. */
export function linkedinKey(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.trim().toLowerCase().match(/linkedin\.com\/(in|company|school)\/([^/?#]+)/);
  return m ? `linkedin.com/${m[1]}/${decodeURIComponent(m[2]).replace(/\/$/, "")}` : null;
}

/** Lower-case, accents and punctuation removed, Arabic letter variants unified, spaces collapsed. */
export function normalizeName(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟ]/g, "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/**
 * Same person? Exact identifiers win; two different LinkedIn profiles are
 * never the same person even with the same name ⇒ "possible duplicate".
 */
export function personMatch(
  a: { linkedin: string | null; name: string; companyId: string | null; email: string | null },
  b: { linkedin: string | null; name: string; companyId: string | null; email: string | null },
): "same" | "possible_duplicate" | "different" {
  if (a.linkedin && b.linkedin) return a.linkedin === b.linkedin ? "same" : a.name === b.name && a.companyId === b.companyId ? "possible_duplicate" : "different";
  if (a.email && b.email && a.email === b.email) return "same";
  if (a.companyId && a.companyId === b.companyId && a.name && a.name === b.name) return "same";
  return "different";
}

/** Fields worth recording provenance for (value present). */
export function presentFields(obj: Record<string, unknown>, fields: string[]): [string, unknown][] {
  return fields.filter((f) => obj[f] !== null && obj[f] !== undefined && !(Array.isArray(obj[f]) && (obj[f] as unknown[]).length === 0)).map((f) => [f, obj[f]]);
}

/** Older than its TTL (days)? null dates are stale. */
export function isStale(at: string | null | undefined, ttlDays: number, now = new Date()): boolean {
  if (!at) return true;
  return now.getTime() - new Date(at).getTime() > ttlDays * 86_400_000;
}
