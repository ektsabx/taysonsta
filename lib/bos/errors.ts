// Errors surfaced to users must be understandable, never "Error 500" (§73).

export class ForbiddenError extends Error {
  constructor(message = "ليس لديك صلاحية لتنفيذ هذا الإجراء.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "العنصر غير موجود أو ليس لديك صلاحية لرؤيته.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  fieldErrors: Record<string, string>;
  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

interface PgLikeError {
  code?: string;
  message?: string;
  details?: string;
}

function isPgError(value: unknown): value is PgLikeError {
  return typeof value === "object" && value !== null && ("code" in value || "message" in value);
}

// Maps DB/Supabase errors to a user-facing sentence. Business-rule
// exceptions raised by our SQL functions (errcode 22023/P0002/23505/23P01)
// already carry a readable message, so we pass those through.
export function toUserMessage(error: unknown, fallback = "تعذر إتمام العملية. حاول مرة أخرى."): string {
  if (error instanceof ForbiddenError || error instanceof NotFoundError || error instanceof ValidationError) {
    return error.message;
  }

  if (isPgError(error)) {
    switch (error.code) {
      case "22023":
      case "P0002":
      case "23P01":
        return error.message ?? fallback;
      case "23505":
        if (error.message && !error.message.includes("duplicate key")) return error.message;
        return "هذا السجل موجود بالفعل (قيمة مكررة).";
      case "23503":
        return "لا يمكن تنفيذ العملية لأن السجل مرتبط بسجلات أخرى.";
      case "23514":
        return "القيم المدخلة غير صالحة. راجع الحقول وحاول مرة أخرى.";
      case "22P02":
        return "صيغة إحدى القيم غير صحيحة.";
      default:
        break;
    }
  }

  return fallback;
}

export function logServerError(context: string, error: unknown) {
  console.error(`[bos] ${context}`, error);
}
