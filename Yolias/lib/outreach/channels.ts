import type { MessageChannel, MessageObjective, MessageOpenedVia, MessageTone } from "@/types/database";

// What a prepared message can be (shared by the server and the composer):
// channels, objectives, tones, languages and the links that open the member's
// own app. Yolias never sends; the member does (D-155, D-160).

export const channels: MessageChannel[] = ["email", "linkedin", "whatsapp", "facebook", "instagram"];
export const objectives: MessageObjective[] = ["introduction", "sales", "meeting", "follow_up", "partnership", "referral"];
export const tones: MessageTone[] = ["direct", "conservative", "friendly"];
export const DEFAULT_OBJECTIVE: MessageObjective = "introduction";
/** Direct unless the member picks another tone (owner's email spec). */
export const DEFAULT_TONE: MessageTone = "direct";

/** Languages a message can be written in (ISO 639-1 → English name for the model). */
export const messageLanguages = {
  en: "English", ar: "Arabic", fr: "French", es: "Spanish", de: "German", pt: "Portuguese", it: "Italian", nl: "Dutch",
  tr: "Turkish", ru: "Russian", hi: "Hindi", ur: "Urdu", id: "Indonesian", zh: "Chinese (Simplified)", ja: "Japanese",
} as const;
export type MessageLanguage = keyof typeof messageLanguages;
/** How each language is shown in the composer (its own name). */
export const languageLabels: Record<MessageLanguage, string> = {
  en: "English", ar: "العربية", fr: "Français", es: "Español", de: "Deutsch", pt: "Português", it: "Italiano", nl: "Nederlands",
  tr: "Türkçe", ru: "Русский", hi: "हिन्दी", ur: "اردو", id: "Bahasa Indonesia", zh: "中文", ja: "日本語",
};
export const DEFAULT_LANGUAGE: MessageLanguage = "en";
export function isMessageLanguage(v: unknown): v is MessageLanguage {
  return typeof v === "string" && Object.hasOwn(messageLanguages, v);
}

/** Longest text each channel takes (a LinkedIn connection note is 300 characters). */
export const channelLimit: Record<MessageChannel, number> = { email: 10_000, linkedin: 300, whatsapp: 1000, facebook: 1000, instagram: 1000 };

/** Where a message of each channel can be opened. */
export const channelVias: Record<MessageChannel, MessageOpenedVia[]> = {
  email: ["gmail", "outlook", "mail_app", "copy"],
  linkedin: ["linkedin", "copy"],
  whatsapp: ["whatsapp", "copy"],
  facebook: ["facebook", "copy"],
  instagram: ["instagram", "copy"],
};

/** Digits for wa.me ("+20 100 123 4567" → "201001234567"); null when it isn't a phone number. */
export function whatsappDigits(v: string | null | undefined): string | null {
  const digits = (v ?? "").replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 20 ? digits : null;
}

/** The handle at the end of a profile URL ("https://www.instagram.com/acme/" → "acme"). */
function handle(url: string | null | undefined, host: RegExp): string | null {
  try {
    const u = new URL(url ?? "");
    if (!host.test(u.hostname)) return null;
    const first = u.pathname.split("/").filter(Boolean)[0];
    return first && !["p", "reel", "stories", "profile.php", "pages", "groups", "people"].includes(first) ? first : null;
  } catch {
    return null;
  }
}

/**
 * The link that opens a conversation in the member's own app. WhatsApp takes
 * the text; Messenger and Instagram don't, so the composer copies it first.
 */
export function conversationUrl(channel: "whatsapp" | "facebook" | "instagram", target: { whatsapp?: string | null; facebookUrl?: string | null; instagramUrl?: string | null }, text: string): string | null {
  if (channel === "whatsapp") {
    const n = whatsappDigits(target.whatsapp);
    return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
  }
  if (channel === "facebook") {
    const h = handle(target.facebookUrl, /(^|\.)facebook\.com$/i);
    return h ? `https://m.me/${encodeURIComponent(h)}` : target.facebookUrl ?? null;
  }
  const h = handle(target.instagramUrl, /(^|\.)instagram\.com$/i);
  return h ? `https://ig.me/m/${encodeURIComponent(h)}` : target.instagramUrl ?? null;
}
