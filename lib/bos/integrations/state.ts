interface ConnStatus { status: string; last_test_ok?: boolean | null }

// Status of one account: "connected" only after a successful live test
// (docs/bos/35 B11) — a saved key alone is never shown as connected.
export function connState(c: ConnStatus, testable: boolean): { tone: "success" | "danger" | "warning" | "neutral"; label: string } {
  if (c.status === "disabled") return { tone: "neutral", label: "معطّل" };
  if (c.status === "error" || c.last_test_ok === false) return { tone: "danger", label: "فشل الاتصال" };
  if (c.last_test_ok) return { tone: "success", label: "متصل" };
  return testable ? { tone: "warning", label: "لم يُختبر بعد" } : { tone: "neutral", label: "محفوظ — لا يدعم الاختبار" };
}

