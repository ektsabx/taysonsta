import { test } from "node:test";
import assert from "node:assert/strict";
import { guessKind, guessMapping, normalizeSite, parseCsv, toImportRow } from "../../lib/csv-import.ts";
import { commissionExamples, parseProgramSettings } from "../../lib/affiliates/program.ts";
import { campaignFilterOf } from "../../lib/discovery/campaign-view.ts";
import { defaultPlans, hasActivePlan, monthlyRate, offeredPlans, priceFor, topPlan } from "../../lib/plans.ts";

// Owner brief 2026-10-12: plans, trial, CSV import, affiliate examples, campaign filters.

test("plans: no $0 plan offered, Scale is the top plan, trialing counts as a plan", () => {
  assert.deepEqual(offeredPlans, ["pro", "growth", "scale"]);
  assert.equal(topPlan, "scale");
  assert.deepEqual(defaultPlans.scale, { priceUsd: 200, prospects: 4000, emails: 4000, contacts: 4000 });
  assert.equal(defaultPlans.growth.emails, 2000);
  assert.equal(hasActivePlan({ subscription_status: "trialing" }), true);
  assert.equal(hasActivePlan({ subscription_status: "canceled" }), false, "an ended plan or trial gives no access");
  assert.equal(hasActivePlan({ subscription_status: "none" }), false);
});

test("plans: annual is 20% off, shown per month and charged once a year", () => {
  assert.equal(monthlyRate(100, "annual"), 80);
  assert.equal(priceFor(100, "annual"), 960);
  assert.equal(monthlyRate(100, "monthly"), 100);
  assert.equal(priceFor(100, "monthly"), 100);
  assert.equal(priceFor(50, "annual"), 480);
  assert.equal(priceFor(200, "annual"), 1920);
  assert.equal(priceFor(24.99, "annual"), 239.88, "rounded to cents per month first");
});

test("csv: quotes, escaped quotes, CRLF, BOM, semicolons and blank lines", () => {
  assert.deepEqual(parseCsv('﻿name,title\r\n"Doe, Jane","Head ""Sales"""\r\n\r\nBob,CEO'), [["name", "title"], ["Doe, Jane", 'Head "Sales"'], ["Bob", "CEO"]]);
  assert.deepEqual(parseCsv("a;b\n1;2\n"), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCsv('x\n"multi\nline"'), [["x"], ["multi\nline"]]);
});

test("csv: header mapping and kind are guessed, Arabic headers too", () => {
  const m = guessMapping(["Full Name", "Job Title", "Company", "Website", "E-mail", "Country"]);
  assert.equal(m.name, 0); assert.equal(m.title, 1); assert.equal(m.company, 2); assert.equal(m.domain, 3); assert.equal(m.email, 4); assert.equal(m.country, 5);
  assert.equal(m.phone, -1);
  assert.equal(guessKind(m), "person");
  assert.equal(guessKind(guessMapping(["Business name", "Website", "City"])), "company");
  assert.equal(guessMapping(["الاسم", "البريد الإلكتروني"]).email, 1);
});

test("csv: rows are validated, never guessed", () => {
  const m = guessMapping(["Name", "Title", "Company", "Website", "Email", "Phone", "LinkedIn", "Country", "Employees"]);
  const ok = toImportRow(["  Sara  Ahmed ", "Head of Sales", "Nile", "www.Nile.example/about", "SARA@NILE.EXAMPLE", "+20 100 123 4567", "https://www.linkedin.com/in/sara", "eg", "1,200"], m, "person")!;
  assert.equal(ok.name, "Sara Ahmed");
  assert.equal(ok.domain, "nile.example");
  assert.equal(ok.website, "https://www.nile.example/about");
  assert.equal(ok.email, "sara@nile.example");
  assert.equal(ok.country, "EG");
  assert.equal(ok.employee_count, 1200);
  const bad = toImportRow(["X", "", "", "not a site", "nope", "call me", "http://linkedin.com/in/x", "Egypt", "-3"], m, "person")!;
  assert.equal(bad.email, undefined); assert.equal(bad.domain, undefined); assert.equal(bad.phone, undefined);
  assert.equal(bad.linkedin_url, undefined, "https LinkedIn only"); assert.equal(bad.country, undefined, "two-letter codes only"); assert.equal(bad.employee_count, undefined);
  assert.equal(toImportRow(["", "CEO"], m, "person"), null, "no name, no row");
  assert.equal(toImportRow(["Acme", "CEO", "Other Co"], m, "company")!.title, undefined, "companies carry no title or company");
  assert.deepEqual(normalizeSite("javascript:alert(1)"), {});
});

test("affiliates: worked examples follow the live rate, eligibility and rounding", () => {
  const s = parseProgramSettings({ enabled: true, commission: { type: "percent", percent_bps: 1500 }, eligible: { plans: ["pro", "growth", "scale"], periods: ["monthly", "annual"] }, recurring: { enabled: true, max_payments: 12 }, min_payment_cents: 100 });
  const ex = commissionExamples(s, { pro: 50, growth: 100, scale: 200 });
  const growthMonthly = ex.find((e) => e.plan === "growth" && e.period === "monthly")!;
  assert.equal(growthMonthly.perPaymentCents, 1500, "15% of $100");
  assert.equal(growthMonthly.maxCents, 18000, "12 payments");
  assert.equal(ex.find((e) => e.plan === "scale" && e.period === "annual")!.perPaymentCents, 28800, "15% of $1,920 (annual at 20% off)");
  const once = parseProgramSettings({ enabled: true, commission: { type: "percent", percent_bps: 1500 }, eligible: { plans: ["pro"], periods: ["monthly"] }, recurring: { enabled: false } });
  assert.deepEqual(commissionExamples(once, { pro: 50, growth: 100, scale: 200 }).map((e) => [e.plan, e.maxCents]), [["pro", 750]]);
});

test("campaigns: every status belongs to exactly one filter", () => {
  assert.equal(campaignFilterOf("discovering_companies"), "active");
  assert.equal(campaignFilterOf("scheduled"), "active");
  assert.equal(campaignFilterOf("awaiting_source"), "active");
  assert.equal(campaignFilterOf("paused"), "paused");
  assert.equal(campaignFilterOf("partial"), "completed");
  assert.equal(campaignFilterOf("completed"), "completed");
  assert.equal(campaignFilterOf("failed"), "error");
});
