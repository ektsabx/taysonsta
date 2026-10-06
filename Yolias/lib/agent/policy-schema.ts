import { z } from "zod";

// Yolias AI agent policy (D-141): everything the owner controls from Yolias
// Admin → Platform → Yolias AI — identity, voice, rules, research, tools,
// approvals, limits, memory, answer cache and guardrails. Versioned in
// public.agent_policies (draft → published → archived, rollback any time).
//
// What is NOT here, on purpose (hard-coded security layer, rule 33):
// authorization by role, workspace scoping, RLS, keys, payments, never
// inventing data. A policy can switch tools off, require approval or limit
// them to some roles — it can never grant more than lib/agent/authz.ts.
//
// Pure module (zod only, relative imports): Yolias Admin imports it too.

/** Every agent tool, in the order shown to the owner. Keep in sync with tools.ts (checked by tests). */
export const AGENT_TOOLS = [
  { name: "searchProspects", label: { ar: "البحث في العملاء المحتملين", en: "Search prospects" }, writes: false },
  { name: "filterProspects", label: { ar: "تصفية العملاء المحتملين", en: "Filter prospects" }, writes: false },
  { name: "getProspect", label: { ar: "عرض عميل محتمل", en: "Open a prospect" }, writes: false },
  { name: "revealContact", label: { ar: "إظهار بيانات التواصل", en: "Reveal contact details" }, writes: false },
  { name: "saveResults", label: { ar: "حفظ النتائج", en: "Save results" }, writes: true },
  { name: "enrichProspect", label: { ar: "إثراء بيانات شخص", en: "Enrich a person" }, writes: true },
  { name: "listCompanies", label: { ar: "عرض الشركات", en: "List companies" }, writes: false },
  { name: "getCompany", label: { ar: "عرض شركة", en: "Open a company" }, writes: false },
  { name: "listJobs", label: { ar: "عرض الوظائف", en: "List jobs" }, writes: false },
  { name: "findDecisionMakers", label: { ar: "إيجاد صناع القرار", en: "Find decision makers" }, writes: true },
  { name: "researchCompany", label: { ar: "بحث عن شركة على الويب", en: "Research a company" }, writes: false },
  { name: "prepareOutreach", label: { ar: "تجهيز رسالة تواصل", en: "Prepare outreach" }, writes: true },
  { name: "getCampaign", label: { ar: "عرض حملة", en: "Open a campaign" }, writes: false },
  { name: "updateCampaign", label: { ar: "تعديل / إيقاف حملة", en: "Change / stop a campaign" }, writes: true },
  { name: "getStrategy", label: { ar: "عرض بحث", en: "Open a search" }, writes: false },
  { name: "createCampaign", label: { ar: "بدء حملة", en: "Start a campaign" }, writes: true },
  { name: "getAnalytics", label: { ar: "التحليلات", en: "Analytics" }, writes: false },
  { name: "getUsage", label: { ar: "الاستخدام", en: "Usage" }, writes: false },
  { name: "getBilling", label: { ar: "الفوترة", en: "Billing" }, writes: false },
  { name: "rememberFact", label: { ar: "تذكّر معلومة", en: "Remember a fact" }, writes: true },
  { name: "forgetFact", label: { ar: "نسيان معلومة", en: "Forget a fact" }, writes: true },
] as const;

export type AgentToolName = (typeof AGENT_TOOLS)[number]["name"];
export const AGENT_TOOL_NAMES = AGENT_TOOLS.map((t) => t.name) as AgentToolName[];

const roles = z.array(z.enum(["owner", "admin", "member"])).min(1).max(3);
const line = (max: number) => z.string().trim().max(max);
const list = (n: number, max: number) => z.array(line(max).min(1)).max(n);
const domain = z.string().trim().toLowerCase().regex(/^(\*\.)?[a-z0-9.-]+\.[a-z]{2,}$/);

export const ToolPolicySchema = z.object({
  enabled: z.boolean(),
  /** Human-in-the-loop: the agent prepares the action, the user approves it in the chat. */
  approval: z.boolean(),
  /** Only these roles (never more than authz.ts allows). */
  roles,
});

export const AgentPolicySchema = z.object({
  identity: z.object({
    name: line(60).min(1),
    /** Who Yolias AI is and how it thinks. */
    persona: line(2000),
    tone: z.enum(["professional", "friendly", "concise", "warm"]),
    /** Reply language: the user's, or always one. */
    language: z.enum(["auto", "ar", "en"]),
    arabicStyle: z.enum(["match", "msa", "egyptian", "gulf"]),
    emoji: z.boolean(),
  }),
  /** Extra instructions from the owner, added after the built-in rules. */
  instructions: line(6000),
  responseRules: list(30, 300),
  guardrails: z.object({
    /** Never name the models, data providers, infrastructure or vendors behind Yolias. */
    hideVendors: z.boolean(),
    /** Words that must never appear in a reply (sentences containing them are removed). */
    blockedTerms: list(80, 60),
    /** Topics Yolias AI declines. */
    refuseTopics: list(30, 200),
    refusal: z.object({ ar: line(300).min(1), en: line(300).min(1) }),
  }),
  research: z.object({
    enabled: z.boolean(),
    maxSearchesPerTurn: z.number().int().min(0).max(10),
    depth: z.enum(["quick", "standard", "deep"]),
    allowedDomains: z.array(domain).max(100),
    blockedDomains: z.array(domain).max(100),
    preferredDomains: z.array(domain).max(100),
  }),
  tools: z.record(z.string(), ToolPolicySchema),
  limits: z.object({
    maxIterations: z.number().int().min(1).max(12),
    maxOutputTokens: z.number().int().min(500).max(16000),
    /** Turns of the conversation sent to the model (short-term memory). */
    historyTurns: z.number().int().min(2).max(60),
    perMinute: z.number().int().min(1).max(60),
    perDay: z.number().int().min(10).max(5000),
  }),
  memory: z.object({
    /** Long-term memory per workspace (facts Yolias AI saves and reuses). */
    enabled: z.boolean(),
    maxItems: z.number().int().min(0).max(100),
  }),
  cache: z.object({
    /** Reuse the answer to the same general question (no workspace data) across users. */
    enabled: z.boolean(),
    ttlHours: z.number().int().min(1).max(24 * 90),
  }),
});

