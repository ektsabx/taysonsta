// Pure helpers for WhatsApp/SMS messaging (services/bos/messaging.ts).

// Digits only, international form without "+" (E.164 minus the plus);
// "00" prefix dropped. 7–15 digits or null.
export function normalizePhone(p: string | null | undefined): string | null {
  let d = (p ?? "").replace(/[^0-9]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  return d.length >= 7 && d.length <= 15 ? d : null;
}

// {{1}}, {{2}} … replaced by position; missing values stay visible so the
// caller can refuse to send.
export function renderTemplate(body: string, vars: string[]) {
  return body.replace(/\{\{(\d+)\}\}/g, (m, n) => {
    const v = vars[Number(n) - 1];
    return v != null && String(v).trim() !== "" ? String(v).trim().slice(0, 1000) : m;
  });
}

const STOP = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "الغاء", "إلغاء", "ايقاف", "إيقاف", "توقف", "الغاء الاشتراك", "إلغاء الاشتراك"];

// The whole message is an opt-out keyword (not a sentence that contains one).
export function isStopKeyword(text: string) {
  const t = text.trim().toLowerCase().replace(/[.!؟?]+$/g, "").replace(/\s+/g, " ");
  return STOP.includes(t);
}

// wa.me link for the click-to-WhatsApp widget.
export function waLink(phone: string, text?: string | null) {
  return `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
