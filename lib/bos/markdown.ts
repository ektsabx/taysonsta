import { nowMs } from "@/lib/bos/clock";
// Minimal, safe Markdown → HTML (docs/bos/15: sanitized, no script/iframe).
// All input is HTML-escaped first; only a fixed set of tags is generated and
// links are limited to http(s), mailto and relative app paths.

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function safeHref(url: string) {
  const u = url.trim();
  if (/^(https?:\/\/|mailto:|\/(?!\/))/i.test(u)) return u.replace(/"/g, "%22");
  return null;
}

function inline(text: string) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const safe = safeHref(href.replace(/&amp;/g, "&"));
    return safe ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
  });
  return s;
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  let para: string[] = [];
  let inCode = false;
  let code: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join("<br/>")}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of lines) {
    if (raw.trim().startsWith("```")) {
      if (inCode) {
        out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        flushPara();
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(raw);
      continue;
    }
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const quote = line.match(/^>\s?(.*)$/);
    if (!line.trim()) {
      flushPara();
      closeList();
    } else if (h) {
      flushPara();
      closeList();
      const level = h[1].length + 1; // h2..h5 inside pages
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
    } else if (ul || ol) {
      flushPara();
      const kind = ul ? "ul" : "ol";
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`);
    } else if (quote) {
      flushPara();
      closeList();
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
    } else if (/^-{3,}$/.test(line.trim())) {
      flushPara();
      closeList();
      out.push("<hr/>");
    } else {
      closeList();
      para.push(line);
    }
  }
  if (inCode) out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  flushPara();
  closeList();
  return out.join("\n");
}

export function slugify(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `article-${nowMs().toString(36)}`;
}
