// Deterministic safety net (D-197): an obvious opt-out is honoured even when
// no AI is connected. Arabic and English; matching is code, not an LLM.
const STOP = /\b(unsubscribe|stop (emailing|contacting|messaging)|remove me|do not (contact|email)|don't (contact|email) me|opt[ -]?out)\b|إلغاء الاشتراك|لا (ترسل|تراسل|تتواصل)|توقف(وا)? عن (مراسلتي|التواصل)|احذف(وا)? (بياناتي|رقمي|بريدي)/i;

export const isStopRequest = (text: string) => STOP.test(text);
