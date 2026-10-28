import { normalizeEmail, normalizeName, registrableDomain, linkedinKey } from "../intel/identity";
import { E164 } from "../phone";

// Datasets imported in Yolias Admin (owner brief 2026-10-20, D-248): bought
// lists, open data and registries. Every row is mapped to the fields below,
// normalised here (the same code in Admin and in tests), then matched with
// what the shared database already has (intel.dataset_merge). Nothing is
// guessed: a value that can't be read is dropped and reported, never invented.
// Shared by Yolias and Yolias Admin: no "@/" imports.

export type DatasetEntity = "company" | "person";

export interface DatasetField {
  key: string;
  label: string;
  entity: DatasetEntity | "both";
  /** Header names (English / Arabic) recognised without AI. */
  aliases: string[];
}

export const DATASET_FIELDS: DatasetField[] = [
  { key: "company_name", label: "اسم الشركة", entity: "both", aliases: ["company", "company name", "business name", "organization", "organisation", "account", "account name", "name of company", "trade name", "legal name", "denomination", "الشركة", "اسم الشركة", "اسم المنشأة", "المنشأة", "الاسم التجاري", "اسم النشاط"] },
  { key: "website", label: "الموقع / الدومين", entity: "both", aliases: ["website", "web site", "url", "site", "domain", "company domain", "homepage", "web", "الموقع", "الموقع الإلكتروني", "الدومين", "النطاق"] },
  { key: "email", label: "البريد الإلكتروني", entity: "both", aliases: ["email", "e-mail", "mail", "email address", "work email", "business email", "contact email", "البريد", "البريد الإلكتروني", "الايميل", "الإيميل", "ايميل"] },
  { key: "phone", label: "الهاتف", entity: "both", aliases: ["phone", "telephone", "tel", "mobile", "phone number", "contact number", "whatsapp", "الهاتف", "التليفون", "رقم الهاتف", "الجوال", "الموبايل", "رقم الجوال", "واتساب"] },
  { key: "country", label: "الدولة", entity: "both", aliases: ["country", "country code", "nation", "الدولة", "البلد"] },
  { key: "city", label: "المدينة", entity: "both", aliases: ["city", "town", "locality", "المدينة", "المحافظة", "الإمارة", "الامارة"] },
  { key: "address", label: "العنوان", entity: "company", aliases: ["address", "street", "street address", "full address", "location", "العنوان", "عنوان"] },
  { key: "industry", label: "القطاع", entity: "company", aliases: ["industry", "sector", "vertical", "activity", "business activity", "naf", "sic", "القطاع", "النشاط", "المجال", "نوع النشاط"] },
  { key: "category", label: "التصنيف (نشاط محلي)", entity: "company", aliases: ["category", "categories", "type", "business type", "place type", "التصنيف", "الفئة"] },
  { key: "description", label: "الوصف", entity: "company", aliases: ["description", "about", "summary", "overview", "الوصف", "نبذة"] },
  { key: "employee_count", label: "عدد الموظفين", entity: "company", aliases: ["employees", "employee count", "headcount", "staff", "company size", "size", "number of employees", "عدد الموظفين", "الموظفين", "حجم الشركة"] },
  { key: "company_linkedin", label: "LinkedIn الشركة", entity: "company", aliases: ["company linkedin", "linkedin company", "company linkedin url", "linkedin page"] },
  { key: "registry_id", label: "رقم السجل / المعرّف", entity: "company", aliases: ["registration number", "company number", "cr number", "commercial registration", "siren", "siret", "crn", "license number", "registry id", "external id", "id", "السجل التجاري", "رقم السجل", "رقم السجل التجاري", "رقم الترخيص"] },
  { key: "full_name", label: "اسم الشخص", entity: "person", aliases: ["full name", "name", "contact name", "person", "contact", "الاسم", "الاسم الكامل", "اسم الشخص", "جهة الاتصال"] },
  { key: "first_name", label: "الاسم الأول", entity: "person", aliases: ["first name", "firstname", "given name", "الاسم الأول"] },
  { key: "last_name", label: "اسم العائلة", entity: "person", aliases: ["last name", "lastname", "surname", "family name", "اسم العائلة", "اللقب"] },
  { key: "title", label: "المسمى الوظيفي", entity: "person", aliases: ["title", "job title", "position", "role", "designation", "المسمى", "المسمى الوظيفي", "الوظيفة", "المنصب"] },
  { key: "linkedin_url", label: "LinkedIn الشخص", entity: "person", aliases: ["linkedin", "linkedin url", "linkedin profile", "person linkedin", "profile url", "لينكدان", "لينكد إن"] },
];

