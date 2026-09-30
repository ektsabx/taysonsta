// CSV import of ad performance for platforms without an API connection
// (docs/bos/30 §14). Expected columns (header names, any order, case-insensitive):
// date, campaign, [campaign_id], [ad], [ad_id], spend, impressions, clicks,
// [reach], [conversions], [conversion_value], currency.

export interface ImportRow { day: string; campaign: string; campaignId: string; ad: string | null; adId: string | null; spend: number; impressions: number; clicks: number; reach: number | null; conversions: number | null; conversionValue: number | null; currency: string }

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
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

const num = (v: string | undefined, allowNull: boolean): number | null | "bad" => {
  const s = (v ?? "").replace(/[,\s]/g, "");
  if (s === "") return allowNull ? null : 0;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : "bad";
};

export function parseAdsCsv(text: string, accountCurrency: string): { rows: ImportRow[]; errors: string[] } {
  const all = parseCsv(text.replace(/^﻿/, ""));
  if (all.length < 2) return { rows: [], errors: ["الملف فارغ أو بدون بيانات."] };
  const head = all[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const idx = (k: string) => head.indexOf(k);
  for (const k of ["date", "campaign", "spend", "impressions", "clicks"]) if (idx(k) < 0) return { rows: [], errors: [`العمود المطلوب غير موجود: ${k}`] };
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  all.slice(1).forEach((r, i) => {
    const line = i + 2;
    const g = (k: string) => (idx(k) >= 0 ? r[idx(k)]?.trim() : undefined);
    const day = g("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return void errors.push(`سطر ${line}: التاريخ بصيغة YYYY-MM-DD.`);
    const currency = (g("currency") || accountCurrency).toUpperCase();
    if (currency !== accountCurrency) return void errors.push(`سطر ${line}: العملة ${currency} تختلف عن عملة الحساب ${accountCurrency} — لا تُخلط العملات.`);
    const vals = { spend: num(g("spend"), false), impressions: num(g("impressions"), false), clicks: num(g("clicks"), false), reach: num(g("reach"), true), conversions: num(g("conversions"), true), conversionValue: num(g("conversion_value"), true) };
    if (Object.values(vals).includes("bad")) return void errors.push(`سطر ${line}: رقم غير صالح.`);
    const campaign = g("campaign") ?? "";
    if (!campaign) return void errors.push(`سطر ${line}: اسم الحملة مطلوب.`);
    rows.push({ day, campaign, campaignId: g("campaign_id") || campaign, ad: g("ad") || null, adId: g("ad_id") || g("ad") || null, spend: vals.spend as number, impressions: Math.round(vals.impressions as number), clicks: Math.round(vals.clicks as number), reach: vals.reach as number | null, conversions: vals.conversions as number | null, conversionValue: vals.conversionValue as number | null, currency });
  });
  return { rows, errors };
}
