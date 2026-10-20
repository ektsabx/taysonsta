// The em dash (—) is not used anywhere in Yolias copy (owner, 2026-10-20).
// Text written by a model or saved before the rule is passed through
// plainDashes before it's stored or shown: a dash that opens a line becomes a
// list hyphen, any other one becomes `sep` (a comma by default; names and
// titles use a colon, as in "Saudi SaaS: Founders").
export function plainDashes(s: string, sep = ", "): string {
  if (!s.includes("—")) return s;
  return s
    .replace(/^([ \t]*)—[ \t]*/gm, "$1- ")
    .replace(/[ \t]*—[ \t]*/g, sep)
    .replace(/[,:] ([.,;:!?])/g, "$1");
}

/** plainDashes on every string inside a JSON-like value (structured model output). */
export function plainDashesDeep<T>(value: T): T {
  if (typeof value === "string") return plainDashes(value) as T;
  if (Array.isArray(value)) return value.map((v) => plainDashesDeep(v)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, plainDashesDeep(v)])) as T;
  }
  return value;
}