export const fieldKeys = DATASET_FIELDS.map((f) => f.key);
export type DatasetMapping = Record<string, number>;

const fold = (s: string) => s.toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[_\-./]+/g, " ").replace(/\s+/g, " ").trim();

/** Header → field by name, without AI (the fallback and the starting point for review). */
export function guessDatasetMapping(headers: string[]): DatasetMapping {
  const out: DatasetMapping = {};
  const taken = new Set<number>();
  const h = headers.map((x) => fold(x ?? ""));
  for (const pass of ["exact", "contains"] as const) {
    for (const f of DATASET_FIELDS) {
      if (out[f.key] !== undefined) continue;
      const aliases = f.aliases.map(fold);
      const i = h.findIndex((x, n) => !taken.has(n) && x && (pass === "exact" ? aliases.includes(x) : aliases.some((a) => a.length > 3 && x.includes(a))));
      if (i >= 0) { out[f.key] = i; taken.add(i); }
    }
  }
  return out;
}

/** Person rows when a name or title column is mapped, else companies. */
export function guessEntity(m: DatasetMapping): DatasetEntity {
  return m.full_name !== undefined || m.first_name !== undefined || m.title !== undefined || m.linkedin_url !== undefined ? "person" : "company";
}

// ───────────────────────── Countries ─────────────────────────

const ISO = "AD AE AF AG AI AL AM AO AR AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NZ OM PA PE PG PH PK PL PR PS PT PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS SV SY SZ TD TG TH TJ TL TM TN TO TR TT TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW".split(" ");
const extraCountryNames: Record<string, string> = {
  uk: "GB", "united kingdom": "GB", "great britain": "GB", england: "GB", britain: "GB", usa: "US", "u s a": "US", "united states of america": "US", america: "US",
  uae: "AE", "u a e": "AE", emirates: "AE", "united arab emirates": "AE", ksa: "SA", "saudi": "SA", "saudi arabia": "SA", "kingdom of saudi arabia": "SA",
  "الامارات": "AE", "الامارات العربيه المتحده": "AE", "دوله الامارات": "AE", "السعوديه": "SA", "المملكه العربيه السعوديه": "SA", "المملكه": "SA",
  "مصر": "EG", "جمهوريه مصر العربيه": "EG", "الكويت": "KW", "دوله الكويت": "KW", "قطر": "QA", "البحرين": "BH", "عمان": "OM", "سلطنه عمان": "OM", "الاردن": "JO", "لبنان": "LB",
  "المغرب": "MA", "تونس": "TN", "الجزائر": "DZ", "العراق": "IQ", "ليبيا": "LY", "السودان": "SD", "اليمن": "YE", "فلسطين": "PS", "سوريا": "SY", "تركيا": "TR",
};
let countryIndex: Map<string, string> | null = null;
function countries(): Map<string, string> {
  if (countryIndex) return countryIndex;
  const m = new Map<string, string>();
  for (const loc of ["en", "ar", "fr"]) {
    let names: Intl.DisplayNames | null = null;
    try { names = new Intl.DisplayNames([loc], { type: "region" }); } catch { names = null; }
    for (const code of ISO) { const n = names?.of(code); if (n && n !== code) m.set(fold(n), code); }
  }
  for (const [k, v] of Object.entries(extraCountryNames)) m.set(fold(k), v);
  countryIndex = m;
  return m;
}

/** "Egypt", "مصر", "eg", "EGY"… → "EG"; null when unknown. */
export function normalizeCountry(v: string | null | undefined, fallback: string | null = null): string | null {
  const s = (v ?? "").trim();
  if (!s) return fallback;
  if (/^[A-Za-z]{2}$/.test(s) && ISO.includes(s.toUpperCase())) return s.toUpperCase();
  const alpha3: Record<string, string> = { EGY: "EG", SAU: "SA", ARE: "AE", KWT: "KW", QAT: "QA", BHR: "BH", OMN: "OM", JOR: "JO", LBN: "LB", MAR: "MA", TUN: "TN", DZA: "DZ", IRQ: "IQ", GBR: "GB", USA: "US", FRA: "FR", DEU: "DE", TUR: "TR", IND: "IN", PAK: "PK" };
  if (/^[A-Za-z]{3}$/.test(s) && alpha3[s.toUpperCase()]) return alpha3[s.toUpperCase()];
  return countries().get(fold(s)) ?? fallback;
}

