import { nowMs } from "@/lib/bos/clock";
// Pure condition evaluation + templating for the automation engine
// (docs/bos/20-automation.md). No I/O here so it can be unit-tested.

export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "contains"
  | "exists"
  | "not_exists"
  | "changed_to"
  | "older_than_days";

export const conditionOperators: { value: ConditionOperator; label: string; needsValue: boolean }[] = [
  { value: "eq", label: "يساوي", needsValue: true },
  { value: "neq", label: "لا يساوي", needsValue: true },
  { value: "gt", label: "أكبر من", needsValue: true },
  { value: "gte", label: "أكبر من أو يساوي", needsValue: true },
  { value: "lt", label: "أصغر من", needsValue: true },
  { value: "lte", label: "أصغر من أو يساوي", needsValue: true },
  { value: "in", label: "ضمن القائمة", needsValue: true },
  { value: "not_in", label: "ليس ضمن القائمة", needsValue: true },
  { value: "contains", label: "يحتوي على", needsValue: true },
  { value: "exists", label: "موجود", needsValue: false },
  { value: "not_exists", label: "غير موجود", needsValue: false },
  { value: "changed_to", label: "تغيّر إلى", needsValue: true },
  { value: "older_than_days", label: "أقدم من (أيام)", needsValue: true },
];

export interface Condition {
  field: string;
  op: ConditionOperator;
  value?: unknown;
}

export interface EvaluationContext {
  payload: Record<string, unknown>;
  entity?: Record<string, unknown> | null;
  summary?: string;
  now?: Date;
}

function lookup(path: string, ctx: EvaluationContext): unknown {
  const parts = path.split(".");
  let root: unknown;
  if (parts[0] === "entity") {
    root = ctx.entity ?? {};
    parts.shift();
  } else if (parts[0] === "payload") {
    root = ctx.payload;
    parts.shift();
  } else {
    root = ctx.payload;
  }
  let current: unknown = root;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

// Decimal-safe numeric comparison: compares as scaled bigints so money
// values like "10000.50" never go through float equality.
export function compareNumeric(a: unknown, b: unknown): number | null {
  const toScaled = (v: unknown): bigint | null => {
    if (typeof v === "number" && Number.isFinite(v)) v = String(v);
    if (typeof v !== "string") return null;
    const m = v.trim().match(/^(-)?(\d+)(?:\.(\d+))?$/);
    if (!m) return null;
    const frac = (m[3] ?? "").padEnd(6, "0").slice(0, 6);
    const scaled = BigInt(m[2] + frac);
    return m[1] ? -scaled : scaled;
  };
  const x = toScaled(a);
  const y = toScaled(b);
  if (x === null || y === null) return null;
  return x === y ? 0 : x > y ? 1 : -1;
}

function asList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [v];
}

function looseEquals(a: unknown, b: unknown): boolean {
  if (typeof a === "boolean" || typeof b === "boolean") {
    return String(a) === String(b);
  }
  const numeric = compareNumeric(a, b);
  if (numeric !== null) return numeric === 0;
  return String(a ?? "") === String(b ?? "");
}

export function evaluateCondition(condition: Condition, ctx: EvaluationContext): boolean {
  const actual = lookup(condition.field, ctx);
  const expected = condition.value;

  switch (condition.op) {
    case "exists":
      return !isEmpty(actual);
    case "not_exists":
      return isEmpty(actual);
    case "eq":
    case "changed_to":
      return looseEquals(actual, expected);
    case "neq":
      return !looseEquals(actual, expected);
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const cmp = compareNumeric(actual, expected);
      if (cmp === null) return false;
      if (condition.op === "gt") return cmp > 0;
      if (condition.op === "gte") return cmp >= 0;
      if (condition.op === "lt") return cmp < 0;
      return cmp <= 0;
    }
    case "in":
      return asList(expected).some((e) => looseEquals(actual, e));
    case "not_in":
      return !asList(expected).some((e) => looseEquals(actual, e));
    case "contains":
      if (Array.isArray(actual)) return actual.some((a) => looseEquals(a, expected));
      return String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
    case "older_than_days": {
      if (typeof actual !== "string" && !(actual instanceof Date)) return false;
      const date = new Date(actual as string);
      if (Number.isNaN(date.getTime())) return false;
      const days = Number(expected);
      const now = ctx.now ?? new Date(nowMs());
      return (now.getTime() - date.getTime()) / 86_400_000 > days;
    }
    default:
      return false;
  }
}

export function evaluateConditions(conditions: Condition[], logic: "all" | "any", ctx: EvaluationContext): boolean {
  if (!conditions.length) return true;
  return logic === "any"
    ? conditions.some((c) => evaluateCondition(c, ctx))
    : conditions.every((c) => evaluateCondition(c, ctx));
}

// Replaces {{payload.x}}, {{entity.x}} and {{summary}} placeholders. No code
// execution — only property lookups (docs/bos/20 "Validation").
export function renderTemplate(template: string, ctx: EvaluationContext): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path: string) => {
    if (path === "summary") return ctx.summary ?? "";
    const value = lookup(path, ctx);
    if (value === null || value === undefined) return "";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  });
}
