import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySeniority, scoreMatch } from "../../lib/discovery/match.ts";
import { criteriaLine, parseIcp, sizeLabel, type IcpCriteria } from "../../lib/discovery/icp.ts";
import type { CompanyCandidate, PersonCandidate } from "../../lib/discovery/types.ts";

const icp: IcpCriteria = {
  campaign_name: "UAE Fintech — Founders",
  summary: "Fintech companies in the UAE with 50–200 employees",
  target_count: 100,
  target_unit: "companies",
  countries: ["AE"],
  cities: [],
  industries: ["Fintech"],
  keywords: ["payments"],
  employees_min: 50,
  employees_max: 200,
  job_titles: ["CEO", "Founder"],
  seniorities: ["founder", "c_level"],
  hiring: null,
  hiring_roles: [],
  funding_stages: [],
  technologies: [],
  exclusions: [],
  assumptions: [],
};

const company = (over: Partial<CompanyCandidate> = {}): CompanyCandidate => ({
  name: "PayFlow", domain: "payflow.ae", industry: "Fintech", description: "Payments infrastructure", city: "Dubai", country: "AE",
  employeeCount: 120, fundingStage: null, fundingTotalUsd: null, hiringRoles: null, signals: [], sourceRef: null, ...over,
});

const person = (title: string): PersonCandidate => ({
  fullName: "Test Person", title, email: null, phone: null, whatsapp: null, linkedinUrl: null, city: null, country: null, sourceRef: null,
});

test("classifySeniority recognises common titles", () => {
  assert.equal(classifySeniority("CEO & Founder"), "founder");
  assert.equal(classifySeniority("Chief Revenue Officer"), "c_level");
  assert.equal(classifySeniority("VP of Engineering"), "vp");
  assert.equal(classifySeniority("Managing Director"), "director");
  assert.equal(classifySeniority("Head of Procurement"), "head");
  assert.equal(classifySeniority("Sales Manager"), "manager");
  assert.equal(classifySeniority(null), "other");
});

test("a company and person matching every criterion scores 100", () => {
  const r = scoreMatch(icp, company(), person("CEO"));
  assert.equal(r.score, 100);
  assert.deepEqual(r.reasons, ["Market", "Industry", "Company size", "Decision maker"]);
});

test("wrong market and size lower the score", () => {
  const r = scoreMatch(icp, company({ country: "EG", employeeCount: 900 }), person("CEO"));
  assert.ok(r.score < 60, `expected < 60, got ${r.score}`);
  assert.ok(!r.reasons.includes("Market"));
  assert.ok(!r.reasons.includes("Company size"));
});

test("unspecified criteria don't penalise candidates", () => {
  const open = { ...icp, countries: [], employees_min: null, employees_max: null };
  assert.equal(scoreMatch(open, company({ country: "EG", employeeCount: 5 }), person("Founder")).score, 100);
});

test("ICP helpers format criteria like the design", () => {
  assert.equal(sizeLabel(icp), "50–200 employees");
  assert.equal(sizeLabel({ employees_min: 50, employees_max: null }), "50+ employees");
  assert.equal(criteriaLine(icp), "Fintech · 50–200 employees · UAE");
  assert.equal(parseIcp({ nope: true }), null);
  assert.deepEqual(parseIcp(icp), icp);
});
