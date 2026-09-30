// Import field specs and value normalisation (docs/bos/30 §27). Pure: turns a
// raw cell into a typed value or an error message; references (client by
// email, user by email…) are resolved by the engine.

export type FieldType = "text" | "email" | "phone" | "number" | "int" | "date" | "bool" | "currency" | "enum" | "ref" | "list";

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  max?: number;
  values?: Record<string, string>;    // enum: accepted spellings (lower-cased) → stored value
  ref?: string;                        // ref kind for the engine
  aliases?: string[];
}

export type Normalised = { ok: true; value: string | number | boolean | string[] | null } | { ok: false; error: string };

export function excelSerialToDate(n: number) {
  const ms = Math.round((n - 25569) * 86400_000);
  return new Date(ms).toISOString().slice(0, 10);
}

export function normaliseDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isValid(s) ? s : null;
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s); // DD/MM/YYYY
  if (m) {
    const v = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return isValid(v) ? v : null;
  }
  m = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(s);
  if (m) {
    const v = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    return isValid(v) ? v : null;
  }
  if (/^\d{5}(\.\d+)?$/.test(s)) return excelSerialToDate(Number(s)); // Excel serial
  return null;
}

function isValid(ymd: string) {
  const d = new Date(`${ymd}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
}

// Arabic-Indic digits → ASCII, thousands separators removed.
const digits = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[,\s٬]/g, "").replace(/٫/g, ".");

export function normalise(f: FieldSpec, raw: string | undefined): Normalised {
  const s = (raw ?? "").trim();
  if (!s) return f.required ? { ok: false, error: `${f.label}: مطلوب` } : { ok: true, value: null };
  switch (f.type) {
    case "text":
      return s.length > (f.max ?? 2000) ? { ok: false, error: `${f.label}: أطول من ${f.max ?? 2000} حرف` } : { ok: true, value: s };
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? { ok: true, value: s.toLowerCase() } : { ok: false, error: `${f.label}: بريد غير صالح` };
    case "phone": {
      const p = digits(s).replace(/[^\d+]/g, "");
      return p.replace(/\D/g, "").length >= 7 ? { ok: true, value: p } : { ok: false, error: `${f.label}: رقم غير صالح` };
    }
    case "number": {
      const n = Number(digits(s));
      return Number.isFinite(n) && n >= 0 ? { ok: true, value: n } : { ok: false, error: `${f.label}: رقم غير صالح` };
    }
    case "int": {
      const n = Number(digits(s));
      return Number.isInteger(n) && n >= 0 ? { ok: true, value: n } : { ok: false, error: `${f.label}: عدد صحيح غير صالح` };
    }
    case "date": {
      const d = normaliseDate(s.replace(/[٠-٩]/g, (x) => String("٠١٢٣٤٥٦٧٨٩".indexOf(x))));
      return d ? { ok: true, value: d } : { ok: false, error: `${f.label}: تاريخ غير صالح (YYYY-MM-DD أو DD/MM/YYYY)` };
    }
    case "bool": {
      const v = s.toLowerCase();
      if (["1", "true", "yes", "y", "نعم", "✓"].includes(v)) return { ok: true, value: true };
      if (["0", "false", "no", "n", "لا"].includes(v)) return { ok: true, value: false };
      return { ok: false, error: `${f.label}: قيمة نعم/لا غير صالحة` };
    }
    case "currency":
      return /^[a-z]{3}$/i.test(s) ? { ok: true, value: s.toUpperCase() } : { ok: false, error: `${f.label}: رمز عملة من 3 أحرف` };
    case "enum": {
      const v = f.values?.[s.toLowerCase()];
      return v ? { ok: true, value: v } : { ok: false, error: `${f.label}: قيمة غير معروفة «${s}»` };
    }
    case "list":
      return { ok: true, value: s.split(/[,،;|]/).map((x) => x.trim()).filter(Boolean).slice(0, 30) };
    case "ref":
      return { ok: true, value: s }; // resolved by the engine
  }
}
