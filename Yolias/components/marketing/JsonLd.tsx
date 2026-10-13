import { jsonLd } from "@/lib/seo";

/** schema.org structured data for the page (built in lib/seo.ts from what the page shows). */
export function JsonLd({ nodes }: { nodes: Record<string, unknown>[] }) {
  if (!nodes.length) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(...nodes) }} />;
}