// ───────────────────────── Cities ─────────────────────────

/**
 * One name per city, so a file that says «القاهرة» and a search for "Cairo"
 * meet (owner, 2026-10-21). Known cities of Yolias markets map to their
 * English name; any other city is kept as written.
 */
const CITY_NAMES: Record<string, string[]> = {
  Cairo: ["cairo", "القاهره", "القاهرة الكبرى", "le caire", "new cairo", "القاهره الجديده"],
  Giza: ["giza", "الجيزه", "gizeh", "6th of october", "6 october", "السادس من اكتوبر", "6 اكتوبر", "sheikh zayed", "الشيخ زايد"],
  Alexandria: ["alexandria", "الاسكندريه", "alex", "اسكندريه"],
  Mansoura: ["mansoura", "المنصوره"], Tanta: ["tanta", "طنطا"], Zagazig: ["zagazig", "الزقازيق"], Port_Said: ["port said", "بورسعيد", "بور سعيد"],
  Suez: ["suez", "السويس"], Ismailia: ["ismailia", "الاسماعيليه"], Luxor: ["luxor", "الاقصر"], Aswan: ["aswan", "اسوان"], Hurghada: ["hurghada", "الغردقه"], Asyut: ["asyut", "assiut", "اسيوط"],
  Riyadh: ["riyadh", "الرياض", "ar riyadh", "riyad"], Jeddah: ["jeddah", "jedda", "jiddah", "جده"], Mecca: ["mecca", "makkah", "مكه", "مكه المكرمه"],
  Medina: ["medina", "madinah", "al madinah", "المدينه المنوره"], Dammam: ["dammam", "الدمام"], Khobar: ["khobar", "al khobar", "الخبر"], Dhahran: ["dhahran", "الظهران"],
  Taif: ["taif", "الطائف"], Tabuk: ["tabuk", "تبوك"], Abha: ["abha", "ابها"], Buraydah: ["buraydah", "بريده"], Jubail: ["jubail", "الجبيل"], Hail: ["hail", "حائل"], Al_Ahsa: ["al ahsa", "al hasa", "الاحساء", "الهفوف", "hofuf"],
  Dubai: ["dubai", "دبي"], Abu_Dhabi: ["abu dhabi", "abudhabi", "ابوظبي", "ابو ظبي"], Sharjah: ["sharjah", "الشارقه"], Ajman: ["ajman", "عجمان"], Ras_Al_Khaimah: ["ras al khaimah", "رأس الخيمه", "راس الخيمه"],
  Fujairah: ["fujairah", "الفجيره"], Al_Ain: ["al ain", "العين"], Umm_Al_Quwain: ["umm al quwain", "ام القيوين"],
  Kuwait_City: ["kuwait city", "مدينه الكويت"], Hawalli: ["hawalli", "حولي"], Salmiya: ["salmiya", "السالميه"], Farwaniya: ["farwaniya", "الفروانيه"], Jahra: ["jahra", "الجهراء"], Ahmadi: ["ahmadi", "الاحمدي"],
  Doha: ["doha", "الدوحه"], Al_Rayyan: ["al rayyan", "الريان"], Manama: ["manama", "المنامه"], Muscat: ["muscat", "مسقط"], Salalah: ["salalah", "صلاله"],
  Beirut: ["beirut", "بيروت"], Casablanca: ["casablanca", "الدار البيضاء"], Rabat: ["rabat", "الرباط"], Marrakesh: ["marrakesh", "marrakech", "مراكش"], Algiers: ["algiers", "الجزائر العاصمه"],
  Baghdad: ["baghdad", "بغداد"], Erbil: ["erbil", "اربيل"], Basra: ["basra", "البصره"], Khartoum: ["khartoum", "الخرطوم"], Tripoli: ["tripoli", "طرابلس"], Istanbul: ["istanbul", "اسطنبول"],
  London: ["london", "لندن"], Paris: ["paris", "باريس"],
};
let cityIndex: Map<string, string> | null = null;

/** "القاهرة", "cairo", "CAIRO" → "Cairo"; unknown cities are kept as written. */
export function canonicalCity(v: string | null | undefined): string | null {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (!cityIndex) {
    cityIndex = new Map();
    for (const [name, aliases] of Object.entries(CITY_NAMES)) for (const a of [name.replace(/_/g, " "), ...aliases]) cityIndex.set(fold(a), name.replace(/_/g, " "));
  }
  const key = fold(s).replace(/^(مدينه|محافظه|city of)\s+/, "").replace(/\s+(city|governorate|محافظه)$/, "");
  return cityIndex.get(key) ?? cityIndex.get(fold(s)) ?? s.slice(0, 120);
}

