import { Tx } from "@/components/bos/I18n";
import { nowMs } from "@/lib/bos/clock";
import { formatDateTime } from "@/lib/bos/format";

function left(due: string) {
  const mins = Math.round((new Date(due).getTime() - nowMs()) / 60000);
  const abs = Math.abs(mins);
  const txt = abs >= 1440 ? `${Math.round(abs / 1440)} يوم` : abs >= 60 ? `${Math.round(abs / 60)} س` : `${abs} د`;
  return { mins, txt };
}

// SLA timers (§48): first response and resolution, breached highlight.
export function SlaIndicator({ t, compact }: { t: { status: string; first_response_due_at: string | null; resolution_due_at: string | null; first_responded_at: string | null; resolved_at: string | null; sla_breached_at: string | null }; compact?: boolean }) {
  const done = ["resolved", "closed"].includes(t.status);
  const parts: React.ReactNode[] = [];
  if (t.sla_breached_at) parts.push(<span key="b" className="bos-badge tone-danger plain"><Tx>تجاوز SLA</Tx></span>);
  if (t.first_response_due_at) {
    if (t.first_responded_at) parts.push(<span key="f" className="bos-faint">أول رد ✓{compact ? "" : ` ${formatDateTime(t.first_responded_at)}`}</span>);
    else if (!done) {
      const l = left(t.first_response_due_at);
      parts.push(<span key="f" style={{ color: l.mins < 0 ? "#f87171" : l.mins < 60 ? "var(--bos-warning)" : undefined }}>أول رد: {l.mins < 0 ? `متأخر ${l.txt}` : `خلال ${l.txt}`}</span>);
    }
  }
  if (t.resolution_due_at && !done) {
    const l = left(t.resolution_due_at);
    parts.push(<span key="r" style={{ color: l.mins < 0 ? "#f87171" : l.mins < 240 ? "var(--bos-warning)" : undefined }}>الحل: {l.mins < 0 ? `متأخر ${l.txt}` : `خلال ${l.txt}`}</span>);
  } else if (t.resolved_at && !compact) parts.push(<span key="r" className="bos-faint"><Tx vars={{ v: formatDateTime(t.resolved_at) }}>{"حُلّت {v}"}</Tx></span>);
  return <span className="bos-stack" style={{ gap: 2, fontSize: 12 }}>{parts.length ? parts : "—"}</span>;
}
