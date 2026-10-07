import "server-only";

// Facebook page, Instagram account, WhatsApp number, public email and phone
// of a company or local business, read from the links on its own website
// (D-161, D-163): the home page, and its contact page when the home page has
// no email. Only what the site itself links to; nothing is guessed. Short
// timeouts, public hosts only; any failure just means "not found".

export interface Socials {
  facebookUrl: string | null;
  instagramUrl: string | null;
  whatsapp: string | null;
  email: string | null;
  phone: string | null;
}

const NONE: Socials = { facebookUrl: null, instagramUrl: null, whatsapp: null, email: null, phone: null };
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
    if (!out.whatsapp && /^whatsapp:/i.test(raw)) {
      const n = new URLSearchParams(raw.split("?")[1] ?? "").get("phone")?.replace(/\D/g, "");
      if (n && n.length >= 6 && n.length <= 20) out.whatsapp = n;
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
    } else if (!out.whatsapp && (host === "wa.me" || host === "api.whatsapp.com" || host === "whatsapp.com")) {
      const n = (host === "wa.me" ? seg[0] : u.searchParams.get("phone"))?.replace(/\D/g, "");
      if (n && n.length >= 6 && n.length <= 20) out.whatsapp = n;
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

/** The social profiles and public contact details a company's website links to. */
export async function findSocials(website: string | null | undefined): Promise<Socials> {
  const url = website ? publicUrl(website) : null;
  if (!url) return NONE;
  const home = await page(url);
  if (!home) return NONE;
  const found = socialsFromHtml(home.html, home.url);
  if (found.email && found.phone) return found;
  const contact = contactPage(home.html, home.url);
  const more = contact ? await page(contact) : null;
  if (!more) return found;
  const extra = socialsFromHtml(more.html, more.url);
  return {
    facebookUrl: found.facebookUrl ?? extra.facebookUrl, instagramUrl: found.instagramUrl ?? extra.instagramUrl, whatsapp: found.whatsapp ?? extra.whatsapp,
    email: found.email ?? extra.email, phone: found.phone ?? extra.phone,
  };
}
