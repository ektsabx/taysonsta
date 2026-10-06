// Yolias email templates (Claude-style: white page, mark + wordmark, one
// heading, short copy, one button, a plain fallback link, quiet footer).
// Table-based inline-styled HTML so it renders in Gmail, Outlook and Apple Mail.
//
// Two kinds:
// - Auth emails (magic link, confirmation, invite) are sent by Supabase Auth.
//   They're written to supabase/templates/*.html by
//   `npm run emails:build` with Go template placeholders, in both languages.
// - Product emails (receipt, discovery ready, usage, plan ending) are rendered
//   here and sent through Resend by lib/email/send.ts.
// Preview all of them at /dev/emails (development only).
//
// No "@/" imports: the build script runs this file directly with Node.

export type EmailLocale = "en" | "ar";

export interface RenderedEmail {
  subject: string;
  html: string;
}

const C = {
  ink: "#141413",
  muted: "#6b6b66",
  faint: "#9a9a94",
  line: "#e8e8e3",
  soft: "#f8f8f6",
  red: "#cf2525",
};

const FONT_EN = "'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const FONT_AR = "'Noto Kufi Arabic','Segoe UI',Tahoma,Arial,sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface LayoutInput {
  locale: EmailLocale;
  siteUrl: string;
  preheader: string;
  heading: string;
  /** Paragraphs (already-escaped HTML allowed). */
  body: string[];
  button?: { label: string; href: string };
  /** Shown under the button: "Or copy this link". */
  fallbackLink?: boolean;
  /** Extra block (e.g. a receipt table) placed after the body. */
  extra?: string;
  footnote: string;
}

const footer: Record<EmailLocale, { sent: string; manage: string; company: string }> = {
  en: { sent: "Yolias · AI customer discovery", manage: "Notification settings", company: "Built by Taysonsta" },
  ar: { sent: "يولـياس · اكتشاف العملاء بالذكاء الاصطناعي", manage: "إعدادات الإشعارات", company: "من تطوير تايسونستا" },
};

const copyLink: Record<EmailLocale, string> = {
  en: "Or copy and paste this link into your browser:",
  ar: "أو انسخ هذا الرابط والصقه في متصفحك:",
};

