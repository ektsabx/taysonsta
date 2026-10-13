// Disposable email domains (sign-up protection, 2026-10-12).
// Source: github.com/disposable-email-domains/disposable-email-domains (CC0),
// the community-maintained list; its allowlist is honoured when published.
//
//   node scripts/disposable-domains.mjs > /tmp/domains.sql
//   npx supabase db query --local -f /tmp/domains.sql      (or --linked, with approval)
//
// Prints SQL that adds new domains to public.blocked_email_domains. It never
// removes rows, so domains the team added by hand (source = 'manual') stay.
const BASE = "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main";
const get = async (f, optional = false) => {
  const r = await fetch(`${BASE}/${f}`, { signal: AbortSignal.timeout(30_000) });
  if (optional && r.status === 404) return [];
  if (!r.ok) throw new Error(`${f}: ${r.status}`);
  return (await r.text()).split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#"));
};
const allow = new Set(await get("allowlist.conf", true));
const domains = [...new Set(await get("disposable_email_blocklist.conf"))].filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) && !allow.has(d)).sort();
if (domains.length < 1000) throw new Error(`only ${domains.length} domains: refusing to print a suspiciously short list`);
const rows = domains.map((d) => `('${d}')`);
const out = [`-- ${domains.length} domains from disposable-email-domains (${new Date().toISOString().slice(0, 10)})`];
for (let i = 0; i < rows.length; i += 1000) {
  out.push(`insert into public.blocked_email_domains (domain) values\n${rows.slice(i, i + 1000).join(",\n")}\non conflict (domain) do nothing;`);
}
process.stdout.write(`${out.join("\n")}\n`);