/** Every name of the city `v` names (its English name first), folded; just `v` when it isn't a known city. */
export function cityNames(v: string | null | undefined): string[] {
  const canon = canonicalCity(v);
  if (!canon) return [];
  const group = CITY_NAMES[canon.replace(/ /g, "_")];
  return [...new Set([canon, ...(group ?? []), (v ?? "").trim()].map((x) => x.trim()).filter(Boolean))];
}

/** Two city names that are the same city, in Arabic or English («القاهرة» and "Cairo"), or one inside the other. */
export function sameCity(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = canonicalCity(a), y = canonicalCity(b);
  if (!x || !y) return false;
  const fx = fold(x), fy = fold(y);
  return fx === fy || fx.includes(fy) || fy.includes(fx);
}

// ───────────────────────── Phones ─────────────────────────

/** Calling code and whether local numbers start with a trunk 0. */
const calling: Record<string, string> = {
  EG: "20", SA: "966", AE: "971", KW: "965", QA: "974", BH: "973", OM: "968", JO: "962", LB: "961", MA: "212", TN: "216", DZ: "213", IQ: "964", LY: "218", SD: "249", YE: "967", PS: "970", SY: "963",
  GB: "44", FR: "33", DE: "49", US: "1", CA: "1", TR: "90", IN: "91", PK: "92", ES: "34", IT: "39", NL: "31", BE: "32", CH: "41", IE: "353", AU: "61", SE: "46", NO: "47", DK: "45", PL: "48", PT: "351", GR: "30", AT: "43",
};

/** International E.164; local numbers use the row's country ("010 1234 5678" in EG → "+201012345678"). */
export function normalizePhoneFor(input: string | null | undefined, country: string | null): string | null {
  let v = (input ?? "").trim();
  if (!v) return null;
  v = v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  v = v.split(/[,;/|]| or | ext/i)[0].replace(/[\s().\- ]/g, "");
  if (v.startsWith("00")) v = `+${v.slice(2)}`;
  if (!v.startsWith("+")) {
    const cc = country ? calling[country] : undefined;
    if (!cc || !/^\d{6,14}$/.test(v)) return null;
    if (v.startsWith(cc) && v.length > cc.length + 7) v = `+${v}`;
    else v = `+${cc}${v.replace(/^0+/, "")}`;
  }
  return E164.test(v) ? v : null;
}

// ───────────────────────── Names ─────────────────────────

const suffixes = /\b(llc|l\.l\.c|ltd|limited|inc|incorporated|corp|corporation|co|company|plc|gmbh|sarl|sas|sa|srl|bv|ag|fze|fzco|fz llc|wll|w\.l\.l|spc|est|establishment|group|holding|holdings)\b\.?/gi;
const arabicSuffixes = /(شركه|ش\.م\.م|ش م م|ذ\.م\.م|ذ م م|مؤسسه|للتجاره|المحدوده|القابضه|ش\.م\.ك|ش\.م\.ع)/g;

