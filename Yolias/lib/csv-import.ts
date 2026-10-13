// CSV import of contacts into Prospects (owner brief 2026-10-12). Pure, used
// by the browser (preview) and the server (validation), unit-tested.

export const importFields = ["name", "title", "company", "domain", "email", "phone", "linkedin_url", "industry", "city", "country", "employee_count"] as const;
export type ImportField = (typeof importFields)[number];
export type ImportKind = "person" | "company" | "local_business";
export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** RFC 4180 CSV (quotes, escaped quotes, CRLF, BOM); the delimiter (, ; or tab) is taken from the first line. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const count = (c: string) => first.split(c).length - 1;
  const delim = [",", ";", "\t"].reduce((best, c) => (count(c) > count(best) ? c : best), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const synonyms: Record<ImportField, string[]> = {
  name: ["name", "full name", "fullname", "contact", "contact name", "person", "business name", "الاسم"],
  title: ["title", "job title", "position", "role", "designation", "المسمى", "المسمى الوظيفي"],
  company: ["company", "company name", "organization", "organisation", "account", "employer", "الشركة"],
  domain: ["website", "domain", "url", "company website", "site", "web", "الموقع"],
  email: ["email", "e-mail", "email address", "work email", "mail", "البريد", "البريد الإلكتروني"],
  phone: ["phone", "phone number", "mobile", "telephone", "tel", "whatsapp", "الهاتف", "الجوال"],
  linkedin_url: ["linkedin", "linkedin url", "linkedin profile", "linkedin link"],
  industry: ["industry", "category", "sector", "المجال"],
  city: ["city", "town", "المدينة"],
  country: ["country", "country code", "الدولة"],
  employee_count: ["employees", "employee count", "headcount", "company size", "size", "staff", "عدد الموظفين"],
};

const norm = (h: string) => h.toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();

/** Column index per field, guessed from the header row (-1 = not imported). */
export function guessMapping(header: string[]): Record<ImportField, number> {
  const out = Object.fromEntries(importFields.map((f) => [f, -1])) as Record<ImportField, number>;
  const used = new Set<number>();
  for (const f of importFields) {
    const names = synonyms[f].map(norm);
    const i = header.findIndex((h, idx) => !used.has(idx) && names.includes(norm(h)));
    if (i >= 0) { out[f] = i; used.add(i); }
  }
  return out;
}

/** People when the file has job titles or a separate company column, otherwise companies. */
export function guessKind(m: Record<ImportField, number>): ImportKind {
  return m.title >= 0 || (m.company >= 0 && m.name >= 0 && m.company !== m.name) ? "person" : "company";
}

export interface ImportRow {
  kind: ImportKind;
  name: string;
  title?: string;
  company?: string;
  domain?: string;
  website?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  industry?: string;
  city?: string;
  country?: string;
  employee_count?: number;
}

const clip = (v: string | undefined, max: number) => {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : undefined;
};

/** Website or domain → { website: https URL, domain: host without www }. */
export function normalizeSite(v: string | undefined): { website?: string; domain?: string } {
  const s = clip(v, 300);
  if (!s) return {};
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)) return {};
    return { website: `https://${u.hostname}${u.pathname === "/" ? "" : u.pathname}`.slice(0, 300), domain: u.hostname.replace(/^www\./i, "").toLowerCase() };
  } catch {
    return {};
  }
}

/** One validated row, or null when it has no name. Invalid values are dropped, never guessed. */
export function toImportRow(cells: string[], m: Record<ImportField, number>, kind: ImportKind): ImportRow | null {
  const get = (f: ImportField) => (m[f] >= 0 ? cells[m[f]] : undefined);
  const name = clip(get("name"), 300);
  if (!name) return null;
  const email = clip(get("email"), 254)?.toLowerCase();
  const linkedin = clip(get("linkedin_url"), 500);
  const country = clip(get("country"), 2)?.toUpperCase();
  const employees = Number(String(get("employee_count") ?? "").replace(/[,\s]/g, ""));
  const phone = clip(get("phone"), 40);
  const row: ImportRow = {
    kind,
    name,
    title: kind === "person" ? clip(get("title"), 200) : undefined,
    company: kind === "person" ? clip(get("company"), 300) : undefined,
    ...normalizeSite(get("domain")),
    email: email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : undefined,
    phone: phone && /^\+?[\d\s()./-]{6,40}$/.test(phone) ? phone : undefined,
    linkedin_url: linkedin && /^https:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\//i.test(linkedin) ? linkedin : undefined,
    industry: clip(get("industry"), 120),
    city: clip(get("city"), 120),
    country: country && /^[A-Z]{2}$/.test(country) && clip(get("country"), 3)?.length === 2 ? country : undefined,
    employee_count: Number.isInteger(employees) && employees > 0 && employees <= 10_000_000 ? employees : undefined,
  };
  return row;
}
