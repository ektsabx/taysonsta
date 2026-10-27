import { jsonLd, siteUrl } from "@/lib/seo";
import { getLocale } from "@/lib/i18n/server";
import { localizedHref } from "@/lib/i18n/paths";

/**
 * schema.org structured data for the page (built in lib/seo.ts from what the
 * page shows). On an Arabic page the site's own URLs point to the Arabic
 * versions (D-258), so the data matches the page's canonical.
 */
export async function JsonLd({ nodes }: { nodes: Record<string, unknown>[] }) {
  if (!nodes.length) return null;
  const locale = await getLocale();
  const base = siteUrl();
  const localize = (v: unknown): unknown => {
    if (typeof v === "string") {
      if (locale !== "ar" || !v.startsWith(base)) return v;
      const rest = v.slice(base.length) || "/";
      const [path, hash] = rest.split("#");
      return `${base}${localizedHref(path, "ar")}${hash !== undefined ? `#${hash}` : ""}`;
    }
    if (Array.isArray(v)) return v.map(localize);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "@id" && typeof x === "string" && /#(organization|website|software)$/.test(x) ? x : localize(x)]));
    return v;
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(...(nodes.map(localize) as Record<string, unknown>[])) }} />;
}
