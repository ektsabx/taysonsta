import { VARIABLES } from "./catalog";

// Templates written in Yolias Admin: {{variable}} placeholders, checked
// before saving and before sending, and the Yolias email frame around them
// (logo, body, footer, unsubscribe link for lifecycle / marketing mail).
// Shared by the engine and Yolias Admin: no "@/" imports.

const KNOWN = new Set(VARIABLES.map((v) => v.name));
const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g;

export type Vars = Partial<Record<(typeof VARIABLES)[number]["name"], string>>;

export function usedVariables(...texts: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const t of texts) for (const m of (t ?? "").matchAll(PLACEHOLDER)) out.add(m[1]);
  return [...out];
}

/** Problems with a template, in Arabic (empty = valid). */
export function templateErrors(t: { subject: string; html: string; preview_text?: string | null; text_body?: string | null }): string[] {
  const out: string[] = [];
  if (!t.subject.trim()) out.push("اكتب عنوان الرسالة.");
  if (t.subject.length > 200) out.push("العنوان أطول من 200 حرف.");
  if (!t.html.trim()) out.push("اكتب محتوى الرسالة.");
  const unknown = usedVariables(t.subject, t.html, t.preview_text, t.text_body).filter((v) => !KNOWN.has(v));
  if (unknown.length) out.push(`متغيرات غير معروفة: ${unknown.map((v) => `{{${v}}}`).join("، ")}`);
  if (/<\s*(script|iframe|object|embed|form|input|meta|link|style)\b/i.test(t.html)) out.push("المحتوى يحتوي وسومًا غير مسموحة (script, iframe, form, style…).");
  if (/\son[a-z]+\s*=/i.test(t.html)) out.push("المحتوى يحتوي أحداث JavaScript (onclick…)، وهي غير مسموحة.");
  for (const m of t.html.matchAll(/href\s*=\s*["']([^"']*)["']/gi)) {
    const href = m[1].trim();
    if (!/^(https:\/\/|mailto:|\{\{\s*[a-z_]+\s*\}\})/i.test(href)) out.push(`رابط غير مسموح: ${href.slice(0, 60)} (https أو mailto أو متغير فقط).`);
  }
  if (/\u2014/.test(`${t.subject}${t.html}${t.preview_text ?? ""}${t.text_body ?? ""}`)) out.push("استخدم فاصلة أو نقطتين بدل الشرطة الطويلة.");
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Fills placeholders. In HTML, values are escaped; unknown or empty ones become "". */
export function fill(text: string, vars: Vars, html: boolean): string {
  return text.replace(PLACEHOLDER, (_, name: string) => {
    const v = (vars as Record<string, string | undefined>)[name] ?? "";
    return html ? esc(v) : v;
  });
}

/** Plain text from HTML (the text part when a template has none). */
export function htmlToPlain(html: string): string {
  return html
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface Framed { subject: string; html: string; text: string }

/**
 * The full email: the Yolias frame (same look as the product emails) around
 * the template body, the preview text, and for lifecycle / marketing mail an
 * unsubscribe line in the footer.
 */
export function frame(input: { subject: string; html: string; preview?: string | null; text?: string | null; siteUrl: string; vars: Vars; unsubscribeUrl?: string | null; lang?: "en" | "ar" }): Framed {
  const vars = { ...input.vars, unsubscribe_url: input.unsubscribeUrl ?? input.vars.unsubscribe_url ?? "" };
  const subject = fill(input.subject, vars, false).replace(/\s+/g, " ").trim();
  const body = fill(input.html, vars, true);
  const preview = fill(input.preview ?? "", vars, false);
  const rtl = input.lang === "ar";
  const font = rtl ? "'Noto Kufi Arabic','Segoe UI',Tahoma,Arial,sans-serif" : "'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const unsubscribe = input.unsubscribeUrl
    ? `<br>${rtl ? "تصلك هذه الرسالة لأن لديك حسابًا في Yolias." : "You’re receiving this because you have a Yolias account."} <a href="${esc(input.unsubscribeUrl)}" style="color:#9a9a94;text-decoration:underline">${rtl ? "إلغاء الاشتراك من هذه الرسائل" : "Unsubscribe from these emails"}</a>`
    : "";
  const html = `<!doctype html>
<html lang="${rtl ? "ar" : "en"}" dir="${rtl ? "rtl" : "ltr"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff">
  <tr><td align="center" style="padding:40px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;text-align:${rtl ? "right" : "left"}">
      <tr><td style="padding:0 0 28px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:middle"><img src="${input.siteUrl}/brand/logo-mark.png" width="26" height="28" alt="" style="display:block;border:0"></td>
          <td style="vertical-align:middle;padding:0 9px;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;letter-spacing:.14em;color:#141413">YOLIAS</td>
        </tr></table>
      </td></tr>
      <tr><td class="yolias-body" style="font-family:${font};font-size:15px;line-height:1.65;color:#141413">${body}</td></tr>
      <tr><td style="padding:32px 0 0"><div style="border-top:1px solid #e8e8e3;height:1px;line-height:1px">&nbsp;</div></td></tr>
      <tr><td style="padding:16px 0 0;font-family:${font};font-size:12px;line-height:1.7;color:#9a9a94">
        <a href="${input.siteUrl}/" style="color:#9a9a94;text-decoration:underline">yolias.com</a> &nbsp;·&nbsp;
        <a href="${input.siteUrl}/legal/privacy" style="color:#9a9a94;text-decoration:underline">${rtl ? "الخصوصية" : "Privacy"}</a> &nbsp;·&nbsp;
        <a href="${input.siteUrl}/help-center" style="color:#9a9a94;text-decoration:underline">${rtl ? "مركز المساعدة" : "Help Center"}</a>${unsubscribe}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
  const plain = input.text ? fill(input.text, vars, false) : htmlToPlain(body);
  const text = input.unsubscribeUrl ? `${plain}\n\n${rtl ? "إلغاء الاشتراك" : "Unsubscribe"}: ${input.unsubscribeUrl}` : plain;
  return { subject, html, text };
}

/** Sample values for previews and test sends. */
export function sampleVars(siteUrl: string): Vars {
  const v = Object.fromEntries(VARIABLES.map((x) => [x.name, x.sample])) as Vars;
  return { ...v, app_url: `${siteUrl}/`, pricing_url: `${siteUrl}/pricing`, checkout_url: `${siteUrl}/checkout?plan=growth`, unsubscribe_url: `${siteUrl}/unsubscribe/sample` };
}
