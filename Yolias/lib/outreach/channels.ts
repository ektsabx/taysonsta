import type { MessageChannel, MessageObjective, MessageTone } from "@/types/database";

// What a prepared message can be (shared by the server and the composer):
// objectives, tones, languages and the links that open the member's own mail app.

// Email only (owner, 2026-10-30, D-269): Yolias writes, sends and reads email.
// Other channels exist only as old message rows from before.
export const channels: MessageChannel[] = ["email"];
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

/** Longest email body Yolias keeps. */
export const EMAIL_LIMIT = 10_000;

const enc = encodeURIComponent;
/** Opens a new email in the member's Gmail, Outlook or default mail app, filled in. */
export function composeUrl(client: "gmail" | "outlook" | "mail_app", to: string, subject: string, body: string) {
  if (client === "gmail") return `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}`;
  if (client === "outlook") return `https://outlook.office.com/mail/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`;
  return `mailto:${enc(to)}?subject=${enc(subject)}&body=${enc(body)}`;
}
