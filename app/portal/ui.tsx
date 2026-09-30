import { statusDef } from "@/lib/bos/labels";
import { formatMoney } from "@/lib/bos/money";

const toneClass: Record<string, string> = { success: "success", warning: "warning", danger: "danger", info: "info", accent: "info", neutral: "" };

export function PBadge({ map, value, label, tone }: { map?: string; value?: string | null; label?: string; tone?: string }) {
  const def = map && value ? statusDef(map, value) : null;
  return <span className={`portal-badge ${toneClass[tone ?? def?.tone ?? "neutral"] ?? ""}`}>{label ?? def?.label ?? value ?? "—"}</span>;
}

export function PProgress({ value }: { value: number }) {
  return <div className="portal-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function PMoney({ value, currency }: { value: unknown; currency: string | null | undefined }) {
  return <span className="bos-num">{formatMoney(value, currency)}</span>;
}

export function PEmpty({ title }: { title: string }) {
  return <div className="portal-muted" style={{ padding: 18, textAlign: "center" }}>{title}</div>;
}

export function PTop({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return <div className="portal-top"><h1>{title}</h1><div className="no-print" style={{ display: "flex", gap: 8 }}>{actions}</div></div>;
}

export const stepperStatuses = ["planning", "design", "development", "qa", "client_review", "launch", "completed"];
export const stepperLabels: Record<string, string> = { planning: "التخطيط", design: "التصميم", development: "التطوير", qa: "الاختبار", client_review: "مراجعة العميل", launch: "الإطلاق", completed: "مكتمل" };

export function PStepper({ status }: { status: string }) {
  const idx = stepperStatuses.indexOf(status);
  return (
    <div className="portal-steps">
      {stepperStatuses.map((s, i) => <span key={s} className={i < idx || status === "completed" ? "done" : i === idx ? "current" : undefined}>{stepperLabels[s]}</span>)}
      {["on_hold", "cancelled"].includes(status) ? <span className="current">{status === "on_hold" ? "متوقف مؤقتاً" : "ملغى"}</span> : null}
    </div>
  );
}
