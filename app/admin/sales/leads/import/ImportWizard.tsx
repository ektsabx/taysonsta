"use client";
import { BosTable } from "@/components/bos/BosTable";

import { Tx, Opt } from "@/components/bos/I18n";

import Link from "next/link";
import { useState, useTransition } from "react";
import { importLeadsAction } from "../actions";

const fields = [
  { key: "name", label: "اسم العميل المحتمل *" },
  { key: "company_name", label: "الشركة" },
  { key: "contact_name", label: "جهة الاتصال" },
  { key: "email", label: "البريد" },
  { key: "phone", label: "الهاتف" },
  { key: "website", label: "الموقع" },
  { key: "country", label: "الدولة" },
  { key: "city", label: "المدينة" },
  { key: "industry", label: "القطاع" },
  { key: "source", label: "المصدر (بالاسم)" },
  { key: "estimated_budget", label: "الميزانية" },
  { key: "budget_currency", label: "العملة" },
  { key: "notes", label: "ملاحظات" },
  { key: "assigned_email", label: "بريد المسؤول (BD)" },
] as const;

// RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function guess(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z]/g, "");
  const map: Record<string, string> = {
    name: "name", leadname: "name", lead: "name", company: "company_name", companyname: "company_name", contact: "contact_name", contactname: "contact_name",
    email: "email", phone: "phone", mobile: "phone", website: "website", country: "country", city: "city", industry: "industry", source: "source",
    budget: "estimated_budget", estimatedbudget: "estimated_budget", currency: "budget_currency", notes: "notes", owner: "assigned_email", assignedto: "assigned_email",
  };
  return map[h] ?? "";
}

export function ImportWizard() {
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<string[]>([]);
  const [mode, setMode] = useState<"skip" | "update">("skip");
  const [result, setResult] = useState<{ ok: boolean; text: string; errors?: string[] } | null>(null);
  const [pending, startTransition] = useTransition();

  const header = rows[0] ?? [];
  const body = rows.slice(1);
  const mappedName = mapping.includes("name") || mapping.includes("company_name");

  return (
    <div className="bos-stack" style={{ gap: 14 }}>
      <section className="bos-form-section">
        <h2><Tx>1. اختر الملف</Tx></h2>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
              setResult({ ok: false, text: "الحد الأقصى لحجم الملف 5MB" });
              return;
            }
            const parsed = parseCsv(await file.text());
            setRows(parsed);
            setMapping((parsed[0] ?? []).map(guess));
            setResult(null);
          }}
        />
        <p className="bos-hint">
          <Tx>الأعمدة المقترحة: name, company, contact, email, phone, website, country, city, industry, source, budget, currency, notes, owner (بريد الموظف).</Tx>
        </p>
      </section>

      {header.length ? (
        <section className="bos-form-section">
          <h2><Tx vars={{ body_count: body.length }}>{"2. ربط الأعمدة ({body_count} صف)"}</Tx></h2>
          <div className="bos-form-grid">
            {header.map((h, i) => (
              <div className="bos-field" key={`${h}-${i}`}>
                <label>{h || `عمود ${i + 1}`}</label>
                <select value={mapping[i] ?? ""} onChange={(e) => setMapping((m) => m.map((v, j) => (j === i ? e.target.value : v)))}>
                  <Opt value="">— تجاهل —</Opt>
                  {fields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="bos-divider" />
          <div className="bos-row">
            <strong style={{ fontSize: 13 }}><Tx>عند وجود بريد مكرر:</Tx></strong>
            <label className="bos-check">
              <input type="radio" checked={mode === "skip"} onChange={() => setMode("skip")} /> <Tx>تخطي الصف</Tx>
            </label>
            <label className="bos-check">
              <input type="radio" checked={mode === "update"} onChange={() => setMode("update")} /> <Tx>تحديث السجل الموجود</Tx>
            </label>
          </div>
        </section>
      ) : null}

      {body.length ? (
        <section className="bos-form-section">
          <h2><Tx>3. معاينة (أول 5 صفوف)</Tx></h2>
          <div className="bos-table-scroll">
            <BosTable className="bos-table">
              <thead>
                <tr>{header.map((h, i) => <th key={i}>{mapping[i] ? fields.find((f) => f.key === mapping[i])?.label : <span className="bos-faint">{h}</span>}</th>)}</tr>
              </thead>
              <tbody>
                {body.slice(0, 5).map((r, i) => (
                  <tr key={i}>{header.map((_, j) => <td key={j} className={mapping[j] ? undefined : "bos-faint"}><Tx>{r[j]}</Tx></td>)}</tr>
                ))}
              </tbody>
            </BosTable>
          </div>
          <div className="bos-form-actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="admin-btn"
              disabled={pending || !mappedName}
              aria-busy={pending}
              onClick={() =>
                startTransition(async () => {
                  const payload = body.map((r) => Object.fromEntries(mapping.map((key, i) => [key, r[i]?.trim() ?? ""]).filter(([key]) => key)));
                  const res = await importLeadsAction(payload, mode);
                  setResult(res.ok ? { ok: true, text: res.message ?? "تم الاستيراد", errors: res.data?.errors } : { ok: false, text: res.error });
                })
              }
            >
              {pending ? "جارٍ الاستيراد..." : `استيراد ${body.length} صف`}
            </button>
            {!mappedName ? <span className="bos-field-error"><Tx>اربط عمود الاسم أو الشركة على الأقل</Tx></span> : null}
          </div>
        </section>
      ) : null}

      {result ? (
        <div className={result.ok ? "bos-form-success" : "bos-form-error"} role="status">
          {result.text}
          {result.errors?.length ? (
            <ul style={{ marginTop: 8, paddingInlineStart: 18, fontSize: 12 }}>
              {result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          {result.ok ? (
            <div style={{ marginTop: 8 }}>
              <Link href="/admin/sales/leads" className="admin-btn small secondary">
                <Tx>عرض العملاء المحتملين</Tx>
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