export function layout(i: LayoutInput): string {
  const rtl = i.locale === "ar";
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  const font = rtl ? FONT_AR : FONT_EN;
  const f = footer[i.locale];
  const button = i.button
    ? `<tr><td style="padding:8px 0 4px">
         <a href="${i.button.href}" style="display:inline-block;padding:11px 20px;background:${C.ink};color:#ffffff;border-radius:8px;font-family:${font};font-size:14px;font-weight:600;line-height:1.2;text-decoration:none">${esc(i.button.label)}</a>
       </td></tr>`
    : "";
  const fallback = i.button && i.fallbackLink
    ? `<tr><td style="padding:20px 0 0;font-family:${font};font-size:12px;line-height:1.6;color:${C.faint}">
         ${copyLink[i.locale]}<br>
         <a href="${i.button.href}" style="color:${C.muted};word-break:break-all;text-decoration:underline" dir="ltr">${i.button.href}</a>
       </td></tr>`
    : "";

  return `<!doctype html>
<html lang="${i.locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(i.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(i.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff">
  <tr><td align="center" style="padding:40px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}" style="max-width:520px;text-align:${align}">
      <tr><td style="padding:0 0 32px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:middle"><img src="${i.siteUrl}/brand/logo-mark.png" width="26" height="28" alt="" style="display:block;border:0"></td>
          <td style="vertical-align:middle;padding:0 9px;font-family:${FONT_EN};font-size:15px;font-weight:700;letter-spacing:.14em;color:${C.ink}">YOLIAS</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:0 0 14px;font-family:${rtl ? FONT_AR : "'Source Serif 4',Georgia,'Times New Roman',serif"};font-size:26px;line-height:1.3;font-weight:600;color:${C.ink}">${esc(i.heading)}</td></tr>
      ${i.body.map((p) => `<tr><td style="padding:0 0 16px;font-family:${font};font-size:15px;line-height:1.65;color:${C.ink}">${p}</td></tr>`).join("\n      ")}
      ${i.extra ? `<tr><td style="padding:4px 0 20px">${i.extra}</td></tr>` : ""}
      ${button}
      ${fallback}
      <tr><td style="padding:28px 0 0;font-family:${font};font-size:13px;line-height:1.6;color:${C.muted}">${i.footnote}</td></tr>
      <tr><td style="padding:32px 0 0"><div style="border-top:1px solid ${C.line};height:1px;line-height:1px">&nbsp;</div></td></tr>
      <tr><td style="padding:16px 0 0;font-family:${font};font-size:12px;line-height:1.7;color:${C.faint}">
        ${f.sent}<br>
        <a href="${i.siteUrl}/" style="color:${C.faint};text-decoration:underline">yolias.ai</a> &nbsp;·&nbsp;
        <a href="${i.siteUrl}/legal/privacy" style="color:${C.faint};text-decoration:underline">${rtl ? "الخصوصية" : "Privacy"}</a> &nbsp;·&nbsp;
        <a href="${i.siteUrl}/help-center" style="color:${C.faint};text-decoration:underline">${rtl ? "مركز المساعدة" : "Help Center"}</a><br>
        ${f.company}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/* ───────────────────────── Auth emails (Supabase) ───────────────────────── */

export type AuthTemplate = "magic_link" | "confirmation" | "invite" | "email_change";

const authCopy: Record<AuthTemplate, Record<EmailLocale, { subject: string; heading: string; body: string; button: string; footnote: string; preheader: string }>> = {
  magic_link: {
    en: {
      subject: "Your Yolias sign-in link",
      preheader: "Use this secure link to sign in. It expires in 1 hour.",
      heading: "Secure link to sign in to Yolias",
      body: "Click the button below to sign in. The link expires in 1 hour and can only be used once.",
      button: "Sign in to Yolias",
      footnote: "If you didn’t try to sign in, you can safely ignore this email. Your account stays secure.",
    },
    ar: {
      subject: "رابط تسجيل الدخول إلى يولـياس",
      preheader: "استخدم هذا الرابط الآمن لتسجيل الدخول. تنتهي صلاحيته خلال ساعة.",
      heading: "رابط آمن لتسجيل الدخول إلى يولـياس",
      body: "اضغط على الزر أدناه لتسجيل الدخول. تنتهي صلاحية الرابط خلال ساعة ويمكن استخدامه مرة واحدة فقط.",
      button: "تسجيل الدخول إلى يولـياس",
      footnote: "إذا لم تحاول تسجيل الدخول، يمكنك تجاهل هذه الرسالة بأمان. حسابك يبقى آمنًا.",
    },
  },
  confirmation: {
    en: {
      subject: "Confirm your Yolias account",
      preheader: "One click to confirm your email and start with Yolias.",
      heading: "Confirm your email",
      body: "Welcome to Yolias. Confirm your email address to finish creating your account. The link expires in 1 hour.",
      button: "Confirm and continue",
      footnote: "If you didn’t create a Yolias account, you can safely ignore this email.",
    },
    ar: {
      subject: "أكّد حسابك في يولـياس",
      preheader: "نقرة واحدة لتأكيد بريدك والبدء مع يولـياس.",
      heading: "أكّد بريدك الإلكتروني",
      body: "أهلًا بك في يولـياس. أكّد بريدك الإلكتروني لإكمال إنشاء حسابك. تنتهي صلاحية الرابط خلال ساعة.",
      button: "التأكيد والمتابعة",
      footnote: "إذا لم تنشئ حسابًا في يولـياس، يمكنك تجاهل هذه الرسالة بأمان.",
    },
  },
  invite: {
    en: {
      subject: "You’ve been invited to Yolias",
      preheader: "Your team uses Yolias to find customers. Accept the invitation to join.",
      heading: "You’ve been invited to join a team on Yolias",
      body: "Your team uses Yolias to discover the right customers and decision makers. Accept the invitation to join their workspace. The link expires in 24 hours.",
      button: "Accept invitation",
      footnote: "If you weren’t expecting this invitation, you can ignore this email.",
    },
    ar: {
      subject: "دعوة للانضمام إلى يولـياس",
      preheader: "فريقك يستخدم يولـياس للعثور على العملاء. اقبل الدعوة للانضمام.",
      heading: "تمت دعوتك للانضمام إلى فريق على يولـياس",
      body: "يستخدم فريقك يولـياس لاكتشاف العملاء وصنّاع القرار المناسبين. اقبل الدعوة للانضمام إلى مساحة العمل. تنتهي صلاحية الرابط خلال 24 ساعة.",
      button: "قبول الدعوة",
      footnote: "إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذه الرسالة.",
    },
  },
  email_change: {
    en: {
      subject: "Confirm your new Yolias email",
      preheader: "Confirm this address to finish changing your Yolias email.",
      heading: "Confirm your new email address",
      body: "You asked to change the email of your Yolias account to this address. Confirm it to finish. The link expires in 1 hour.",
      button: "Confirm new email",
      footnote: "If you didn’t ask for this, ignore this email — nothing changes.",
    },
    ar: {
      subject: "أكّد بريدك الجديد في يولـياس",
      preheader: "أكّد هذا العنوان لإكمال تغيير بريدك في يولـياس.",
      heading: "أكّد بريدك الإلكتروني الجديد",
      body: "طلبت تغيير البريد الإلكتروني لحسابك في يولـياس إلى هذا العنوان. أكّده لإكمال التغيير. تنتهي صلاحية الرابط خلال ساعة.",
      button: "تأكيد البريد الجديد",
      footnote: "إذا لم تطلب ذلك، تجاهل هذه الرسالة — لن يتغير شيء.",
    },
  },
};

const authLink: Record<AuthTemplate, string> = {
  magic_link: "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email",
  confirmation: "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email",
  invite: "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite",
  email_change: "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change",
};

export function authEmail(name: AuthTemplate, locale: EmailLocale, siteUrl = "{{ .SiteURL }}", href = authLink[name]): RenderedEmail {
  const c = authCopy[name][locale];
  return {
    subject: c.subject,
    html: layout({ locale, siteUrl, preheader: c.preheader, heading: c.heading, body: [esc(c.body)], button: { label: c.button, href }, fallbackLink: true, footnote: esc(c.footnote) }),
  };
}

/** Supabase template: Arabic when the user's metadata says so, else English. */
export function supabaseAuthTemplate(name: AuthTemplate): string {
  const body = (l: EmailLocale) => authEmail(name, l).html;
  return `{{ if .Data.locale }}{{ if eq .Data.locale "ar" }}${body("ar")}{{ else }}${body("en")}{{ end }}{{ else }}${body("en")}{{ end }}\n`;
}

/** Subjects can't switch language in Supabase config, so they carry both. */
export function supabaseAuthSubject(name: AuthTemplate): string {
  return `${authCopy[name].en.subject} · ${authCopy[name].ar.subject}`;
}

/** Sent by Supabase to the old address after an email change (no link to click). */
export function emailChangedNotice(locale: EmailLocale, siteUrl = "{{ .SiteURL }}", oldEmail = "{{ .OldEmail }}", newEmail = "{{ .Email }}"): RenderedEmail {
  const ar = locale === "ar";
  return {
    subject: ar ? "تم تغيير بريدك في يولـياس" : "Your Yolias email address was changed",
    html: layout({
      locale, siteUrl,
      preheader: ar ? "تنبيه أمني: تم تغيير البريد الإلكتروني لحسابك." : "Security notice: your account email was changed.",
      heading: ar ? "تم تغيير بريدك الإلكتروني" : "Your email address was changed",
      body: [ar
        ? `تم تغيير البريد الإلكتروني لحسابك في يولـياس من <strong dir="ltr">${oldEmail}</strong> إلى <strong dir="ltr">${newEmail}</strong>. ستصل رسائل تسجيل الدخول إلى العنوان الجديد.`
        : `The email of your Yolias account was changed from <strong dir="ltr">${oldEmail}</strong> to <strong dir="ltr">${newEmail}</strong>. Sign-in links now go to the new address.`],
      footnote: ar
        ? `إذا لم تقم بهذا التغيير، <a href="${siteUrl}/contact?topic=support" style="color:${C.ink}">تواصل معنا فورًا</a>.`
        : `If you didn’t make this change, <a href="${siteUrl}/contact?topic=support" style="color:${C.ink}">contact us right away</a>.`,
    }),
  };
}

export type SecurityNotice = "mfa_factor_enrolled" | "mfa_factor_unenrolled";

const noticeCopy: Record<SecurityNotice, Record<EmailLocale, { subject: string; heading: string; body: string }>> = {
  mfa_factor_enrolled: {
    en: { subject: "Two-factor authentication enabled", heading: "Two-factor authentication is on", body: "Two-factor authentication was turned on for your Yolias account. From now on, signing in needs a code from your authenticator app." },
    ar: { subject: "تم تفعيل المصادقة الثنائية", heading: "المصادقة الثنائية مفعّلة", body: "تم تفعيل المصادقة الثنائية لحسابك في يولـياس. من الآن يحتاج تسجيل الدخول إلى رمز من تطبيق المصادقة." },
  },
  mfa_factor_unenrolled: {
    en: { subject: "Two-factor authentication disabled", heading: "Two-factor authentication is off", body: "Two-factor authentication was turned off for your Yolias account. Signing in now needs only the link sent to your email." },
    ar: { subject: "تم إيقاف المصادقة الثنائية", heading: "المصادقة الثنائية متوقفة", body: "تم إيقاف المصادقة الثنائية لحسابك في يولـياس. يحتاج تسجيل الدخول الآن فقط إلى الرابط المرسل إلى بريدك." },
  },
};

export function securityNoticeEmail(name: SecurityNotice, locale: EmailLocale, siteUrl = "{{ .SiteURL }}"): RenderedEmail {
  const c = noticeCopy[name][locale];
  const ar = locale === "ar";
  return {
    subject: c.subject,
    html: layout({
      locale, siteUrl, preheader: c.body, heading: c.heading, body: [esc(c.body)],
      footnote: ar
        ? `إذا لم تقم بهذا التغيير، <a href="${siteUrl}/contact?topic=support" style="color:${C.ink}">تواصل معنا فورًا</a>.`
        : `If you didn’t make this change, <a href="${siteUrl}/contact?topic=support" style="color:${C.ink}">contact us right away</a>.`,
    }),
  };
}

export function supabaseSecurityNoticeTemplate(name: SecurityNotice): string {
  return `{{ if .Data.locale }}{{ if eq .Data.locale "ar" }}${securityNoticeEmail(name, "ar").html}{{ else }}${securityNoticeEmail(name, "en").html}{{ end }}{{ else }}${securityNoticeEmail(name, "en").html}{{ end }}\n`;
}

export function supabaseNoticeSubject(name: SecurityNotice): string {
  return `{{ if .Data.locale }}{{ if eq .Data.locale "ar" }}${noticeCopy[name].ar.subject}{{ else }}${noticeCopy[name].en.subject}{{ end }}{{ else }}${noticeCopy[name].en.subject}{{ end }}`;
}

export function supabaseEmailChangedTemplate(): string {
  return `{{ if .Data.locale }}{{ if eq .Data.locale "ar" }}${emailChangedNotice("ar").html}{{ else }}${emailChangedNotice("en").html}{{ end }}{{ else }}${emailChangedNotice("en").html}{{ end }}\n`;
}

/* ───────────────────────── Product emails ───────────────────────── */

/** "$20.00" (one USD price, D-131). */
export function price(amount: number, currency: "USD" = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: 2 }).format(amount);
}
const money = price;

function dateText(iso: string, locale: EmailLocale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
}

function rows(locale: EmailLocale, items: [string, string][], total?: [string, string]): string {
  const font = locale === "ar" ? FONT_AR : FONT_EN;
  const end = locale === "ar" ? "left" : "right";
  const cell = `font-family:${font};font-size:14px;line-height:1.5;padding:10px 0;border-bottom:1px solid ${C.line}`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${items.map(([k, v]) => `<tr><td style="${cell};color:${C.muted}">${esc(k)}</td><td style="${cell};color:${C.ink};text-align:${end}">${v}</td></tr>`).join("")}
    ${total ? `<tr><td style="${cell};border-bottom:0;color:${C.ink};font-weight:700">${esc(total[0])}</td><td style="${cell};border-bottom:0;color:${C.ink};font-weight:700;text-align:${end}">${total[1]}</td></tr>` : ""}
  </table>`;
}