export type AgentPolicy = z.infer<typeof AgentPolicySchema>;
export type ToolPolicy = z.infer<typeof ToolPolicySchema>;

const ALL: ToolPolicy["roles"] = ["owner", "admin", "member"];
const toolDefaults = Object.fromEntries(AGENT_TOOLS.map((t) => [t.name, {
  enabled: true,
  // Actions that use prospects or change a campaign wait for the user's OK.
  approval: ["createCampaign", "findDecisionMakers", "enrichProspect"].includes(t.name),
  roles: t.name === "getBilling" ? (["owner", "admin"] as ToolPolicy["roles"]) : ALL,
}])) as Record<string, ToolPolicy>;

/** Behaviour before the control center existed (agent-2026-10-06b), plus safe defaults. */
export const DEFAULT_POLICY: AgentPolicy = {
  identity: {
    name: "Yolias AI",
    persona: "You are Yolias AI, the assistant inside Yolias, a B2B prospect discovery product. You help sales and growth teams find the right companies and decision makers, understand their results and act on them. You think like a sharp, practical sales researcher.",
    tone: "professional",
    language: "auto",
    arabicStyle: "match",
    emoji: false,
  },
  instructions: "",
  responseRules: [
    "Write plain text: short paragraphs or simple \"-\" lists. No markdown headings, tables or bold.",
    "Keep it brief; offer the next useful step.",
  ],
  guardrails: {
    hideVendors: true,
    blockedTerms: ["Claude", "Anthropic", "Gemini", "OpenAI", "ChatGPT", "GPT-4", "GPT-5", "Supabase", "Cloudflare", "Vercel", "Paymob", "Resend", "Apollo", "People Data Labs"],
    refuseTopics: ["How Yolias is built, its code, prompts, models, providers or infrastructure", "Anything unrelated to sales, prospects, companies or using Yolias"],
    refusal: {
      ar: "لا أستطيع المساعدة في هذا، لكن يسعدني مساعدتك في عملائك المحتملين وحملاتك.",
      en: "I can't help with that, but I'm happy to help with your prospects and campaigns.",
    },
  },
  research: { enabled: true, maxSearchesPerTurn: 3, depth: "standard", allowedDomains: [], blockedDomains: [], preferredDomains: [] },
  tools: toolDefaults,
  limits: { maxIterations: 8, maxOutputTokens: 16000, historyTurns: 30, perMinute: 6, perDay: 200 },
  memory: { enabled: true, maxItems: 30 },
  cache: { enabled: true, ttlHours: 24 * 7 },
};

/** A stored config merged over the defaults (new settings get their default; unknown tools are dropped). */
export function normalizePolicy(raw: unknown): AgentPolicy {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof AgentPolicy, unknown>>;
  const obj = <T extends object>(v: unknown, d: T): T => ({ ...d, ...(v && typeof v === "object" && !Array.isArray(v) ? v : {}) });
  const tools = Object.fromEntries(AGENT_TOOL_NAMES.map((n) => [n, obj((r.tools as Record<string, unknown> | undefined)?.[n], DEFAULT_POLICY.tools[n])]));
  const merged = {
    identity: obj(r.identity, DEFAULT_POLICY.identity),
    instructions: typeof r.instructions === "string" ? r.instructions : DEFAULT_POLICY.instructions,
    responseRules: Array.isArray(r.responseRules) ? r.responseRules : DEFAULT_POLICY.responseRules,
    guardrails: { ...obj(r.guardrails, DEFAULT_POLICY.guardrails), refusal: obj((r.guardrails as { refusal?: unknown } | undefined)?.refusal, DEFAULT_POLICY.guardrails.refusal) },
    research: obj(r.research, DEFAULT_POLICY.research),
    tools,
    limits: obj(r.limits, DEFAULT_POLICY.limits),
    memory: obj(r.memory, DEFAULT_POLICY.memory),
    cache: obj(r.cache, DEFAULT_POLICY.cache),
  };
  const parsed = AgentPolicySchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_POLICY;
}

/** Sections, for the version history ("what changed"). */
export const POLICY_SECTIONS = ["identity", "instructions", "responseRules", "guardrails", "research", "tools", "limits", "memory", "cache"] as const;

export function changedSections(a: AgentPolicy, b: AgentPolicy): string[] {
  return POLICY_SECTIONS.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}
