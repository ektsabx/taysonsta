// Yolias website content as edited in Yolias Admin (final spec phase 9).
// Mirrors Yolias/lib/content/types.ts (Block, Doc) — keep the two in sync.
// The editor uses simple Markdown; it round-trips to the site's blocks.

export type Block =
  | { h2: string; id?: string }
  | { h3: string }
  | { p: string }
  | { ul: string[] }
  | { ol: string[] }
  | { note: string }
  | { table: { head: string[]; rows: string[][] } }
  /** A real screenshot with numbered markers (x / y in % of the image) explained in the caption. */
  | { figure: { src: string; alt: string; caption?: string; marks?: { x: number; y: number; label: string }[] } };

export interface Doc {
  title: string;
  summary: string;
  blocks: Block[];
}

export const contentKinds = ["help", "docs", "blog", "legal"] as const;
export type ContentKind = (typeof contentKinds)[number];
export const kindLabel: Record<ContentKind, string> = { help: "مركز المساعدة", docs: "التوثيق", blog: "المدونة", legal: "الصفحات القانونية" };

// Ids the site knows (Yolias/lib/content/help.ts collections, docs.ts groups).
export const helpCollections = [
  { id: "getting-started", label: "البداية" },
  { id: "using-yolias", label: "استخدام Yolias AI" },
  { id: "account", label: "الحساب والفريق" },
] as const;
export const docGroups = [
  { id: "start", label: "البداية" },
  { id: "core", label: "المفاهيم الأساسية" },
  { id: "workspace", label: "مساحة العمل" },
] as const;
export const legalSlugs = ["privacy", "terms", "cookies", "security"] as const;

const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function markdownToBlocks(md: string): Block[] {
  const out: Block[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ p: para.join(" ").trim() });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { flush(); continue; }
    if (t.startsWith("### ")) { flush(); out.push({ h3: t.slice(4).trim() }); continue; }
    if (t.startsWith("## ")) { flush(); out.push({ h2: t.slice(3).trim() }); continue; }
    if (t.startsWith("> ")) { flush(); out.push({ note: t.slice(2).trim() }); continue; }
    if (/^[-*] /.test(t)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) items.push(lines[i++].trim().slice(2).trim());
      i--;
      out.push({ ul: items });
      continue;
    }
    if (/^\d+[.)] /.test(t)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)] /.test(lines[i].trim())) items.push(lines[i++].trim().replace(/^\d+[.)] /, "").trim());
      i--;
      out.push({ ol: items });
      continue;
    }
    // ![alt](src "caption") then "@ x% y% label" lines for numbered markers.
    const img = /^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)$/.exec(t);
    if (img) {
      flush();
      const marks: { x: number; y: number; label: string }[] = [];
      while (i + 1 < lines.length && /^@\s+\d/.test(lines[i + 1].trim())) {
        const m = /^@\s+(\d+(?:\.\d+)?)%?\s+(\d+(?:\.\d+)?)%?\s+(.+)$/.exec(lines[++i].trim());
        if (m) marks.push({ x: Number(m[1]), y: Number(m[2]), label: m[3].trim() });
      }
      out.push({ figure: { src: img[2], alt: img[1], ...(img[3] ? { caption: img[3] } : {}), ...(marks.length ? { marks } : {}) } });
      continue;
    }
    if (t.startsWith("|")) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const r = lines[i++].trim();
        if (!/^\|[\s:-]+(\|[\s:-]+)*\|?$/.test(r)) rows.push(cells(r));
      }
      i--;
      if (rows.length) out.push({ table: { head: rows[0], rows: rows.slice(1) } });
      continue;
    }
    para.push(t);
  }
  flush();
  return out;
}

export function blocksToMarkdown(blocks: Block[]): string {
  return blocks.map((b) => {
    if ("h2" in b) return `## ${b.h2}`;
    if ("h3" in b) return `### ${b.h3}`;
    if ("p" in b) return b.p;
    if ("ul" in b) return b.ul.map((x) => `- ${x}`).join("\n");
    if ("ol" in b) return b.ol.map((x, i) => `${i + 1}. ${x}`).join("\n");
    if ("note" in b) return `> ${b.note}`;
    if ("figure" in b) {
      const f = b.figure;
      return [`![${f.alt}](${f.src}${f.caption ? ` "${f.caption}"` : ""})`, ...(f.marks ?? []).map((m) => `@ ${m.x}% ${m.y}% ${m.label}`)].join("\n");
    }
    const row = (r: string[]) => `| ${r.join(" | ")} |`;
    return [row(b.table.head), row(b.table.head.map(() => "---")), ...b.table.rows.map(row)].join("\n");
  }).join("\n\n");
}