export interface ReceiptInput {
  siteUrl: string;
  invoiceId: string;
  invoiceNumber: string;
  planName: string;
  period: "monthly" | "annual";
  amount: number;
  currency?: "USD";
  date: string;
  periodEnd: string;
  test: boolean;
}

export function receiptEmail(locale: EmailLocale, r: ReceiptInput): RenderedEmail {
  const ar = locale === "ar";
  const periodText = r.period === "annual" ? (ar ? "سنوي" : "Annual") : ar ? "شهري" : "Monthly";
  return {
    subject: ar ? `تم الدفع بنجاح — إيصالك من يولـياس #${r.invoiceNumber}` : `Payment successful — your Yolias receipt #${r.invoiceNumber}`,
    html: layout({
      locale,
      siteUrl: r.siteUrl,
      preheader: ar ? `تم دفع ${money(r.amount, r.currency)} لاشتراك ${r.planName}.` : `${money(r.amount, r.currency)} paid for ${r.planName}.`,
      heading: ar ? "شكرًا لك، تم استلام الدفعة" : "Thanks for your payment",
      body: [
        ar
          ? `هذا إيصال اشتراكك في <strong>${esc(r.planName)}</strong>. يتجدد اشتراكك في ${dateText(r.periodEnd, locale)}.`
          : `Here’s your receipt for <strong>${esc(r.planName)}</strong>. Your plan renews on ${dateText(r.periodEnd, locale)}.`,
        ...(r.test ? [ar ? `<span style="color:${C.red}">وضع الاختبار — لم يتم تحصيل أي مبلغ فعلي.</span>` : `<span style="color:${C.red}">Test mode — no real charge was made.</span>`] : []),
      ],
      extra: rows(
        locale,
        [
          [ar ? "رقم الإيصال" : "Receipt number", `<span dir="ltr">${esc(r.invoiceNumber)}</span>`],
          [ar ? "التاريخ" : "Date", dateText(r.date, locale)],
          [ar ? "الخطة" : "Plan", `${esc(r.planName)} · ${periodText}`],
        ],
        [ar ? "المبلغ المدفوع" : "Amount paid", `<span dir="ltr">${money(r.amount, r.currency)}</span>`],
      ),
      button: { label: ar ? "عرض الفاتورة" : "View invoice", href: `${r.siteUrl}/invoices/${r.invoiceId}` },
      footnote: ar
        ? `لديك سؤال عن الفوترة؟ <a href="${r.siteUrl}/contact?topic=support" style="color:${C.ink}">تواصل معنا</a>.`
        : `Questions about billing? <a href="${r.siteUrl}/contact?topic=support" style="color:${C.ink}">Contact us</a>.`,
    }),
  };
}

