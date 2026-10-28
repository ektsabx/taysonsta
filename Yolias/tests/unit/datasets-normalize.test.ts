import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalCity, cityNames, sameCity, companyKey, guessDatasetMapping, guessEntity, normalizeCountry, normalizePhoneFor, normalizeRow, usable } from "../../lib/datasets/normalize.ts";

// Data import (D-248): rows are cleaned the same way in Admin and in tests.

test("countries: ISO codes, English, Arabic and French names, alpha-3", () => {
  assert.equal(normalizeCountry("Egypt"), "EG");
  assert.equal(normalizeCountry("مصر"), "EG");
  assert.equal(normalizeCountry("المملكة العربية السعودية"), "SA");
  assert.equal(normalizeCountry("KSA"), "SA");
  assert.equal(normalizeCountry("الكويت"), "KW");
  assert.equal(normalizeCountry("الإمارات"), "AE");
  assert.equal(normalizeCountry("United Arab Emirates"), "AE");
  assert.equal(normalizeCountry("ae"), "AE");
  assert.equal(normalizeCountry("ARE"), "AE");
  assert.equal(normalizeCountry("Allemagne"), "DE");
  assert.equal(normalizeCountry("Atlantis"), null);
  assert.equal(normalizeCountry("", "EG"), "EG", "the dataset's country for empty cells");
});

test("phones: local numbers use the row's country, international stay, junk is dropped", () => {
  assert.equal(normalizePhoneFor("010 1234 5678", "EG"), "+201012345678");
  assert.equal(normalizePhoneFor("٠١٠١٢٣٤٥٦٧٨", "EG"), "+201012345678");
  assert.equal(normalizePhoneFor("0501234567", "SA"), "+966501234567");
  assert.equal(normalizePhoneFor("966501234567", "SA"), "+966501234567");
  assert.equal(normalizePhoneFor("+971 4 123 4567", null), "+97141234567");
  assert.equal(normalizePhoneFor("0044 20 7946 0958", "GB"), "+442079460958");
  assert.equal(normalizePhoneFor("12345678", null), null, "no country, no +: can't be read");
  assert.equal(normalizePhoneFor("call us", "EG"), null);
  assert.equal(normalizePhoneFor("0100 123 4567 / 0122 333 4444", "EG"), "+201001234567", "the first of several numbers");
});

test("company names compare without legal suffixes and Arabic letter variants", () => {
  assert.equal(companyKey("Nile Tech LLC"), companyKey("nile tech"));
  assert.equal(companyKey("شركة النيل للتجارة"), companyKey("النيل"));
  assert.equal(companyKey("مؤسسة أحمد"), companyKey("احمد"));
  assert.notEqual(companyKey("Nile Tech"), companyKey("Nile Foods"));
});

test("mapping: English and Arabic headers, entity guessed", () => {
  const m = guessDatasetMapping(["Company Name", "Website", "E-mail", "Phone Number", "Country", "City", "Industry", "Employees"]);
  assert.deepEqual([m.company_name, m.website, m.email, m.phone, m.country, m.city, m.industry, m.employee_count], [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(guessEntity(m), "company");
  const a = guessDatasetMapping(["اسم المنشأة", "رقم الجوال", "البريد الإلكتروني", "المدينة", "السجل التجاري"]);
  assert.deepEqual([a.company_name, a.phone, a.email, a.city, a.registry_id], [0, 1, 2, 3, 4]);
  const p = guessDatasetMapping(["First Name", "Last Name", "Job Title", "Company", "LinkedIn URL", "Email"]);
  assert.equal(guessEntity(p), "person");
  assert.deepEqual([p.first_name, p.last_name, p.title, p.company_name, p.linkedin_url, p.email], [0, 1, 2, 3, 4, 5]);
});

test("rows: values are cleaned, bad ones dropped and reported, nothing invented", () => {
  const m = { company_name: 0, website: 1, email: 2, phone: 3, country: 4, employee_count: 5 };
  const r = normalizeRow(["  Nile  Tech ", "www.NileTech.com.eg/about", "INFO@niletech.com.eg", "02 2345 6789", "مصر", "51-200"], m, "company");
  assert.equal(r.company.name, "Nile Tech");
  assert.equal(r.company.domain, "niletech.com.eg");
  assert.equal(r.company.email, "info@niletech.com.eg");
  assert.equal(r.company.phone, "+20223456789");
  assert.equal(r.company.country, "EG");
  assert.equal(r.company.employee_count, 200);
  assert.deepEqual(r.problems, []);
  assert.ok(usable(r));
  const bad = normalizeRow(["", "not a site", "nope", "n/a", "Atlantis", "many"], m, "company");
  assert.equal(bad.company.domain, null); assert.equal(bad.company.email, null); assert.equal(bad.company.phone, null); assert.equal(bad.company.country, null);
  assert.deepEqual(bad.problems.sort(), ["country", "email", "employee_count", "missing_name", "website"]);
  assert.equal(usable(bad), false);
  // A business email identifies the company when there's no website; a free one doesn't.
  assert.equal(normalizeRow(["X", "", "sara@acme.sa", "", "SA", ""], m, "company").company.domain, "acme.sa");
  assert.equal(normalizeRow(["X", "", "sara@gmail.com", "", "SA", ""], m, "company").company.domain, null);
});

test("person rows need a name and a company", () => {
  const m = { first_name: 0, last_name: 1, title: 2, company_name: 3, email: 4, linkedin_url: 5 };
  const r = normalizeRow(["Sara", "Ali", "Head of Sales", "Acme", "sara@acme.com", "https://www.linkedin.com/in/sara-ali/"], m, "person", { country: "AE" });
  assert.equal(r.person?.full_name, "Sara Ali");
  assert.equal(r.person?.linkedin, "https://www.linkedin.com/in/sara-ali");
  assert.equal(r.company.domain, "acme.com");
  assert.equal(r.company.email, null, "a person's email isn't the company's");
  assert.equal(r.company.country, "AE");
  assert.ok(usable(r));
  assert.equal(usable(normalizeRow(["Sara", "", "", "", "", ""], m, "person")), false, "no company");
});

test("cities: Arabic and English names meet on one name; unknown cities stay as written", () => {
  assert.equal(canonicalCity("القاهرة"), "Cairo");
  assert.equal(canonicalCity("CAIRO"), "Cairo");
  assert.equal(canonicalCity("محافظة الجيزة"), "Giza");
  assert.equal(canonicalCity("الرياض"), "Riyadh");
  assert.equal(canonicalCity("Jeddah"), "Jeddah");
  assert.equal(canonicalCity("جدة"), "Jeddah");
  assert.equal(canonicalCity("أبو ظبي"), "Abu Dhabi");
  assert.equal(canonicalCity("مدينة الكويت"), "Kuwait City");
  assert.equal(canonicalCity("Mit Ghamr"), "Mit Ghamr");
  assert.equal(canonicalCity(""), null);
});

test("cities: Arabic and English names of one city match (owner, 2026-10-28)", () => {
  assert.ok(sameCity("Cairo", "القاهرة"));
  assert.ok(sameCity("الرياض", "Riyadh"));
  assert.ok(sameCity("Jeddah", "جدة"));
  assert.ok(!sameCity("Cairo", "Riyadh"));
  assert.ok(cityNames("القاهرة").includes("Cairo"));
  assert.ok(cityNames("Cairo").includes("القاهره"));
  assert.deepEqual(cityNames("Smallville"), ["Smallville"]);
});
