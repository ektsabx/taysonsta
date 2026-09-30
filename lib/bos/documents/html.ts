// Document → HTML (preview, print and browser "Save as PDF") — docs/bos/30 §8.
// Everything is escaped; the output is a self-contained A4 page.

import type { Block, Inline } from "./markup";

export interface DocStyle {
  primary: string;       // #RRGGBB
  accent: string;
  fontSize: number;      // pt
  showLogo: boolean;
}

export interface DocFrame {
  dir: "rtl" | "ltr";
  lang: "ar" | "en";
  title: string;
  style: DocStyle;
  logoUrl: string | null;
  headerLines: string[];  // company name, legal data… (already resolved, plain text)
  footerLines: string[];
}

export const defaultDocStyle: DocStyle = { primary: "#e51f26", accent: "#111827", fontSize: 11, showLogo: true };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const color = (c: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : fallback);

function inl(list: Inline[]): string {
  return list
    .map((x) => {
      if ("br" in x) return "<br>";
      let s = esc(x.text);
      if (x.italic) s = `<em>${s}</em>`;
      if (x.bold) s = `<strong>${s}</strong>`;
      return s;
    })
    .join("");
}

export function blocksToHtml(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "heading":
          return `<h${b.level}>${inl(b.inlines)}</h${b.level}>`;
        case "para":
          return `<p>${inl(b.inlines)}</p>`;
        case "list":
          return `<${b.ordered ? "ol" : "ul"}>${b.items.map((i) => `<li>${inl(i)}</li>`).join("")}</${b.ordered ? "ol" : "ul"}>`;
        case "table":
          return `<table>${b.header ? `<thead><tr>${b.header.map((c) => `<th>${inl(c)}</th>`).join("")}</tr></thead>` : ""}<tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inl(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
        case "hr":
          return "<hr>";
        case "pagebreak":
          return '<div class="page-break"></div>';
        case "signatures":
          return `<div class="signatures">${b.parties.map((p) => `<div class="sig"><div class="sig-line"></div><div>${inl(p)}</div></div>`).join("")}</div>`;
      }
    })
    .join("\n");
}

export function documentHtml(blocks: Block[], frame: DocFrame): string {
  const primary = color(frame.style.primary, defaultDocStyle.primary);
  const accent = color(frame.style.accent, defaultDocStyle.accent);
  const size = Math.min(Math.max(frame.style.fontSize || 11, 8), 16);
  return `<!doctype html>
<html lang="${frame.lang}" dir="${frame.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(frame.title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f3f4f6; color: ${accent}; font-family: ${frame.lang === "ar" ? '"IBM Plex Sans Arabic", "Noto Naskh Arabic", Tahoma' : 'Inter, "Segoe UI", Arial'}, sans-serif; font-size: ${size}pt; line-height: 1.6; }
  .sheet { background: #fff; max-width: 210mm; margin: 16px auto; padding: 18mm 16mm; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  header.doc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 3px solid ${primary}; padding-bottom: 10px; margin-bottom: 18px; }
  header.doc-head img { max-height: 56px; max-width: 180px; }
  header.doc-head .co { font-size: ${size - 1}pt; color: #4b5563; text-align: end; }
  header.doc-head .co strong { color: ${accent}; font-size: ${size + 2}pt; display: block; }
  h1 { font-size: ${size + 9}pt; color: ${primary}; margin: 0 0 10px; }
  h2 { font-size: ${size + 4}pt; margin: 18px 0 8px; }
  h3 { font-size: ${size + 2}pt; margin: 14px 0 6px; }
  p { margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: start; vertical-align: top; }
  th { background: #f3f4f6; }
  hr { border: none; border-top: 1px solid #d1d5db; margin: 14px 0; }
  .signatures { display: flex; gap: 32px; margin-top: 36px; flex-wrap: wrap; }
  .sig { flex: 1; min-width: 160px; }
  .sig-line { border-bottom: 1px solid ${accent}; height: 44px; margin-bottom: 6px; }
  footer.doc-foot { margin-top: 28px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: ${size - 2}pt; color: #6b7280; text-align: center; }
  .page-break { break-after: page; }
  @media print { body { background: #fff; } .sheet { box-shadow: none; margin: 0; padding: 0; max-width: none; } .no-print { display: none !important; } }
</style>
</head>
<body>
<div class="sheet">
<header class="doc-head">
  <div>${frame.style.showLogo && frame.logoUrl ? `<img src="${esc(frame.logoUrl)}" alt="">` : ""}</div>
  <div class="co">${frame.headerLines.map((l, i) => (i === 0 ? `<strong>${esc(l)}</strong>` : `<div>${esc(l)}</div>`)).join("")}</div>
</header>
<main>
${blocksToHtml(blocks)}
</main>
${frame.footerLines.length ? `<footer class="doc-foot">${frame.footerLines.map(esc).join(" · ")}</footer>` : ""}
</div>
</body>
</html>`;
}