export interface DiscoveryReadyInput {
  siteUrl: string;
  strategyId: string;
  strategyTitle: string;
  prospects: number;
  companies: number;
}

export function discoveryReadyEmail(locale: EmailLocale, d: DiscoveryReadyInput): RenderedEmail {
  const ar = locale === "ar";
  if (d.prospects === 0) {
    return {
      subject: ar ? `انتهى البحث: ${d.strategyTitle}` : `Your search finished: ${d.strategyTitle}`,
      html: layout({
        locale,
        siteUrl: d.siteUrl,
        preheader: ar ? "لم نجد صنّاع قرار مطابقين هذه المرة." : "No matching decision makers this time.",
        heading: ar ? "انتهى البحث دون نتائج مطابقة" : "Your search finished without matches",
        body: [ar
          ? `انتهى يولـياس من «${esc(d.strategyTitle)}» ولم يجد صنّاع قرار يطابقون معاييرك. لم يُحتسب أي عميل محتمل من رصيدك. جرّب توسيع السوق أو حجم الشركات أو المسميات.`
          : `Yolias finished “${esc(d.strategyTitle)}” and found no decision makers matching your criteria. No prospects were used. Try a wider market, company size or titles.`],
        button: { label: ar ? "تعديل البحث" : "Refine the search", href: `${d.siteUrl}/search/${d.strategyId}` },
        footnote: ar
          ? `تصلك هذه الرسالة لأن إشعار «اكتمال الاكتشاف» مفعّل. <a href="${d.siteUrl}/" style="color:${C.ink}">إعدادات الإشعارات</a>`
          : `You’re receiving this because “Discovery completed” is on. <a href="${d.siteUrl}/" style="color:${C.ink}">Notification settings</a>`,
      }),
    };
  }
  return {
    subject: ar ? `نتائج الاكتشاف جاهزة: ${d.strategyTitle}` : `Your discovery is ready: ${d.strategyTitle}`,
    html: layout({
      locale,
      siteUrl: d.siteUrl,
      preheader: ar ? `${d.prospects} صانع قرار في ${d.companies} شركة.` : `${d.prospects} decision makers at ${d.companies} companies.`,
      heading: ar ? "نتائج الاكتشاف جاهزة" : "Your discovery is ready",
      body: [
        ar
          ? `انتهى يولـياس من «${esc(d.strategyTitle)}» ووجد <strong>${d.prospects}</strong> صانع قرار في <strong>${d.companies}</strong> شركة، مع نسبة تطابق لكل واحد.`
          : `Yolias finished “${esc(d.strategyTitle)}” and found <strong>${d.prospects}</strong> decision makers at <strong>${d.companies}</strong> companies, each with a match score.`,
      ],
      button: { label: ar ? "عرض النتائج" : "View results", href: `${d.siteUrl}/search/${d.strategyId}` },
      footnote: ar
        ? `تصلك هذه الرسالة لأن إشعار «اكتمال الاكتشاف» مفعّل. <a href="${d.siteUrl}/" style="color:${C.ink}">إعدادات الإشعارات</a>`
        : `You’re receiving this because “Discovery completed” is on. <a href="${d.siteUrl}/" style="color:${C.ink}">Notification settings</a>`,
    }),
  };
}

