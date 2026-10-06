import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@taysonsta.local", password: "Taysonsta!2026" }) });
if (!res.ok) { console.log("login failed", res.status); process.exit(1); }
const sess = await res.json();
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const value = "base64-" + Buffer.from(JSON.stringify(sess)).toString("base64url");
const cookies = []; for (let i = 0; i * 3180 < value.length; i++) cookies.push({ name: `sb-${ref}-auth-token.${i}`, value: value.slice(i * 3180, (i + 1) * 3180), url: "http://admin.localhost:3200" });
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies(cookies.length === 1 ? [{ ...cookies[0], name: `sb-${ref}-auth-token` }] : cookies);
const page = await ctx.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
for (const tab of process.argv.slice(3)) {
  const r = await page.goto(`http://admin.localhost:3200/admin/platform/agent?tab=${tab}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${process.argv[2]}/agent-${tab}.png`, fullPage: false });
  console.log(r.status(), tab, page.url().replace("http://admin.localhost:3200", ""));
}
if (errs.length) console.log("ERR", [...new Set(errs)].slice(0, 5));
await browser.close();
