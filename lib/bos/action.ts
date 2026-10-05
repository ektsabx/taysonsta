import "server-only";
import { z } from "zod";
import { ForbiddenError, NotFoundError, ValidationError, logServerError, toUserMessage } from "@/lib/bos/errors";

// Uniform result for every BOS server action (§71 validation, §73 errors).
export type ActionState<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const initialActionState: ActionState = { ok: true };

export function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      out[k] = [...((out[k] as unknown[]) ?? []), typeof value === "string" ? value : value];
    } else {
      out[key] = typeof value === "string" ? value : value;
    }
  }
  return out;
}

export function parseForm<S extends z.ZodTypeAny>(schema: S, input: FormData | Record<string, unknown>): z.infer<S> {
  const data = input instanceof FormData ? formDataToObject(input) : input;
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    throw new ValidationError("بعض الحقول تحتاج إلى مراجعة.", fieldErrors);
  }
  return parsed.data;
}

export async function handleAction<T>(context: string, fn: () => Promise<T | ActionState<T>>, fallback?: string): Promise<ActionState<T>> {
  try {
    const result = await fn();
    if (result && typeof result === "object" && "ok" in (result as object)) {
      return result as ActionState<T>;
    }
    return { ok: true, data: result as T };
  } catch (error) {
    // next/navigation redirect()/notFound() throw control-flow errors that must propagate.
    if (error && typeof error === "object" && "digest" in error && typeof (error as { digest?: unknown }).digest === "string"
      && ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT") || (error as { digest: string }).digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))) {
      throw error;
    }
    if (error instanceof ValidationError) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    if (!(error instanceof ForbiddenError) && !(error instanceof NotFoundError)) {
      logServerError(context, error);
    }
    return { ok: false, error: toUserMessage(error, fallback) };
  }
}

// Common zod field helpers for FormData input.
export const zf = {
  text: (max = 500) => z.string().trim().max(max, `الحد الأقصى ${max} حرف`),
  required: (label: string, max = 500) => z.string().trim().min(1, `${label} مطلوب`).max(max, `الحد الأقصى ${max} حرف`),
  optionalText: (max = 5000) =>
    z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional()),
  optionalUuid: () => z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().uuid("قيمة غير صالحة").nullable()),
  uuid: (label = "القيمة") => z.string().uuid(`${label} غير صالح`),
  optionalEmail: () =>
    z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().email("بريد إلكتروني غير صالح").nullable().optional()),
  optionalUrl: () =>
    z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" && !/^https?:\/\//.test(v.trim()) ? `https://${v.trim()}` : v),
      z.string().url("رابط غير صالح").nullable().optional(),
    ),
  money: (label = "المبلغ") =>
    z.preprocess((v) => (typeof v === "string" ? v.replace(/[,\s]/g, "") : v), z.string().regex(/^\d+(\.\d{1,3})?$/, `${label} غير صالح`)),
  optionalMoney: () =>
    z.preprocess(
      (v) => (typeof v === "string" ? (v.replace(/[,\s]/g, "") === "" ? null : v.replace(/[,\s]/g, "")) : v),
      z.string().regex(/^\d+(\.\d{1,3})?$/, "مبلغ غير صالح").nullable().optional(),
    ),
  optionalDate: () =>
    z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح").nullable()),
  optionalDateTime: () =>
    z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().min(10, "تاريخ غير صالح").nullable()),
  int: (min: number, max: number) => z.coerce.number().int().min(min).max(max),
  checkbox: () => z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  currency: () => z.enum(["EGP", "USD"], { message: "العملة EGP أو USD فقط" }),
};
