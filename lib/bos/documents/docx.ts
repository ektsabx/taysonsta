// Document → real, editable DOCX (Office Open XML) — docs/bos/30 §3.5, §8.
// Built from the same block tree as the HTML so both outputs match. Arabic
// documents get right-to-left sections, paragraphs, tables and runs.

import type { Block, Inline } from "./markup";
import type { DocFrame } from "./html";
import { createZip, type ZipEntry } from "./zip";

const AR = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const hex = (c: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c.slice(1).toUpperCase() : fallback);

const NS_W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const NS_DRAW = 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

export interface DocxLogo {
  bytes: Uint8Array;
  type: "png" | "jpeg";
}

interface Ctx {
  rtl: boolean;
  size: number; // half-points
  primary: string;
  nextNum: number;
  nums: { id: number; ordered: boolean }[];
  font: string;
}

function run(text: string, ctx: Ctx, opts: { bold?: boolean; italic?: boolean; size?: number; color?: string } = {}): string {
  const rtlRun = ctx.rtl || AR.test(text);
  const pr = [
    `<w:rFonts w:ascii="${ctx.font}" w:hAnsi="${ctx.font}" w:cs="${ctx.font}" w:eastAsia="${ctx.font}"/>`,
    opts.bold ? "<w:b/><w:bCs/>" : "",
    opts.italic ? "<w:i/><w:iCs/>" : "",
    opts.color ? `<w:color w:val="${opts.color}"/>` : "",
    opts.size ? `<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>` : "",
    rtlRun && AR.test(text) ? "<w:rtl/>" : "",
    `<w:lang w:val="en-US" w:bidi="ar-SA"/>`,
  ].join("");
  return `<w:r><w:rPr>${pr}</w:rPr><w:t xml:space="preserve">${x(text)}</w:t></w:r>`;
}

function runs(list: Inline[], ctx: Ctx, extra: { bold?: boolean; size?: number; color?: string } = {}): string {
  return list.map((i) => ("br" in i ? "<w:r><w:br/></w:r>" : run(i.text, ctx, { bold: i.bold || extra.bold, italic: i.italic, size: extra.size, color: extra.color }))).join("");
}

function para(content: string, ctx: Ctx, opts: { style?: string; numId?: number; border?: "bottom" | "top"; after?: number; align?: "center" } = {}): string {
  const pPr = [
    opts.style ? `<w:pStyle w:val="${opts.style}"/>` : "",
    opts.numId ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${opts.numId}"/></w:numPr>` : "",
    opts.border ? `<w:pBdr><w:${opts.border} w:val="single" w:sz="6" w:space="1" w:color="9CA3AF"/></w:pBdr>` : "",
    ctx.rtl ? "<w:bidi/>" : "",
    opts.after !== undefined ? `<w:spacing w:after="${opts.after}"/>` : "",
    opts.align ? `<w:jc w:val="${opts.align}"/>` : "",
  ].join("");
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${content}</w:p>`;
}

function table(header: Inline[][] | null, rows: Inline[][][], ctx: Ctx, opts: { borders: boolean } = { borders: true }): string {
  const cols = Math.max(header?.length ?? 0, ...rows.map((r) => r.length), 1);
  const width = 9638; // A4 text width in twips with 2 cm margins
  const colW = Math.floor(width / cols);
  const border = opts.borders
    ? '<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/><w:left w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/><w:right w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/></w:tblBorders>'
    : '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';
  const tblPr = `<w:tblPr>${ctx.rtl ? "<w:bidiVisual/>" : ""}<w:tblW w:w="5000" w:type="pct"/>${border}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
  const grid = `<w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${colW}"/>`).join("")}</w:tblGrid>`;
  const row = (cells: Inline[][], isHeader: boolean) => {
    const padded = [...cells, ...Array.from({ length: cols - cells.length }, () => [] as Inline[])];
    return `<w:tr>${isHeader ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${padded
      .map((c) => `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/>${isHeader ? '<w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/>' : ""}</w:tcPr>${para(runs(c, ctx, { bold: isHeader }), ctx, { after: 0 })}</w:tc>`)
      .join("")}</w:tr>`;
  };
  return `<w:tbl>${tblPr}${grid}${header ? row(header, true) : ""}${rows.map((r) => row(r, false)).join("")}</w:tbl>${para("", ctx, { after: 0 })}`;
}

function body(blocks: Block[], ctx: Ctx): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "heading":
          return para(runs(b.inlines, ctx), ctx, { style: `Heading${b.level}` });
        case "para":
          return para(runs(b.inlines, ctx), ctx);
        case "list": {
          const id = ctx.nextNum++;
          ctx.nums.push({ id, ordered: b.ordered });
          return b.items.map((i) => para(runs(i, ctx), ctx, { numId: id, after: 60 })).join("");
        }
        case "table":
          return table(b.header, b.rows, ctx);
        case "hr":
          return para("", ctx, { border: "bottom" });
        case "pagebreak":
          return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        case "signatures": {
          const cells = b.parties.map((p) => p);
          const cols = Math.max(cells.length, 1);
          const colW = Math.floor(9638 / cols);
          const tblPr = `<w:tblPr>${ctx.rtl ? "<w:bidiVisual/>" : ""}<w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr>`;
          const grid = `<w:tblGrid>${cells.map(() => `<w:gridCol w:w="${colW}"/>`).join("")}</w:tblGrid>`;
          const tr = `<w:tr>${cells.map((c) => `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/></w:tcPr>${para("", ctx, { after: 480 })}${para("", ctx, { border: "bottom", after: 60 })}${para(runs(c, ctx), ctx)}</w:tc>`).join("")}</w:tr>`;
          return `${para("", ctx)}<w:tbl>${tblPr}${grid}${tr}</w:tbl>${para("", ctx)}`;
        }
      }
    })
    .join("");
}

function imageSize(logo: DocxLogo): { w: number; h: number } | null {
  const b = logo.bytes;
  if (logo.type === "png" && b.length > 24) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { w: v.getUint32(16), h: v.getUint32(20) };
  }
  if (logo.type === "jpeg") {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) break;
      const marker = b[i + 1];
      const len = (b[i + 2] << 8) | b[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
      i += 2 + len;
    }
  }
  return null;
}

function headerXml(frame: DocFrame, ctx: Ctx, logo: DocxLogo | null): string {
  let drawing = "";
  if (logo && frame.style.showLogo) {
    const size = imageSize(logo);
    if (size && size.w > 0 && size.h > 0) {
      const maxW = 1_700_000; // ~4.7 cm
      const maxH = 600_000; // ~1.7 cm
      const scale = Math.min(maxW / (size.w * 9525), maxH / (size.h * 9525), 1);
      const cx = Math.round(size.w * 9525 * scale);
      const cy = Math.round(size.h * 9525 * scale);
      drawing = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Logo"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    }
  }
  const lines = frame.headerLines.map((l, i) => para(run(l, ctx, i === 0 ? { bold: true, size: ctx.size + 4 } : { size: ctx.size - 2, color: "4B5563" }), ctx, { after: 0 })).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS_W} ${NS_DRAW}>${drawing ? para(drawing, ctx, { after: 60 }) : ""}${lines}${para("", ctx, { border: "bottom", after: 120 })}</w:hdr>`;
}

