// Social platform capability matrix (docs/bos/30 §12). Only what the
// official APIs allow with the credentials the Integration Hub holds is
// marked "api"; everything else is "manual" (staff publish on the platform
// and log the URL/metrics here). Metrics a platform does not expose are shown
// as "not available" — never estimated.

export type Platform = "facebook" | "instagram" | "telegram" | "threads" | "linkedin" | "x" | "snapchat" | "tiktok" | "youtube" | "other";
export type MetricKey = "views" | "reach" | "impressions" | "likes" | "comments" | "shares" | "saves" | "clicks" | "followers";

export interface PlatformSpec {
  label: string;
  publish: "api" | "manual";
  provider: string | null;            // Integration Hub provider for api mode
  textMax: number;
  captionMaxWithMedia?: number;
  requiresMedia: boolean;
  maxHashtags?: number;
  metrics: MetricKey[];               // collected by API sync (api mode)
  note: string;                       // why manual / what the API needs
}

export const platforms: Record<Platform, PlatformSpec> = {
  facebook: { label: "فيسبوك", publish: "api", provider: "meta", textMax: 63206, requiresMedia: false, metrics: ["likes", "comments", "shares", "reach", "impressions", "clicks"], note: "Graph API للصفحات: pages_manage_posts و pages_read_engagement (مراجعة تطبيق Meta)." },
  instagram: { label: "إنستجرام", publish: "api", provider: "meta", textMax: 2200, requiresMedia: true, maxHashtags: 30, metrics: ["likes", "comments", "reach", "saves", "shares", "views"], note: "حساب أعمال مرتبط بصفحة فيسبوك: instagram_content_publish و instagram_manage_insights. الصورة يجب أن تكون رابطاً عاماً (JPEG)." },
  telegram: { label: "تيليجرام", publish: "api", provider: "telegram", textMax: 4096, captionMaxWithMedia: 1024, requiresMedia: false, metrics: [], note: "Bot API: أضف البوت مشرفاً في القناة. واجهة البوت لا توفر المشاهدات — تُسجّل يدوياً." },
  threads: { label: "ثريدز", publish: "manual", provider: null, textMax: 500, requiresMedia: false, metrics: [], note: "Threads API يحتاج تفويض OAuth منفصلاً — يُنشر يدوياً ويُسجّل الرابط هنا حالياً." },
  linkedin: { label: "لينكدإن", publish: "manual", provider: null, textMax: 3000, requiresMedia: false, metrics: [], note: "النشر عبر API يتطلب موافقة LinkedIn على Community Management API — يدوي حتى الموافقة." },
  x: { label: "إكس (تويتر)", publish: "manual", provider: null, textMax: 280, requiresMedia: false, metrics: [], note: "واجهة X للنشر مدفوعة وتتطلب مستوى وصول مناسباً — يدوي." },
  snapchat: { label: "سناب شات", publish: "manual", provider: null, textMax: 250, requiresMedia: true, metrics: [], note: "لا توجد واجهة نشر عامة للقصص — يدوي." },
  tiktok: { label: "تيك توك", publish: "manual", provider: null, textMax: 2200, requiresMedia: true, metrics: [], note: "Content Posting API يتطلب موافقة TikTok على التطبيق — يدوي حتى الموافقة." },
  youtube: { label: "يوتيوب", publish: "manual", provider: null, textMax: 5000, requiresMedia: true, metrics: [], note: "رفع الفيديو يدوي حالياً." },
  other: { label: "أخرى", publish: "manual", provider: null, textMax: 10000, requiresMedia: false, metrics: [], note: "منصة أخرى — تسجيل يدوي." },
};

export const platformKeys = Object.keys(platforms) as Platform[];

export const metricDefs: Record<MetricKey, { label: string; definition: string }> = {
  views: { label: "المشاهدات", definition: "عدد مرات عرض المحتوى كما تحسبه المنصة (قد يشمل تكرار المستخدم نفسه)." },
  reach: { label: "الوصول", definition: "عدد الحسابات الفريدة التي رأت المحتوى." },
  impressions: { label: "مرات الظهور", definition: "إجمالي مرات ظهور المحتوى على الشاشة." },
  likes: { label: "الإعجابات", definition: "الإعجابات/التفاعلات على المنشور." },
  comments: { label: "التعليقات", definition: "عدد التعليقات." },
  shares: { label: "المشاركات", definition: "عدد مرات المشاركة/إعادة النشر." },
  saves: { label: "الحفظ", definition: "عدد مرات حفظ المنشور." },
  clicks: { label: "النقرات", definition: "النقرات على المنشور أو الرابط كما تحسبها المنصة." },
  followers: { label: "المتابعون", definition: "عدد المتابعين في يوم المزامنة." },
};

// Engagement rate = (likes + comments + shares + saves) / reach (or
// impressions/views when reach isn't available). null when no base exists.
export function engagementRate(m: Partial<Record<MetricKey, number>>): number | null {
  const base = m.reach ?? m.impressions ?? m.views;
  if (!base) return null;
  const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
  return Math.round((eng / base) * 10000) / 100;
}

export function extractHashtags(text: string) {
  return [...new Set((text.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((h) => h.toLowerCase()))];
}

// Final text for one platform: its version (or the base text) + hashtags not already present.
export function composeText(base: string, override: string | null | undefined, hashtags: string[]) {
  const text = (override ?? base).trim();
  const present = new Set(extractHashtags(text));
  const extra = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).filter((h) => !present.has(h.toLowerCase()));
  return extra.length ? `${text}\n\n${extra.join(" ")}`.trim() : text;
}

export interface MediaItem { url: string; type: "image" | "video"; alt?: string }

export function validateTarget(platform: Platform, text: string, media: MediaItem[]) {
  const spec = platforms[platform];
  const errors: string[] = [];
  const warnings: string[] = [];
  const max = media.length && spec.captionMaxWithMedia ? spec.captionMaxWithMedia : spec.textMax;
  if (!text.trim() && !media.length) errors.push("المنشور فارغ.");
  if ([...text].length > max) errors.push(`النص أطول من الحد (${max} حرفاً).`);
  if (spec.requiresMedia && !media.length) errors.push("هذه المنصة تتطلب صورة أو فيديو.");
  if (spec.maxHashtags && extractHashtags(text).length > spec.maxHashtags) errors.push(`الحد الأقصى ${spec.maxHashtags} وسماً.`);
  for (const m of media) {
    if (!/^https:\/\//.test(m.url)) errors.push("روابط الوسائط يجب أن تكون https عامة.");
  }
  if (platform === "instagram" && media.some((m) => m.type === "video")) warnings.push("نشر الفيديو على إنستجرام عبر الـAPI غير مفعّل هنا بعد — استخدم صورة أو انشر يدوياً.");
  if (platform === "instagram" && media.length > 1) warnings.push("سيتم نشر الصورة الأولى فقط.");
  if (spec.publish === "manual") warnings.push("نشر يدوي: انشر على المنصة ثم سجّل رابط المنشور.");
  return { errors: [...new Set(errors)], warnings };
}
