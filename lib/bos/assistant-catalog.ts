// Business AI assistant tool catalogue (docs/bos/30 §25). Every tool is a
// fixed, read-only query over BOS data run with the asking user's
// permissions — the model can only pick tools and a search text, never SQL.

export type ToolName = "today_problems" | "overdue_tasks" | "outstanding_invoices" | "projects_at_risk" | "deals_followup" | "sales_performance" | "ticket_reasons" | "content_performance" | "ads_spend" | "search_records" | "knowledge";

export interface ToolDef { name: ToolName; perm: string | null; description: string; keywords: string[] }

export const tools: ToolDef[] = [
  { name: "today_problems", perm: null, description: "Top problems today: overdue tasks, overdue invoices, projects at risk, deals needing follow-up, SLA-breached tickets (counts).", keywords: ["مشاكل", "مشكلة", "اليوم", "problems", "issues today", "ملخص", "summary", "وضع"] },
  { name: "overdue_tasks", perm: "tasks.read", description: "Overdue tasks (title, due date, assignee, project).", keywords: ["مهام متأخرة", "متأخرة", "مهام", "overdue task", "tasks"] },
  { name: "outstanding_invoices", perm: "invoices.read", description: "Unpaid / overdue invoices (number, client, balance, due date) with totals per currency.", keywords: ["فواتير", "فاتورة", "مستحقة", "invoice", "unpaid", "تحصيل"] },
  { name: "projects_at_risk", perm: "projects.read", description: "Active projects that are at risk or delayed (health, progress, deadline).", keywords: ["مشاريع", "مشروع", "خطر", "متأخر", "project", "risk", "delayed"] },
  { name: "deals_followup", perm: "deals.read", description: "Deals needing follow-up or manager attention from the Deal Radar (estimate, signals).", keywords: ["صفقات", "صفقة", "متابعة", "deal", "follow"] },
  { name: "sales_performance", perm: "deals.read", description: "Won deals last 30 days vs the previous 30 days, per currency.", keywords: ["مبيعات", "أداء المبيعات", "sales", "won", "revenue"] },
  { name: "ticket_reasons", perm: "tickets.read", description: "Top ticket categories in the last 30 days and open tickets.", keywords: ["تذاكر", "تذكرة", "أسباب", "ticket", "support"] },
  { name: "content_performance", perm: "social.read", description: "Best and worst published posts in the last 30 days (engagement, source).", keywords: ["محتوى", "منشورات", "سوشيال", "content", "posts", "social"] },
  { name: "ads_spend", perm: "ads.read", description: "Campaigns whose spend rose or fell most, last 7 days vs previous 7, per currency.", keywords: ["إعلانات", "حملات", "إنفاق", "ads", "campaign", "spend"] },
  { name: "search_records", perm: null, description: "Find records by name/number across permitted modules (needs a query).", keywords: ["ابحث", "بحث", "find", "search", "من هو", "أين"] },
  { name: "knowledge", perm: "knowledge.read", description: "Answer 'how do I…' questions from permitted knowledge-base articles (policies, SOPs, guides).", keywords: ["كيف", "خطوات", "سياسة", "إجراء", "how", "steps", "policy", "sop"] },
];

export const toolMap = new Map(tools.map((t) => [t.name, t]));

// No-AI fallback: pick tools by keywords (at most 3); default to the daily summary.
export function routeByKeywords(question: string, allowed: ToolName[]): ToolName[] {
  const q = question.toLowerCase();
  const scored = tools.filter((t) => allowed.includes(t.name) && t.name !== "search_records").map((t) => ({ t: t.name, s: t.keywords.filter((k) => q.includes(k.toLowerCase())).length })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const picked = scored.slice(0, 3).map((x) => x.t);
  return picked.length ? picked : allowed.includes("today_problems") ? ["today_problems"] : [];
}

export function detectLang(text: string): "ar" | "en" {
  return (text.match(/[؀-ۿ]/g) ?? []).length >= (text.match(/[A-Za-z]/g) ?? []).length ? "ar" : "en";
}