function footerXml(frame: DocFrame, ctx: Ctx): string {
  const text = frame.footerLines.join(" · ");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS_W}>${para(text ? run(text, ctx, { size: ctx.size - 4, color: "6B7280" }) : "", ctx, { align: "center" })}</w:ftr>`;
}

function stylesXml(ctx: Ctx): string {
  const h = (level: number, size: number, color: string) =>
    `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS_W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${ctx.font}" w:hAnsi="${ctx.font}" w:cs="${ctx.font}" w:eastAsia="${ctx.font}"/><w:sz w:val="${ctx.size}"/><w:szCs w:val="${ctx.size}"/><w:lang w:val="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/>${ctx.rtl ? "<w:pPr><w:bidi/></w:pPr>" : ""}</w:style>${h(1, ctx.size + 18, ctx.primary)}${h(2, ctx.size + 8, "111827")}${h(3, ctx.size + 4, "111827")}</w:styles>`;
}

function numberingXml(ctx: Ctx): string {
  const abs = (id: number, ordered: boolean) =>
    `<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${ordered ? "decimal" : "bullet"}"/><w:lvlText w:val="${ordered ? "%1." : "•"}"/><w:lvlJc w:val="${ctx.rtl ? "right" : "left"}"/><w:pPr><w:ind w:${ctx.rtl ? "right" : "left"}="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>`;
  const nums = ctx.nums.map((n) => `<w:num w:numId="${n.id}"><w:abstractNumId w:val="${n.ordered ? 1 : 0}"/>${n.ordered ? '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>' : ""}</w:num>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${NS_W}>${abs(0, false)}${abs(1, true)}${nums}</w:numbering>`;
}

export function documentDocx(blocks: Block[], frame: DocFrame, logo: DocxLogo | null = null, createdIso = "2026-01-01T00:00:00Z"): Uint8Array {
  const ctx: Ctx = { rtl: frame.dir === "rtl", size: Math.round(Math.min(Math.max(frame.style.fontSize || 11, 8), 16) * 2), primary: hex(frame.style.primary, "E51F26"), nextNum: 1, nums: [], font: frame.lang === "ar" ? "Arial" : "Calibri" };
  const main = body(blocks, ctx);
  const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>${ctx.rtl ? "<w:bidi/>" : ""}</w:sectPr>`;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS_W} ${NS_DRAW}><w:body>${main}${sect}</w:body></w:document>`;
  const hasLogo = !!logo && frame.style.showLogo && imageSize(logo) !== null;
  const entries: ZipEntry[] = [
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
    },
    {
      name: "docProps/core.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(frame.title)}</dc:title><dc:creator>Taysonsta BOS</dc:creator><dc:language>${frame.lang}</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${x(createdIso)}</dcterms:created></cp:coreProperties>`,
    },
    {
      name: "word/_rels/document.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`,
    },
    { name: "word/document.xml", data: document },
    { name: "word/styles.xml", data: stylesXml(ctx) },
    { name: "word/numbering.xml", data: numberingXml(ctx) },
    { name: "word/header1.xml", data: headerXml(frame, ctx, hasLogo ? logo : null) },
    { name: "word/footer1.xml", data: footerXml(frame, ctx) },
  ];
  if (hasLogo && logo) {
    const file = `logo.${logo.type === "png" ? "png" : "jpeg"}`;
    entries.push({ name: "word/_rels/header1.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${file}"/></Relationships>` });
    entries.push({ name: `word/media/${file}`, data: logo.bytes });
  }
  return createZip(entries, new Date(createdIso));
}
