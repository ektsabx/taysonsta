// Sending-domain check (owner, 2026-10-28): before a campaign goes out from a
// mailbox, say whether its domain publishes SPF, DKIM and DMARC. Without them
// mail providers send campaign emails to spam and the member thinks Yolias
// doesn't work. Public DNS only (DNS over HTTPS), nothing is stored, no key.
// DKIM keys live under a selector the provider picks; the common ones are
// tried, so "not found" for DKIM means "not under a known selector".

export type CheckState = "ok" | "missing" | "unknown";
export interface DomainCheck { domain: string; shared: boolean; spf: CheckState; dkim: CheckState; dmarc: CheckState; dmarcPolicy: string | null }

/** Free mailbox domains: the provider signs and publishes everything itself. */
const SHARED = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "me.com", "proton.me", "protonmail.com", "zoho.com", "yandex.com", "aol.com"]);
const SELECTORS = ["google", "selector1", "selector2", "default", "dkim", "mail", "k1", "s1", "s2", "smtp", "zoho", "zmail", "hostingermail1", "hostingermail2", "mxvault", "titan1", "resend", "k2", "k3", "sig1", "x"];
const DOH = "https://cloudflare-dns.com/dns-query";

async function txt(name: string): Promise<string[] | null> {
  try {
    const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=TXT`, { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { Status: number; Answer?: { type: number; data: string }[] };
    if (j.Status !== 0 && j.Status !== 3) return null; // 3 = no such name
    // TXT answers come quoted, sometimes split in several strings.
    return (j.Answer ?? []).filter((a) => a.type === 16).map((a) => a.data.replace(/"\s+"/g, "").replace(/^"|"$/g, ""));
  } catch {
    return null;
  }
}

const cache = new Map<string, { at: number; v: DomainCheck }>();

export async function checkDomain(domain: string): Promise<DomainCheck> {
  const d = domain.trim().toLowerCase();
  if (SHARED.has(d)) return { domain: d, shared: true, spf: "ok", dkim: "ok", dmarc: "ok", dmarcPolicy: null };
  const hit = cache.get(d);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.v;
  const [spf, dmarc, ...dkim] = await Promise.all([txt(d), txt(`_dmarc.${d}`), ...SELECTORS.map((s) => txt(`${s}._domainkey.${d}`))]);
  const state = (rows: string[] | null, test: (v: string) => boolean): CheckState => (rows == null ? "unknown" : rows.some(test) ? "ok" : "missing");
  const dmarcRow = dmarc?.find((v) => /^v=DMARC1/i.test(v)) ?? null;
  const v: DomainCheck = {
    domain: d, shared: false,
    spf: state(spf, (v) => /^v=spf1\b/i.test(v)),
    dmarc: state(dmarc, (v) => /^v=DMARC1/i.test(v)),
    dkim: dkim.some((r) => r?.some((v) => /v=DKIM1|(^|;\s*)p=/i.test(v))) ? "ok" : dkim.every((r) => r == null) ? "unknown" : "missing",
    dmarcPolicy: dmarcRow?.match(/;\s*p=([a-z]+)/i)?.[1]?.toLowerCase() ?? null,
  };
  cache.set(d, { at: Date.now(), v });
  return v;
}
