import "server-only";

// Facebook page, Instagram account and WhatsApp number of a company or local
// business, read from the links on its own website's home page (D-161).
// Only what the site itself links to; nothing is guessed. One request, short
// timeout, public hosts only; any failure just means "not found".

export interface Socials {
  facebookUrl: string | null;
  instagramUrl: string | null;
  whatsapp: string | null;
}

const NONE: Socials = { facebookUrl: null, instagramUrl: null, whatsapp: null };
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
  for (const m of html.matchAll(/href\s*=\s*["']([^"'<>]{4,500})["']/gi)) {
    const raw = m[1].trim().replace(/&amp;/g, "&");
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
    if (out.facebookUrl && out.instagramUrl && out.whatsapp) break;
  }
  return out;
}

/** The social profiles a company's website links to. */
export async function findSocials(website: string | null | undefined): Promise<Socials> {
  const url = website ? publicUrl(website) : null;
  if (!url) return NONE;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; YoliasBot/1.0; +https://www.yolias.com)", Accept: "text/html" },
    });
    if (!res.ok || !/text\/html/i.test(res.headers.get("content-type") ?? "")) return NONE;
    const html = (await res.text()).slice(0, MAX_HTML);
    return socialsFromHtml(html, res.url || url.toString());
  } catch {
    return NONE;
  }
}
