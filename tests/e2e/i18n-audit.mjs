// English coverage audit (docs/bos/30 §4, doc 31 Phase 2): renders pages as a
// user whose interface language is English and lists the Arabic text still
// visible (interface text, not user data such as names). Usage:
//   node tests/e2e/i18n-audit.mjs [email] [baseUrl]   (SMOKE_PAGES=... to limit)
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!/127\.0\.0\.1|localhost/.test(SUPABASE_URL)) process.exit(1);
const email = process.argv[2] ?? "admin@taysonsta.local";
const base = process.argv[3] ?? "http://localhost:3100";

const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Taysonsta!2026" }) });
const sess = await res.json();
const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
const value = "base64-" + Buffer.from(JSON.stringify(sess)).toString("base64url");
const CHUNK = 3180;
const name = `sb-${ref}-auth-token`;
const cookie = value.length <= CHUNK ? `${name}=${value}` : Array.from({ length: Math.ceil(value.length / CHUNK) }, (_, i) => `${name}.${i}=${value.slice(i * CHUNK, (i + 1) * CHUNK)}`).join("; ");

const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "54422", "-U", "postgres", "-d", "postgres", "-Atc", sql], { env: { ...process.env, PGPASSWORD: "postgres" } }).toString().trim();
const uid = sess.user.id;
const before = psql(`select coalesce(language,'') from user_preferences where user_id='${uid}'`);
psql(`insert into user_preferences (user_id, language) values ('${uid}','en') on conflict (user_id) do update set language='en'`);

const pages = (process.env.SMOKE_PAGES ?? "/admin/dashboard").split(",").filter(Boolean);
const ar = /[\u0600-\u06FF][\u0600-\u06FF \d.,:؟،()\-–—/+%«»"“”]*/g;
const totals = new Map();
try {
  for (const p of pages) {
    const html = await (await fetch(base + p, { headers: { cookie }, redirect: "manual" })).text();
    const body = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ");
    const text = body.replace(/<[^>]+>/g, "\n");
    const found = [...new Set((text.match(ar) ?? []).map((s) => s.trim()).filter((s) => s.length > 1))];
    console.log(`${found.length.toString().padStart(3)}  ${p}`);
    for (const s of found) totals.set(s, (totals.get(s) ?? 0) + 1);
  }
} finally {
  psql(before ? `update user_preferences set language='${before}' where user_id='${uid}'` : `update user_preferences set language=null where user_id='${uid}'`);
}
if (process.env.I18N_LIST) for (const [s, n] of [...totals].sort((a, b) => b[1] - a[1])) console.log(`${n}\t${s}`);
