// International phone numbers (2026-10-12). Stored as E.164: "+", the country
// code and the number, 8 to 15 digits in all (ITU-T E.164). No country is
// assumed: the number must start with + and its country code, so every
// country is accepted the same way. Spaces, dots, dashes and brackets are
// allowed while typing; a leading 00 counts as +.

export const E164 = /^\+[1-9]\d{7,14}$/;

/** "+20 100 123 4567" → "+201001234567"; null when it isn't a valid international number. */
export function normalizePhone(input: string): string | null {
  let v = input.trim().replace(/[\s().\- ]/g, "");
  // Arabic-Indic and Persian digits typed on phones.
  v = v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  if (v.startsWith("00")) v = `+${v.slice(2)}`;
  return E164.test(v) ? v : null;
}
