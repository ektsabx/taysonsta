import "server-only";

// Public email, LinkedIn company page, phone, Facebook page and Instagram
// account of a company or local business, read from the links on its own website
// (D-161, D-163): the home page, and its contact page when the home page has
// no email. Only what the site itself links to; nothing is guessed. Short
// timeouts, public hosts only; any failure just means "not found".
// WhatsApp numbers are not collected (owner decision 2026-10-13, D-201).

export interface Socials {
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  email: string | null;
  phone: string | null;
}

const NONE: Socials = { facebookUrl: null, instagramUrl: null, linkedinUrl: null, email: null, phone: null };
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
// Placeholder and service addresses that aren't the business's own inbox.
const NOT_CONTACT = /^(noreply|no-reply|donotreply|example|test|email|user|name|you|your)@|@(example\.|sentry|wixpress|domain\.)/i;
const PREFERRED = /^(info|contact|hello|sales|support|office|admin|enquiries|inquiries)@/i;
const MAX_HTML = 1_500_000;
const FB_SKIP = new Set(["sharer", "sharer.php", "share", "share.php", "dialog", "plugins", "tr", "login", "login.php", "groups", "events", "watch", "photo", "photo.php", "story.php", "hashtag", "help", "policies", "privacy", "legal", "business", "ads", "pages", "home.php", "l.php"]);
const IG_SKIP = new Set(["p", "reel", "reels", "explore", "accounts", "stories", "tv", "direct", "about", "legal", "developer"]);

/** A host that is safe to fetch: a public domain name, not an IP or an internal name. */
function publicUrl(site: string): URL | null {
  try {
    const u = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`);
    if (!/^https?:$/.test(u.protocol) || u.username || u.password || (u.port && u.port !== "443" && u.port !== "80")) return null;
    const host = u.hostname.toLowerCase();
    if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") || /(^|\.)(localhost|local|internal|lan|home|corp)$/.test(host)) return null;
    return u;
  } catch {
    return null;
  }
}

export function socialsFromHtml(html: string, base: string): Socials {
  const out: Socials = { ...NONE };
  const emails: string[] = [];
  for (const m of html.matchAll(/href\s*=\s*["']([^"'<>]{4,500})["']/gi)) {
    const raw = m[1].trim().replace(/&amp;/g, "&");
    if (/^mailto:/i.test(raw)) {
      const e = decodeURIComponent(raw.slice(7).split("?")[0]).trim().toLowerCase();
      if (EMAIL.test(e) && !NOT_CONTACT.test(e) && e.length <= 254) emails.push(e);
      continue;
    }
    if (/^tel:/i.test(raw)) {
      const t = decodeURIComponent(raw.slice(4)).replace(/[^\d+]/g, "");
      if (!out.phone && t.replace(/\D/g, "").length >= 6 && t.length <= 20) out.phone = t;
      continue;
    }
    let u: URL;
    try {
      u = new URL(raw, base);
    } catch {
      continue;
    }
    const host = u.hostname.toLowerCase().replace(/^(www|m|web|mobile|business)\./, "");
    const seg = u.pathname.split("/").filter(Boolean);
    if (!out.facebookUrl && (host === "facebook.com" || host === "fb.com")) {
      const id = seg[0] === "profile.php" ? u.searchParams.get("id") : null;
      if (id && /^\d+$/.test(id)) out.facebookUrl = `https://www.facebook.com/profile.php?id=${id}`;
      else if (seg[0] && !FB_SKIP.has(seg[0].toLowerCase()) && /^[\w.\-]{2,100}$/.test(seg[0])) out.facebookUrl = `https://www.facebook.com/${seg[0]}`;
    } else if (!out.instagramUrl && host === "instagram.com") {
      if (seg[0] && !IG_SKIP.has(seg[0].toLowerCase()) && /^[\w.]{1,30}$/.test(seg[0])) out.instagramUrl = `https://www.instagram.com/${seg[0]}`;
    } else if (!out.linkedinUrl && host === "linkedin.com" && (seg[0] === "company" || seg[0] === "school") && seg[1] && /^[\w.\-%]{2,100}$/.test(seg[1])) {
      out.linkedinUrl = `https://www.linkedin.com/${seg[0]}/${seg[1]}`;
    }
  }
  out.email = emails.find((e) => PREFERRED.test(e)) ?? emails[0] ?? null;
  return out;
}

/** The site's contact page, if the home page links to one. */
function contactPage(html: string, base: string): string | null {
  for (const m of html.matchAll(/href\s*=\s*["']([^"'<>]{1,300})["']/gi)) {
    if (!/contact|اتصل|تواصل/i.test(m[1])) continue;
    try {
      const u = new URL(m[1].trim(), base);
      if (u.hostname === new URL(base).hostname && /^https?:$/.test(u.protocol)) return u.toString();
    } catch {
      continue;
    }
  }
  return null;
}

async function page(url: string | URL): Promise<{ html: string; url: string } | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; YoliasBot/1.0; +https://www.yolias.com)", Accept: "text/html" },
    });
    if (!res.ok || !/text\/html/i.test(res.headers.get("content-type") ?? "")) return null;
    return { html: (await res.text()).slice(0, MAX_HTML), url: res.url || url.toString() };
  } catch {
    return null;
  }
}

const ent = (v: string) => v.replace(/\u2014/g, "-").replace(/&mdash;/g, "-").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const meta = (html: string, key: string) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${key}["'][^>]*>`, "i"))?.[0];
  return m ? ent(m.match(/content\s*=\s*["']([^"']*)["']/i)?.[1] ?? "").trim() || null : null;
};

/**
 * The business's own name and description as its home page states them
 * (og:site_name, then the title without the page part), for datasets that
 * only have a domain (D-248). Null when the page doesn't say.
 */
export function siteFactsFromHtml(html: string): { name: string | null; description: string | null } {
  const title = ent(html.match(/<title[^>]*>([\s\S]{1,300}?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const fromTitle = title.split(/\s[|\-–:·•]\s/).map((x) => x.trim()).filter((x) => x.length >= 2).sort((a, b) => a.length - b.length)[0] ?? null;
  const name = (meta(html, "og:site_name") ?? fromTitle)?.slice(0, 120) ?? null;
  const description = (meta(html, "description") ?? meta(html, "og:description"))?.slice(0, 500) ?? null;
  return { name: name && !/^(home|homepage|welcome|index|الرئيسية|الصفحة الرئيسية)$/i.test(name) ? name : null, description };
}

/** The social profiles and public contact details a company's website links to. */
export async function findSocials(website: string | null | undefined): Promise<Socials> {
  return (await readSite(website)) ?? NONE;
}

/** findSocials plus the name and description the home page states. */
export async function readSite(website: string | null | undefined): Promise<(Socials & { name: string | null; description: string | null }) | null> {
  const url = website ? publicUrl(website) : null;
  if (!url) return null;
  const home = await page(url);
  if (!home) return null;
  const facts = siteFactsFromHtml(home.html);
  const found = { ...socialsFromHtml(home.html, home.url), ...facts };
  if (found.email && found.phone) return found;
  const contact = contactPage(home.html, home.url);
  const more = contact ? await page(contact) : null;
  if (!more) return found;
  const extra = socialsFromHtml(more.html, more.url);
  return {
    facebookUrl: found.facebookUrl ?? extra.facebookUrl, instagramUrl: found.instagramUrl ?? extra.instagramUrl, linkedinUrl: found.linkedinUrl ?? extra.linkedinUrl,
    email: found.email ?? extra.email, phone: found.phone ?? extra.phone, name: facts.name, description: facts.description,
  };
}
