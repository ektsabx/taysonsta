// Template variables (docs/bos/30 §3.5, §8, doc 31 Phase 5).
//
//   {{client.name}}                 value (escaped for the document markup)
//   {{money invoice.total invoice.currency}}   formatted amount + currency
//   {{date invoice.due_date}}       formatted date (document language)
//   {{number x}}                    grouped number
//   {{#each lines}} … {{/each}}     loop; inside, fields are relative
//                                   ({{description}}), {{@index}} is 1-based
//   {{#if tax_amount}} … {{else}} … {{/if}}   truthy check (0/""/[]/null = false)
//   {{#unless x}} … {{/unless}}
//
// Values never become markup: *, |, \, [ ] and a leading # are escaped and
// line breaks become the markup line-break mark, so client data cannot
// change a document's structure.

export const LINE_BREAK = "⏎";

export type TemplateData = Record<string, unknown>;

export interface RenderOptions {
  locale: "ar" | "en";
  formatMoney: (value: unknown, currency: string | null | undefined) => string;
  formatDate: (value: string) => string;
}

export class TemplateSyntaxError extends Error {}

function lookup(allScopes: unknown[], rawPath: string): unknown {
  // "../x" reads from the enclosing scope (outside the current {{#each}}).
  let scopes = allScopes;
  let path = rawPath;
  while (path.startsWith("../")) {
    scopes = scopes.slice(0, Math.max(1, scopes.length - 1));
    path = path.slice(3);
  }
  if (path === "this" || path === ".") return scopes[scopes.length - 1];
  const parts = path.split(".");
  for (let i = scopes.length - 1; i >= 0; i--) {
    let cur: unknown = scopes[i];
    let found = true;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[p];
      else {
        found = false;
        break;
      }
    }
    if (found) return cur;
  }
  return undefined;
}

function truthy(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim() !== "" && v !== "0" && !/^0(\.0+)?$/.test(v);
  if (typeof v === "number") return v !== 0;
  return Boolean(v);
}

export function escapeValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v).replace(/\r\n?/g, "\n");
  s = s.replace(/\\/g, "\\\\").replace(/\*/g, "\\*").replace(/\|/g, "\\|").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
  s = s.replace(/^#/, "\\#").replace(/\n/g, LINE_BREAK);
  return s;
}

type Node =
  | { t: "text"; v: string }
  | { t: "var"; expr: string }
  | { t: "each"; path: string; body: Node[] }
  | { t: "if"; path: string; neg: boolean; body: Node[]; else: Node[] };

function parse(src: string): Node[] {
  const re = /\{\{\s*(?:([#/])\s*(each|if|unless)\b|(else)(?=\s*\}\}))?\s*([^}]*?)\s*\}\}/g;
  const root: Node[] = [];
  const stack: { node: Node & { t: "each" | "if" }; inElse: boolean }[] = [];
  const target = () => {
    const top = stack[stack.length - 1];
    if (!top) return root;
    if (top.node.t === "if") return top.inElse ? top.node.else : top.node.body;
    return top.node.body;
  };
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) target().push({ t: "text", v: src.slice(last, m.index) });
    last = re.lastIndex;
    const [, sigil, blockKw, elseKw, rest] = m;
    const kw = blockKw ?? elseKw;
    if (sigil === "#") {
      if (kw === "each") {
        const node = { t: "each" as const, path: rest.trim(), body: [] as Node[] };
        target().push(node);
        stack.push({ node, inElse: false });
      } else if (kw === "if" || kw === "unless") {
        const node = { t: "if" as const, path: rest.trim(), neg: kw === "unless", body: [] as Node[], else: [] as Node[] };
        target().push(node);
        stack.push({ node, inElse: false });
      } else throw new TemplateSyntaxError(`Unknown block {{#${kw ?? rest}}}`);
    } else if (sigil === "/") {
      const top = stack.pop();
      const expected = top?.node.t === "each" ? "each" : top?.node.t === "if" ? (top.node.neg ? "unless" : "if") : null;
      if (!top || expected !== kw) throw new TemplateSyntaxError(`Unexpected {{/${kw ?? rest}}}`);
    } else if (elseKw) {
      const top = stack[stack.length - 1];
      if (!top || top.node.t !== "if") throw new TemplateSyntaxError("{{else}} outside {{#if}}");
      top.inElse = true;
    } else {
      if (!rest) throw new TemplateSyntaxError("Empty {{ }}");
      target().push({ t: "var", expr: rest.trim() });
    }
  }
  if (last < src.length) target().push({ t: "text", v: src.slice(last) });
  if (stack.length) throw new TemplateSyntaxError(`Unclosed {{#${stack[stack.length - 1].node.t}}}`);
  return root;
}

function renderNodes(nodes: Node[], scopes: unknown[], opts: RenderOptions, index: number | null, out: string[]) {
  for (const n of nodes) {
    if (n.t === "text") out.push(n.v);
    else if (n.t === "var") {
      const [head, ...args] = n.expr.split(/\s+/);
      if (head === "@index") out.push(index === null ? "" : String(index));
      else if (head === "money") {
        // Second argument: a path to the currency, or a literal ISO code (e.g. USD).
        const cur = lookup(scopes, args[1] ?? "");
        out.push(escapeValue(opts.formatMoney(lookup(scopes, args[0] ?? ""), cur !== undefined && cur !== null ? String(cur) : /^[A-Z]{3}$/.test(args[1] ?? "") ? args[1] : "")));
      }
      else if (head === "date") {
        const v = lookup(scopes, args[0] ?? "");
        out.push(v ? escapeValue(opts.formatDate(String(v))) : "");
      } else if (head === "number") {
        const v = Number(lookup(scopes, args[0] ?? ""));
        out.push(Number.isFinite(v) ? escapeValue(v.toLocaleString(opts.locale === "ar" ? "ar-EG" : "en-US")) : "");
      } else out.push(escapeValue(lookup(scopes, head)));
    } else if (n.t === "each") {
      const list = lookup(scopes, n.path);
      if (Array.isArray(list)) list.forEach((item, i) => renderNodes(n.body, [...scopes, item], opts, i + 1, out));
    } else {
      const ok = truthy(lookup(scopes, n.path)) !== n.neg;
      renderNodes(ok ? n.body : n.else, scopes, opts, index, out);
    }
  }
}

export function renderTemplate(src: string, data: TemplateData, opts: RenderOptions): string {
  const out: string[] = [];
  renderNodes(parse(src), [data], opts, null, out);
  return out.join("");
}

// Variables a template uses (for the editor's reference panel and checks).
export function templateVariables(src: string): string[] {
  const found = new Set<string>();
  const walk = (nodes: Node[], prefix: string) => {
    for (const n of nodes) {
      if (n.t === "var") {
        const parts = n.expr.split(/\s+/);
        const paths = ["money", "date", "number"].includes(parts[0]) ? parts.slice(1) : [parts[0]];
        for (const p of paths) if (p && !p.startsWith("@") && /^[a-z_][\w.]*$/i.test(p)) found.add(prefix + p);
      } else if (n.t === "each") {
        found.add(n.path);
        walk(n.body, `${n.path}[].`);
      } else if (n.t === "if") {
        found.add(prefix + n.path);
        walk(n.body, prefix);
        walk(n.else, prefix);
      }
    }
  };
  walk(parse(src), "");
  return [...found].sort();
}

export function validateTemplate(src: string): string | null {
  try {
    parse(src);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid template";
  }
}