export interface UsageAlertInput {
  siteUrl: string;
  used: number;
  total: number;
  /** null = the Free plan's one-time prospects (D-138): nothing resets. */
  resetsAt: string | null;
}

export function usageAlertEmail(locale: EmailLocale, u: UsageAlertInput): RenderedEmail {
  const ar = locale === "ar";
  const pct = Math.min(100, Math.round((u.used / u.total) * 100));
  const full = pct >= 100;
  const bar = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.line};border-radius:999px"><tr><td style="width:${pct}%;background:${full ? C.red : C.ink};height:8px;border-radius:999px;font-size:0;line-height:0">&nbsp;</td><td style="font-size:0;line-height:0">&nbsp;</td></tr></table>
    <div style="font-family:${ar ? FONT_AR : FONT_EN};font-size:13px;color:${C.muted};padding-top:8px">${ar ? `${u.used} / ${u.total} عميل محتمل` : `${u.used} / ${u.total} prospects`}</div>`;
  return {
    subject: !u.resetsAt
      ? full ? (ar ? "استخدمت كل العملاء المحتملين المجانيين" : "You’ve used all your free prospects") : ar ? `استخدمت ${pct}% من العملاء المحتملين المجانيين` : `You’ve used ${pct}% of your free prospects`
      : full
      ? ar ? "استخدمت كل العملاء المحتملين لهذا الشهر" : "You’ve used all of this month’s prospects"
      : ar ? `استخدمت ${pct}% من العملاء المحتملين لهذا الشهر` : `You’ve used ${pct}% of this month’s prospects`,
    html: !u.resetsAt ? layout({
      locale,
      siteUrl: u.siteUrl,
      preheader: ar ? "تشمل الخطة المجانية عملاء محتملين للبداية." : "The Free plan includes prospects to get you started.",
      heading: full ? (ar ? "استخدمت العملاء المحتملين المجانيين" : "You’ve used your free prospects") : ar ? "اقتربت من نهاية العملاء المحتملين المجانيين" : "You’re close to the end of your free prospects",
      body: [
        full
          ? ar ? "توقف يولـياس عن إضافة عملاء محتملين جدد. اختر خطة أو اشترِ عملاء محتملين إضافيين من الإعدادات ← الاستخدام لتتابع الاكتشاف." : "Yolias has paused adding new prospects. Pick a plan, or buy more prospects in Settings → Usage, to keep discovering."
          : ar ? `استخدمت ${pct}% من العملاء المحتملين المجانيين. اختر خطة في أي وقت لتحصل على عملاء محتملين كل شهر.` : `You’ve used ${pct}% of your free prospects. Pick a plan any time to get prospects every month.`,
      ],
      extra: bar,
      button: { label: ar ? "عرض الخطط" : "See plans", href: `${u.siteUrl}/checkout` },
      footnote: ar ? "برو والنمو يشملان رصيداً جديداً من العملاء المحتملين كل شهر." : "Pro and Growth include a new prospect allowance every month.",
    }) : layout({
      locale,
      siteUrl: u.siteUrl,
      preheader: ar ? `يتجدد الرصيد في ${dateText(u.resetsAt, locale)}.` : `Your allowance resets on ${dateText(u.resetsAt, locale)}.`,
      heading: full ? (ar ? "وصلت إلى حد هذا الشهر" : "You’ve reached this month’s limit") : ar ? "اقتربت من حد هذا الشهر" : "You’re close to this month’s limit",
      body: [
        full
          ? ar
            ? `توقف يولـياس عن إضافة عملاء محتملين جدد حتى ${dateText(u.resetsAt, locale)}. يمكنك شراء عملاء محتملين إضافيين من الإعدادات ← الاستخدام أو الترقية للمتابعة الآن.`
            : `Yolias has paused adding new prospects until ${dateText(u.resetsAt, locale)}. Buy more prospects in Settings → Usage, or upgrade, to keep discovering now.`
          : ar
            ? `استخدمت ${pct}% من العملاء المحتملين المتاحين في خطتك هذا الشهر. يتجدد الرصيد في ${dateText(u.resetsAt, locale)}.`
            : `You’ve used ${pct}% of the prospects included in your plan this month. It resets on ${dateText(u.resetsAt, locale)}.`,
      ],
      extra: bar,
      button: { label: ar ? "عرض الخطط" : "See plans", href: `${u.siteUrl}/checkout` },
      footnote: ar ? "يُحسب الاستخدام بالعملاء المحتملين الذين تم تسليمهم فقط." : "Only delivered prospects count toward your usage.",
    }),
  };
}

export interface PlanEndingInput {
  siteUrl: string;
  planName: string;
  endsAt: string;
}

export function planEndingEmail(locale: EmailLocale, p: PlanEndingInput): RenderedEmail {
  const ar = locale === "ar";
  return {
    subject: ar ? `سينتهي اشتراك ${p.planName} في ${dateText(p.endsAt, locale)}` : `Your ${p.planName} plan ends on ${dateText(p.endsAt, locale)}`,
    html: layout({
      locale,
      siteUrl: p.siteUrl,
      preheader: ar ? "يمكنك استئناف اشتراكك في أي وقت قبل ذلك." : "You can resume your plan any time before then.",
      heading: ar ? "تم إلغاء اشتراكك" : "Your plan has been canceled",
      body: [
        ar
          ? `سيبقى <strong>${esc(p.planName)}</strong> فعالًا حتى ${dateText(p.endsAt, locale)}، ثم تنتقل مساحة العمل إلى الخطة المجانية. تبقى كل عمليات البحث الخاصة بك وعملاؤك المحتملون محفوظين.`
          : `<strong>${esc(p.planName)}</strong> stays active until ${dateText(p.endsAt, locale)}. After that your workspace moves to Free. All your searches and prospects stay saved.`,
      ],
      button: { label: ar ? "استئناف الاشتراك" : "Resume plan", href: `${p.siteUrl}/` },
      footnote: ar ? "غيّرت رأيك؟ يمكنك الاستئناف من الإعدادات ← الفوترة." : "Changed your mind? Resume any time from Settings → Billing.",
    }),
  };
}
