// Document markup (docs/bos/30 §8, doc 31 Phase 5): a small, predictable
// subset that maps 1:1 to both HTML (preview / print / PDF) and OOXML (DOCX).
//
//   # / ## / ###      headings
//   blank line        new paragraph; a single newline = line break
//   **bold**  *italic*
//   - item / 1. item  lists
//   | a | b |         table (a `|---|---|` row after the first makes it a header)
//   ---               horizontal rule
//   [[pagebreak]]     page break
//   [[signatures: A | B]]   signature block with one line per party
//   \x               literal character (escape)

import { LINE_BREAK } from "./template";

export type Inline = { text: string; bold?: boolean; italic?: boolean } | { br: true };
export type Block =
  | { type: "heading"; level: 1 | 2 | 3; inlines: Inline[] }
  | { type: "para"; inlines: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "table"; header: Inline[][] | null; rows: Inline[][][] }
  | { type: "hr" }
  | { type: "pagebreak" }
  | { type: "signatures"; parties: Inline[][] };

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let bold = false;
  let italic = false;
  let buf = "";
  const flush = () => {
    if (buf) out.push({ text: buf, ...(bold ? { bold: true } : {}), ...(italic ? { italic: true } : {}) });
    buf = "";
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "\\" && i + 1 < src.length) {
      buf += src[++i];
    } else if (c === LINE_BREAK || c === "\n") {
      flush();
      out.push({ br: true });
    } else if (c === "*" && src[i + 1] === "*") {
      flush();
      bold = !bold;
      i++;
    } else if (c === "*") {
      flush();
      italic = !italic;
    } else buf += c;
  }
  flush();
  return out;
}

// Splits a table row on unescaped pipes.
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\\" && i + 1 < body.length) {
      cur += body[i] + body[i + 1];
      i++;
    } else if (body[i] === "|") {
      cells.push(cur.trim());
      cur = "";
    } else cur += body[i];
  }
  cells.push(cur.trim());
  return cells;
}

const isSeparator = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line) && line.includes("|");

export function parseMarkup(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ type: "para", inlines: parseInline(para.join("\n")) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) {
      flushPara();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(t);
    if (h) {
      flushPara();
      blocks.push({ type: "heading", level: h[1].length as 1 | 2 | 3, inlines: parseInline(h[2]) });
      continue;
    }
    if (t === "---") {
      flushPara();
      blocks.push({ type: "hr" });
      continue;
    }
    if (t === "[[pagebreak]]") {
      flushPara();
      blocks.push({ type: "pagebreak" });
      continue;
    }
    const sig = /^\[\[signatures:\s*(.*)\]\]$/.exec(t);
    if (sig) {
      flushPara();
      blocks.push({ type: "signatures", parties: splitRow(sig[1]).map(parseInline) });
      continue;
    }
    if (t.startsWith("|")) {
      flushPara();
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(lines[i++].trim());
      i--;
      let header: Inline[][] | null = null;
      let body = rows;
      if (rows.length > 1 && isSeparator(rows[1])) {
        header = splitRow(rows[0]).map(parseInline);
        body = rows.slice(2);
      }
      blocks.push({ type: "table", header, rows: body.filter((r) => !isSeparator(r)).map((r) => splitRow(r).map(parseInline)) });
      continue;
    }
    const li = /^(-|\d+\.)\s+(.*)$/.exec(t);
    if (li) {
      flushPara();
      const ordered = li[1] !== "-";
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = /^(-|\d+\.)\s+(.*)$/.exec(lines[i].trim());
        if (!m || (m[1] !== "-") === !ordered) break;
        items.push(parseInline(m[2]));
        i++;
      }
      i--;
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    para.push(line);
  }
  flushPara();
  return blocks;
}

export function inlineText(inlines: Inline[]): string {
  return inlines.map((x) => ("br" in x ? "\n" : x.text)).join("");
}
