import { test } from "node:test";
import assert from "node:assert/strict";
import { AGENT_TOOL_NAMES, DEFAULT_POLICY, changedSections, normalizePolicy } from "../../lib/agent/policy-schema.ts";
import { allowedTools, applyGuardrails, buildSystemPrompt, isGeneralQuestion, normalizeQuestion } from "../../lib/agent/policy.ts";

test("policy: stored config merges over the defaults; invalid values fall back", () => {
  assert.deepEqual(normalizePolicy({}), DEFAULT_POLICY);
  const p = normalizePolicy({ identity: { name: "Yoli" }, limits: { perDay: 50 } });
  assert.equal(p.identity.name, "Yoli");
  assert.equal(p.identity.tone, DEFAULT_POLICY.identity.tone);
  assert.equal(p.limits.perDay, 50);
  assert.deepEqual(normalizePolicy({ limits: { perDay: -3 } }), DEFAULT_POLICY, "an invalid value never reaches the runtime");
  assert.deepEqual(changedSections(DEFAULT_POLICY, p), ["identity", "limits"]);
  assert.equal(Object.keys(p.tools).length, AGENT_TOOL_NAMES.length);
});

test("policy: tools follow enabled + roles; memory / research switches remove their tools", () => {
  const p = normalizePolicy({ tools: { createCampaign: { enabled: false, approval: true, roles: ["owner"] }, getUsage: { enabled: true, approval: false, roles: ["owner"] } }, memory: { enabled: false, maxItems: 0 } });
  const member = allowedTools(p, "member");
  assert.ok(!member.has("createCampaign") && !member.has("getUsage") && !member.has("rememberFact"));
  assert.ok(allowedTools(p, "owner").has("getUsage"));
  assert.ok(!allowedTools(DEFAULT_POLICY, "member").has("getBilling"), "billing stays owner/admin");
});

test("system prompt: identity, voice, hard rules, vendor confidentiality, owner instructions last", () => {
  const p = normalizePolicy({ identity: { name: "Yoli", arabicStyle: "egyptian" }, instructions: "Always suggest a next step." });
  const s = buildSystemPrompt(p);
  assert.match(s, /^You are Yoli\./);
  assert.match(s, /Egyptian Arabic/);
  assert.match(s, /Never invent prospects/);
  assert.match(s, /never name or hint at the AI models/);
  assert.ok(s.indexOf("Always suggest a next step.") > s.indexOf("Rules (these always apply"));
});

test("guardrail: sentences naming a blocked vendor are removed; nothing left → refusal", () => {
  const r = applyGuardrails("I can help with prospects. I run on Claude by Anthropic. Ask me anything!", DEFAULT_POLICY, "en");
  assert.equal(r.text, "I can help with prospects. Ask me anything!");
  assert.equal(r.hits, 1);
  assert.equal(applyGuardrails("أنا مبني على Gemini.", DEFAULT_POLICY, "ar").text, DEFAULT_POLICY.guardrails.refusal.ar);
  assert.equal(applyGuardrails("Claudette is a name.", DEFAULT_POLICY, "en").hits, 0, "whole words only");
});

test("answer cache: same question in any spelling; personal / contextual questions never shared", () => {
  assert.equal(normalizeQuestion("ما هي  أفضل طريقة؟!"), normalizeQuestion("ما هى افضل طريقه"));
  assert.ok(isGeneralQuestion("What is a good cold email length?"));
  assert.ok(isGeneralQuestion("ايه افضل طريقة اكتب بيها ايميل بيع"));
  assert.ok(!isGeneralQuestion("How many prospects do I have?"));
  assert.ok(!isGeneralQuestion("explain these results"));
  assert.ok(!isGeneralQuestion("حملتي وصلت لفين"));
});