/** Comparable company name: lower case, Arabic letters folded, legal suffixes and punctuation removed. */
export function companyKey(name: string | null | undefined): string {
  const s = fold(name ?? "").replace(arabicSuffixes, " ").replace(suffixes, " ").replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\bthe\b/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

const clean = (v: string | undefined | null, max = 300) => {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s && !/^(n\/?a|null|none|-|\u2014|0|#n\/a|undefined)$/i.test(s) ? s.slice(0, max) : null;
};

// ───────────────────────── Rows ─────────────────────────

export interface NormalizedRow {
  entity: DatasetEntity;
  company: {
    name: string | null; key: string | null; domain: string | null; website: string | null; email: string | null; phone: string | null;
    country: string | null; city: string | null; address: string | null; industry: string | null; category: string | null; description: string | null;
    employee_count: number | null; linkedin_url: string | null; registry_id: string | null;
  };
  person: { full_name: string | null; normalized: string | null; title: string | null; email: string | null; phone: string | null; linkedin: string | null } | null;
  problems: string[];
}

const free = new Set(["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "aol.com", "msn.com", "yandex.com", "mail.ru", "proton.me", "protonmail.com", "gmx.com", "yahoo.co.uk", "hotmail.co.uk"]);

function site(v: string | null): { website: string | null; domain: string | null } {
  if (!v) return { website: null, domain: null };
  const raw = v.trim().replace(/^[<(]+|[>),;]+$/g, "");
  if (raw.includes("@") || /\s/.test(raw)) return { website: null, domain: null };
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!u.hostname.includes(".")) return { website: null, domain: null };
    const domain = registrableDomain(u.hostname);
    return { website: domain ? `https://${u.hostname.toLowerCase()}${u.pathname === "/" ? "" : u.pathname}`.slice(0, 300) : null, domain };
  } catch {
    return { website: null, domain: null };
  }
}

/**
 * One row → normalised company (+ person). `defaults` are the dataset's own
 * facts (its country when the file has no country column).
 */
export function normalizeRow(cells: string[], m: DatasetMapping, entity: DatasetEntity, defaults: { country?: string | null } = {}): NormalizedRow {
  const get = (k: string) => (m[k] !== undefined && m[k] >= 0 ? clean(cells[m[k]]) : null);
  const problems: string[] = [];
  const country = normalizeCountry(get("country"), defaults.country ?? null);
  if (get("country") && !normalizeCountry(get("country"))) problems.push("country");
  const { website, domain: siteDomain } = site(get("website"));
  if (get("website") && !siteDomain) problems.push("website");
  const rawEmail = get("email");
  const email = rawEmail ? normalizeEmail(rawEmail.replace(/^mailto:/i, "").split(/[,;\s]/)[0]) : null;
  if (rawEmail && !email) problems.push("email");
  const emailDomain = email ? email.split("@")[1] : null;
  // A business email's domain identifies the company when there's no website.
  const domain = siteDomain ?? (emailDomain && !free.has(emailDomain) ? registrableDomain(emailDomain) : null);
  const rawPhone = get("phone");
  const phone = normalizePhoneFor(rawPhone, country);
  if (rawPhone && !phone) problems.push("phone");
  const empRaw = get("employee_count");
  let employee_count: number | null = null;
  if (empRaw) {
    const nums = (empRaw.replace(/[,٬\s]/g, "").match(/\d+/g) ?? []).map(Number);
    employee_count = nums.length ? Math.max(...nums) : null;
    if (employee_count != null && (employee_count <= 0 || employee_count > 5_000_000)) employee_count = null;
    if (employee_count == null) problems.push("employee_count");
  }
  const companyLinkedin = get("company_linkedin");
  const companyName = get("company_name");
  const company = {
    name: companyName, key: companyName ? companyKey(companyName) || null : null, domain, website,
    email: entity === "company" ? email : null, phone: entity === "company" ? phone : null,
    country, city: canonicalCity(get("city")), address: get("address"), industry: get("industry"), category: get("category"), description: clean(cells[m.description ?? -1], 2000),
    employee_count, linkedin_url: companyLinkedin && linkedinKey(companyLinkedin) ? `https://www.${linkedinKey(companyLinkedin)}` : null, registry_id: get("registry_id"),
  };
  let person: NormalizedRow["person"] = null;
  if (entity === "person") {
    const full = get("full_name") ?? ([get("first_name"), get("last_name")].filter(Boolean).join(" ") || null);
    const li = linkedinKey(get("linkedin_url"));
    if (get("linkedin_url") && !li) problems.push("linkedin_url");
    person = { full_name: full, normalized: full ? normalizeName(full) || null : null, title: get("title"), email, phone, linkedin: li ? `https://www.${li}` : null };
    if (!full) problems.push("missing_name");
  } else if (!companyName && !domain) {
    problems.push("missing_name");
  }
  if (entity === "company" && !companyName && domain) company.name = domain;
  return { entity, company, person, problems };
}

/** Whether a normalised row can be stored at all (a name or an identity). */
export function usable(r: NormalizedRow): boolean {
  if (r.entity === "person") return Boolean(r.person?.full_name && (r.company.name || r.company.domain));
  return Boolean(r.company.name || r.company.domain);
}

export const problemLabels: Record<string, string> = {
  country: "دولة غير معروفة", website: "موقع غير صالح", email: "بريد غير صالح", phone: "هاتف غير صالح", employee_count: "عدد موظفين غير مفهوم",
  linkedin_url: "رابط LinkedIn غير صالح", missing_name: "بدون اسم أو معرّف", missing_company: "شخص بدون شركة",
};
