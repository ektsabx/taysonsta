// End-to-end browser test of both apps against the local stack
// (`npm run local` must be running). A new user goes through the real
// journey: sign up → magic link → checkout (test mode) → onboarding → search →
// Yolias AI conversation → settings → prospects/campaigns/analytics → sign
// out; then Yolias Admin finds the user and the emails sent. Any page error
// fails the run. The user is deleted at the end.
//   npm run e2e            (first time: npx playwright install chromium)
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

import { chromium } from "playwright";

const env = Object.fromEntries(
  readFileSync(new URL("../Yolias/.env.local", import.meta.url), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const YOLIAS = "http://localhost:3200";
const ADMIN = "http://admin.localhost:3200";
const MAILPIT = "http://127.0.0.1:54634";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = `e2e+${Date.now()}@yolias.test`;
const useMailpit = !env.RESEND_API_KEY; // with a real Resend key, sign-in mail goes out for real: create the user directly instead
const step = (s) => console.log(`✓ ${s}`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--host-resolver-rules=MAP admin.localhost 127.0.0.1"] });
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.setDefaultTimeout(120_000);
page.setDefaultNavigationTimeout(180_000);
page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));

async function magicLink() {
  if (useMailpit) {
    for (let i = 0; i < 30; i++) {
      const list = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then((r) => r.json()).catch(() => null);
      const id = list?.messages?.[0]?.ID;
      if (id) {
        const msg = await fetch(`${MAILPIT}/api/v1/message/${id}`).then((r) => r.json());
        const href = (msg.HTML ?? msg.Text).match(/https?:\/\/[^"'\s<]+\/auth\/confirm\?[^"'\s<]+/)?.[0];
        if (href) return href.replace(/&amp;/g, "&");
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("sign-in email not found in Mailpit");
  }
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  return `${YOLIAS}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`;
}

let userId = null;
try {
  await page.goto(`${YOLIAS}/`);
  assert.ok(await page.locator("a[href='/signup'], a[href^='/pricing']").count());
  step("public home");

  await page.goto(`${YOLIAS}/signup?plan=pro`);
  if (useMailpit) {
    await page.fill("#email", email);
    await page.click("button[type=submit]");
    await page.waitForSelector(".check-email");
    step("sign-up form sent the magic link");
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { plan_intent: "pro" } });
    if (error) throw error;
    userId = data.user.id;
    step("user created (real Resend key present, no email sent)");
  }
  await page.goto(await magicLink());
  await page.waitForURL(/\/checkout/);
  step("magic link signed in → checkout");

  await page.locator(".checkout-submit:not([disabled])").first().click();
  await page.waitForURL(/\/onboarding/);
  step("plan activated (test mode) → onboarding");

  await page.fill("#full_name", "E2E Tester");
  await page.fill("#company_name", "E2E Payroll");
  await page.fill("#website", "e2e-payroll.example");
  await page.fill("#offering", "Payroll software for growing companies in Egypt and the Gulf");
  await page.click("button[type=submit]");
  await page.waitForURL(`${YOLIAS}/`);
  step("onboarding finished → Yolias AI");

  await page.fill(".prompt-input", "عايز 50 مدير موارد بشرية في شركات سوفتوير في القاهرة");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/search\/[0-9a-f-]{36}/);
  await page.waitForSelector(".agent-artifact-card");
  step(`search created → ${(await page.locator(".artifact-status").first().innerText()).trim()}`);

  await page.fill(".agent-composer textarea", "What is the status of this search?");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".agent-thread .prompt-error, .agent-turn.assistant .agent-turn-text");
  const answered = await page.locator(".agent-turn.assistant .agent-turn-text").count();
  step(answered ? "Yolias AI answered" : `Yolias AI: ${(await page.locator(".agent-thread .prompt-error").first().innerText()).trim()}`);
  await page.reload();
  assert.ok(await page.locator(".agent-turn.user").count() >= 1, "conversation saved");
  step("conversation saved on the search");

  for (const path of ["/prospects", "/campaigns", "/analytics"]) {
    await page.goto(`${YOLIAS}${path}`);
    await page.waitForSelector(".page-view, main");
  }
  step("prospects, campaigns, analytics pages");

  await page.goto(`${YOLIAS}/`);
  await page.click(".sidebar-user");
  await page.click(".user-menu-popover.open .menu-item:nth-child(2)");
  await page.waitForSelector("text=Two-Factor Authentication");
  assert.ok(await page.locator(`input[value="${email}"]`).count(), "account email shown");
  step("settings → account");

  const { data: profile } = await admin.from("profiles").select("id").eq("email", email).single();
  userId = profile.id;
  await page.keyboard.press("Escape");

  // Yolias Admin sees the new user and the emails logged for them.
  const a = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  a.setDefaultTimeout(120_000);
  a.setDefaultNavigationTimeout(180_000);
  a.on("pageerror", (e) => errors.push(`${a.url()}: ${e.message}`));
  await a.goto(`${ADMIN}/admin/login`);
  await a.fill("input[type=email], input[name=email]", "admin@taysonsta.local");
  await a.fill("input[type=password]", "Taysonsta!2026");
  await Promise.all([a.waitForURL((u) => !u.pathname.includes("login")), a.click("button[type=submit]")]);
  await a.goto(`${ADMIN}/admin/platform/users?q=${encodeURIComponent(email)}`);
  await a.waitForSelector(`text=${email}`);
  step("Yolias Admin → user listed");
  await a.goto(`${ADMIN}/admin/platform/emails`);
  const { data: logged } = await admin.from("email_log").select("kind").eq("to_email", email);
  for (const kind of ["plan_welcome", "welcome"]) assert.ok(logged.some((l) => l.kind === kind), `${kind} email logged`);
  step(`emails logged: ${[...new Set(logged.map((l) => l.kind))].join(", ")}`);
  for (const path of ["/admin/platform", "/admin/platform/agent", "/admin/platform/costs", "/admin/platform/jobs"]) {
    await a.goto(`${ADMIN}${path}`);
    await a.waitForSelector("main");
  }
  step("admin platform pages");

  assert.deepEqual(errors, [], "no page errors");
  console.log("E2E PASS");
} catch (e) {
  await page.screenshot({ path: "e2e-failure.png", fullPage: true }).catch(() => {});
  console.error("E2E FAIL (screenshot: e2e-failure.png)", errors);
  throw e;
} finally {
  if (userId) {
    const { data: p } = await admin.from("profiles").select("workspace_id").eq("id", userId).maybeSingle();
    await admin.from("email_log").delete().eq("to_email", email);
    if (p?.workspace_id) await admin.from("workspaces").delete().eq("id", p.workspace_id);
    await admin.auth.admin.deleteUser(userId);
  }
  await browser.close();
}
