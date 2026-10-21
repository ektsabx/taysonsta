import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { ValidationError } from "@/lib/bos/errors";
import { resolveConnection } from "@/services/bos/integrations";
import { createDataset, finishImport, MAX_BATCH_ROWS, stageBatch, type DatasetInput } from "@/services/yolias/datasets";
import { registrableDomain } from "../../Yolias/lib/intel/identity";
import type { DatasetMapping } from "../../Yolias/lib/datasets/normalize";

// Open sources for the companies database (owner approval 2026-10-20, D-248).
// Each pull becomes a dataset with the source's licence filled in, then goes
// through the same cleaning, matching and report as a bought file, and can be
// removed by source. Only what the source publishes is stored.

const UA = "YoliasBot/1.0 (+https://www.yolias.com; data@yolias.com)";

export type OpenSourceId = "osm" | "sirene" | "companies_house" | "common_crawl" | "wikidata" | "gleif";

interface Pulled { headers: string[]; rows: string[][]; mapping: DatasetMapping; note: string }

const clean = (v: unknown) => String(v ?? "").replace(/["\\\n\r]/g, " ").trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string, init: RequestInit = {}, timeoutMs = 60_000): Promise<unknown> {
  const res = await fetch(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new ValidationError(`المصدر رد بخطأ ${res.status}. حاول لاحقًا.`);
  return res.json();
}

// ───────────────────────── OpenStreetMap (Overpass) ─────────────────────────

// Public Overpass instances (wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances).
// A busy server answers 429 / 502 / 504 and asks for exponential backoff; we
// try the next instance after a growing wait, within one overall time budget.
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

async function overpass(query: string): Promise<unknown> {
  const deadline = Date.now() + 240_000;
  let wait = 2_000;
  let last = "";
  for (let attempt = 0; attempt < 6 && Date.now() < deadline; attempt++) {
    const url = OVERPASS[attempt % OVERPASS.length];
    const res = await fetch(url, {
      method: "POST", headers: { "User-Agent": UA, Accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`, signal: AbortSignal.timeout(Math.max(10_000, Math.min(130_000, deadline - Date.now()))),
    }).catch((e) => { last = e instanceof Error ? e.message : "network"; return null; });
    if (res?.ok) {
      const text = await res.text();
      try { return JSON.parse(text); } catch { last = "invalid answer"; }
    } else if (res && ![429, 502, 503, 504].includes(res.status)) {
      throw new ValidationError(`OpenStreetMap رد بخطأ ${res.status}.`);
    } else if (res) last = `HTTP ${res.status}`;
    await sleep(Math.min(wait, Math.max(0, deadline - Date.now())));
    wait *= 2;
  }
  throw new ValidationError(`خوادم OpenStreetMap مشغولة الآن (${last}). حاول بعد دقائق أو قلّل المنطقة أو الحد الأقصى.`);
}

export const OSM_KEYS = ["shop", "office", "amenity", "craft", "healthcare", "tourism", "industrial"] as const;

/** Businesses mapped in OpenStreetMap in a country (and city), by tag. ODbL. */
async function osm(p: { country: string; city: string; key: string; value: string; contactOnly: boolean; limit: number }): Promise<Pulled> {
  if (!/^[A-Z]{2}$/.test(p.country)) throw new ValidationError("رمز الدولة حرفان (مثل EG).", { country: "ISO" });
  if (!(OSM_KEYS as readonly string[]).includes(p.key)) throw new ValidationError("اختر نوع النشاط.", { key: "مطلوب" });
  const value = clean(p.value).replace(/[^\p{L}\p{N}_;: -]/gu, "");
  const city = clean(p.city);
  const area = city
    ? `area["ISO3166-1"="${p.country}"][admin_level=2]->.c;area(area.c)[~"^name(:en|:ar|:fr)?$"~"^${city.replace(/[^\p{L}\p{N} '-]/gu, "")}$",i]["boundary"="administrative"]->.a;`
    : `area["ISO3166-1"="${p.country}"][admin_level=2]->.a;`;
  const tag = value ? `["${p.key}"="${value}"]` : `["${p.key}"]`;
  const contact = p.contactOnly ? `[~"^(website|contact:website|url|phone|contact:phone|contact:mobile|email|contact:email)$"~"."]` : "";
  const q = `[out:json][timeout:120];${area}nwr(area.a)["name"]${tag}${contact};out center tags ${p.limit};`;
  const body = (await overpass(q)) as { elements?: { type: string; id: number; tags?: Record<string, string> }[]; remark?: string };
  if (body.remark && /error|timed out/i.test(body.remark)) throw new ValidationError(`OpenStreetMap: ${body.remark.slice(0, 200)}`);
  const rows = (body.elements ?? []).map((e) => {
    const t = e.tags ?? {};
    const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
    return [
      t.name ?? t["name:en"] ?? t["name:ar"] ?? "", t.website ?? t["contact:website"] ?? t.url ?? "", t.email ?? t["contact:email"] ?? "",
      t.phone ?? t["contact:phone"] ?? t["contact:mobile"] ?? "", t["addr:city"] ?? city, [street, t["addr:district"] ?? t["addr:suburb"]].filter(Boolean).join("، "),
      `${p.key}=${t[p.key] ?? value}`, p.country, `osm:${e.type}/${e.id}`,
    ];
  });
  return { headers: ["name", "website", "email", "phone", "city", "address", "category", "country", "osm_id"], rows, mapping: { company_name: 0, website: 1, email: 2, phone: 3, city: 4, address: 5, category: 6, country: 7, registry_id: 8 }, note: `${rows.length} مكان من OpenStreetMap` };
}

// ───────────────────────── France: SIRENE (API Recherche d'entreprises) ─────────────────────────

const tranche: Record<string, string> = { "00": "0", "01": "1-2", "02": "3-5", "03": "6-9", "11": "10-19", "12": "20-49", "21": "50-99", "22": "100-199", "31": "200-249", "32": "250-499", "41": "500-999", "42": "1000-1999", "51": "2000-4999", "52": "5000-9999", "53": "10000" };

/** Active French companies by NAF code and département (INSEE Sirene, Licence Ouverte 2.0). No key. */
async function sirene(p: { naf: string; departement: string; pages: number }): Promise<Pulled> {
  if (!/^\d{2}\.\d{2}[A-Z]$/.test(p.naf)) throw new ValidationError("كود NAF مثل 62.01Z.", { naf: "مثل 62.01Z" });
  if (p.departement && !/^(\d{2,3}|2A|2B)$/.test(p.departement)) throw new ValidationError("رقم المقاطعة مثل 75.", { departement: "مثل 75" });
  const rows: string[][] = [];
  for (let page = 1; page <= p.pages; page++) {
    const qs = new URLSearchParams({ activite_principale: p.naf, etat_administratif: "A", per_page: "25", page: String(page), ...(p.departement ? { departement: p.departement } : {}) });
    const body = (await getJson(`https://recherche-entreprises.api.gouv.fr/search?${qs}`)) as { results?: Record<string, unknown>[]; total_pages?: number };
    for (const r of body.results ?? []) {
      const est = ((r.matching_etablissements as Record<string, unknown>[] | undefined)?.[0] ?? r.siege ?? {}) as Record<string, unknown>;
      rows.push([
        clean(r.nom_complet ?? r.nom_raison_sociale), clean(r.siren), clean(est.adresse), clean(est.libelle_commune),
        `NAF ${clean(r.activite_principale ?? est.activite_principale)}`, tranche[clean(r.tranche_effectif_salarie)] ?? "", "FR",
      ]);
    }
    if (!body.total_pages || page >= body.total_pages) break;
    await sleep(250); // the API allows 7 requests a second
  }
  return { headers: ["name", "siren", "address", "city", "industry", "employees", "country"], rows, mapping: { company_name: 0, registry_id: 1, address: 2, city: 3, industry: 4, employee_count: 5, country: 6 }, note: `${rows.length} شركة من Sirene` };
}

// ───────────────────────── UK: Companies House ─────────────────────────

/** Active UK companies by SIC code and location (Open Government Licence). Key in the Integration Hub. */
async function companiesHouse(p: { sic: string; location: string; limit: number }): Promise<Pulled> {
  const conn = await resolveConnection("companies_house");
  if (!conn?.secrets.api_key) throw new ValidationError("أضف مفتاح Companies House من الإعدادات ← مركز التكاملات ← UK Companies House.");
  const sic = p.sic.split(/[,\s]+/).filter((x) => /^\d{4,5}$/.test(x)).slice(0, 10);
  if (!sic.length) throw new ValidationError("كود SIC مثل 62012.", { sic: "مثل 62012" });
  const auth = `Basic ${btoa(`${conn.secrets.api_key}:`)}`;
  const rows: string[][] = [];
  for (let start = 0; start < p.limit; start += 100) {
    const qs = new URLSearchParams({ company_status: "active", sic_codes: sic.join(","), size: "100", start_index: String(start), ...(p.location ? { location: clean(p.location) } : {}) });
    const body = (await getJson(`https://api.company-information.service.gov.uk/advanced-search/companies?${qs}`, { headers: { Authorization: auth } })) as { items?: Record<string, unknown>[]; hits?: number };
    for (const c of body.items ?? []) {
      const a = (c.registered_office_address ?? {}) as Record<string, string>;
      rows.push([clean(c.company_name), clean(c.company_number), [a.address_line_1, a.address_line_2, a.postal_code].filter(Boolean).join(", "), clean(a.locality), `SIC ${((c.sic_codes as string[]) ?? []).join(", ")}`, "GB"]);
    }
    if (!body.items?.length || rows.length >= (body.hits ?? 0)) break;
    await sleep(600); // 600 requests per 5 minutes
  }
  return { headers: ["name", "company_number", "address", "city", "industry", "country"], rows: rows.slice(0, p.limit), mapping: { company_name: 0, registry_id: 1, address: 2, city: 3, industry: 4, country: 5 }, note: `${Math.min(rows.length, p.limit)} شركة من Companies House` };
}

// ───────────────────────── Common Crawl (domains) ─────────────────────────

/** Websites under a domain suffix seen in the latest Common Crawl, for our crawler to read. */
async function commonCrawl(p: { suffix: string; country: string; limit: number }): Promise<Pulled> {
  const suffix = p.suffix.toLowerCase().replace(/^\*?\.+/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(suffix)) throw new ValidationError("امتداد مثل com.eg.", { suffix: "مثل com.eg" });
  const info = (await getJson("https://index.commoncrawl.org/collinfo.json", {}, 30_000)) as { "cdx-api": string }[];
  const api = info[0]?.["cdx-api"];
  if (!api) throw new ValidationError("تعذر الوصول لفهرس Common Crawl.");
  const res = await fetch(`${api}?url=*.${suffix}&output=json&fl=url&filter=status:200&limit=${p.limit * 15}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(120_000) }).catch(() => null);
  if (!res?.ok) throw new ValidationError(`فهرس Common Crawl لا يستجيب الآن${res ? ` (${res.status})` : ""}. حاول لاحقًا، أو استورد قائمة دومينات كملف.`);
  const seen = new Set<string>();
  for (const line of (await res.text()).split("\n")) {
    if (!line.trim()) continue;
    try {
      const d = registrableDomain(new URL((JSON.parse(line) as { url: string }).url).hostname);
      if (d && d.endsWith(suffix)) seen.add(d);
    } catch { /* skip a bad line */ }
    if (seen.size >= p.limit) break;
  }
  const rows = [...seen].map((d) => [d, p.country]);
  return { headers: ["website", "country"], rows, mapping: { website: 0, country: 1 }, note: `${rows.length} موقع من Common Crawl` };
}

// ───────────────────────── Wikidata (CC0) ─────────────────────────

/** Companies in a country that Wikidata lists with their official website (CC0, free SPARQL endpoint). */
async function wikidata(p: { country: string; limit: number }): Promise<Pulled> {
  if (!/^[A-Z]{2}$/.test(p.country)) throw new ValidationError("رمز الدولة حرفان (مثل EG).", { country: "ISO" });
  const q = `SELECT ?c ?cLabel ?site ?indLabel ?emp ?cityLabel WHERE {
    ?country wdt:P297 "${p.country}".
    ?c wdt:P31/wdt:P279* wd:Q4830453; wdt:P17 ?country; wdt:P856 ?site.
    FILTER NOT EXISTS { ?c wdt:P576 ?dissolved }
    OPTIONAL { ?c wdt:P452 ?ind } OPTIONAL { ?c wdt:P1128 ?emp } OPTIONAL { ?c wdt:P159 ?city }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ar,fr". }
  } LIMIT ${p.limit * 3}`;
  const body = (await getJson(`https://query.wikidata.org/sparql?query=${encodeURIComponent(q)}`, { headers: { Accept: "application/sparql-results+json" } }, 120_000)) as { results?: { bindings?: Record<string, { value: string }>[] } };
  const seen = new Map<string, string[]>();
  for (const b of body.results?.bindings ?? []) {
    const id = b.c?.value.split("/").pop() ?? "";
    if (!id || seen.has(id) || /^Q\d+$/.test(b.cLabel?.value ?? "")) continue;
    seen.set(id, [b.cLabel?.value ?? "", b.site?.value ?? "", b.indLabel?.value ?? "", b.emp?.value ?? "", b.cityLabel?.value ?? "", p.country, `wikidata:${id}`]);
    if (seen.size >= p.limit) break;
  }
  const rows = [...seen.values()];
  return { headers: ["name", "website", "industry", "employees", "city", "country", "wikidata_id"], rows, mapping: { company_name: 0, website: 1, industry: 2, employee_count: 3, city: 4, country: 5, registry_id: 6 }, note: `${rows.length} شركة من Wikidata` };
}

// ───────────────────────── GLEIF (CC0) ─────────────────────────

/** Active legal entities with an LEI in a country (GLEIF Golden Copy, CC0, free API). */
async function gleif(p: { country: string; limit: number }): Promise<Pulled> {
  if (!/^[A-Z]{2}$/.test(p.country)) throw new ValidationError("رمز الدولة حرفان (مثل EG).", { country: "ISO" });
  const rows: string[][] = [];
  for (let page = 1; rows.length < p.limit; page++) {
    const qs = `filter%5Bentity.legalAddress.country%5D=${p.country}&filter%5Bentity.status%5D=ACTIVE&page%5Bsize%5D=200&page%5Bnumber%5D=${page}`;
    const body = (await getJson(`https://api.gleif.org/api/v1/lei-records?${qs}`)) as { data?: { attributes?: { lei?: string; entity?: { legalName?: { name?: string }; legalAddress?: { addressLines?: string[]; city?: string }; registeredAs?: string | null; category?: string | null } } }[]; meta?: { pagination?: { lastPage?: number } } };
    for (const r of body.data ?? []) {
      const e = r.attributes?.entity;
      if (!e?.legalName?.name || !r.attributes?.lei) continue;
      rows.push([e.legalName.name, (e.legalAddress?.addressLines ?? []).join(", "), e.legalAddress?.city ?? "", p.country, `lei:${r.attributes.lei}`]);
    }
    if (!body.data?.length || page >= (body.meta?.pagination?.lastPage ?? page)) break;
    await sleep(300); // 60 requests a minute
  }
  return { headers: ["name", "address", "city", "country", "lei"], rows: rows.slice(0, p.limit), mapping: { company_name: 0, address: 1, city: 2, country: 3, registry_id: 4 }, note: `${Math.min(rows.length, p.limit)} كيان من GLEIF` };
}

// ───────────────────────── Run ─────────────────────────

const licences: Record<OpenSourceId, Pick<DatasetInput, "sourceKind" | "vendor" | "sourceUrl" | "licenseName" | "customerFacing" | "redistributable" | "attribution">> = {
  osm: { sourceKind: "open_data", vendor: "OpenStreetMap", sourceUrl: "https://www.openstreetmap.org/copyright", licenseName: "ODbL 1.0", customerFacing: true, redistributable: true, attribution: "© OpenStreetMap contributors" },
  sirene: { sourceKind: "registry", vendor: "INSEE (Sirene)", sourceUrl: "https://recherche-entreprises.api.gouv.fr", licenseName: "Licence Ouverte 2.0 (Etalab)", customerFacing: true, redistributable: true, attribution: "Source : INSEE, base Sirene" },
  companies_house: { sourceKind: "registry", vendor: "Companies House", sourceUrl: "https://find-and-update.company-information.service.gov.uk", licenseName: "Open Government Licence v3.0", customerFacing: true, redistributable: true, attribution: "Contains public sector information licensed under the Open Government Licence v3.0." },
  wikidata: { sourceKind: "open_data", vendor: "Wikidata", sourceUrl: "https://www.wikidata.org/wiki/Wikidata:Licensing", licenseName: "CC0 1.0", customerFacing: true, redistributable: true, attribution: "Wikidata (CC0)" },
  gleif: { sourceKind: "registry", vendor: "GLEIF", sourceUrl: "https://www.gleif.org/en/meta/lei-data-terms-of-use", licenseName: "CC0 1.0 (LEI data)", customerFacing: true, redistributable: true, attribution: "GLEIF LEI data (CC0)" },
  common_crawl: { sourceKind: "crawl", vendor: "Common Crawl + Yolias crawler", sourceUrl: "https://commoncrawl.org/terms-of-use", licenseName: "Common Crawl Terms of Use; public website facts", customerFacing: true, redistributable: true, attribution: null },
};

const int = (v: FormDataEntryValue | null, min: number, max: number, def: number) => {
  const n = Number(String(v ?? "").trim() || def);
  return Number.isInteger(n) ? Math.min(Math.max(n, min), max) : def;
};

/** Pulls from an open source and imports it as a dataset; returns its id. */
export async function runOpenSource(bos: BosUser, id: OpenSourceId, f: FormData): Promise<string> {
  const s = (k: string) => String(f.get(k) ?? "").trim();
  let pulled: Pulled;
  let label: string;
  if (id === "osm") {
    const country = s("country").toUpperCase();
    pulled = await osm({ country, city: s("city"), key: s("key"), value: s("value"), contactOnly: f.get("contact_only") === "on", limit: int(f.get("limit"), 10, 5000, 1000) });
    label = `OpenStreetMap ${s("key")}${s("value") ? `=${s("value")}` : ""} · ${s("city") || country}`;
  } else if (id === "sirene") {
    pulled = await sirene({ naf: s("naf").toUpperCase(), departement: s("departement").toUpperCase(), pages: int(f.get("pages"), 1, 40, 8) });
    label = `Sirene ${s("naf").toUpperCase()}${s("departement") ? ` · ${s("departement")}` : ""}`;
  } else if (id === "companies_house") {
    pulled = await companiesHouse({ sic: s("sic"), location: s("location"), limit: int(f.get("limit"), 10, 2000, 500) });
    label = `Companies House SIC ${s("sic")}${s("location") ? ` · ${s("location")}` : ""}`;
  } else if (id === "common_crawl") {
    pulled = await commonCrawl({ suffix: s("suffix"), country: s("country").toUpperCase(), limit: int(f.get("limit"), 10, 3000, 500) });
    label = `Common Crawl *.${s("suffix").replace(/^\*?\.+/, "")}`;
  } else if (id === "wikidata") {
    pulled = await wikidata({ country: s("country").toUpperCase(), limit: int(f.get("limit"), 10, 3000, 1000) });
    label = `Wikidata · ${s("country").toUpperCase()}`;
  } else if (id === "gleif") {
    pulled = await gleif({ country: s("country").toUpperCase(), limit: int(f.get("limit"), 10, 10000, 2000) });
    label = `GLEIF · ${s("country").toUpperCase()}`;
  } else {
    throw new ValidationError("مصدر غير معروف.");
  }
  if (!pulled.rows.length) throw new ValidationError("المصدر لم يرجع نتائج لهذه الاختيارات.");
  const country = id === "osm" || id === "common_crawl" || id === "wikidata" || id === "gleif" ? s("country").toUpperCase() || null : id === "sirene" ? "FR" : "GB";
  const input: DatasetInput = {
    ...licences[id], name: `${label} · ${new Date().toISOString().slice(0, 10)}`, retentionDays: null, purchasedAt: new Date().toISOString().slice(0, 10), costUsd: 0,
    countries: country ? [country] : [], defaultCountry: country, notes: pulled.note, enrich: id === "common_crawl" || f.get("enrich") === "on",
  };
  const datasetId = await createDataset(bos, input, { name: `${id}.json`, rows: pulled.rows.length, headers: pulled.headers, sample: pulled.rows.slice(0, 10), mapping: pulled.mapping, mappingSource: "rules", entity: "company" });
  for (let at = 0; at < pulled.rows.length; at += MAX_BATCH_ROWS) await stageBatch(datasetId, at + 1, pulled.rows.slice(at, at + MAX_BATCH_ROWS));
  for (let i = 0; i < 50; i++) if ((await finishImport(bos, datasetId)).remaining === 0) break;
  return datasetId;
}
