import { requirePermission } from "@/lib/bos/auth";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { Group, Panel, Stat } from "@/components/yolias/dash/Stat";
import { DashToolbar } from "@/components/yolias/dash/Toolbar";
import { periodOf } from "@/components/yolias/dash/period";
import { fmtValue } from "@/components/yolias/dash/format";
import { BOUNCE_LIMIT, deliverability } from "@/services/yolias/campaign-ops";

// Deliverability (audit, 2026-11-03): every connected mailbox across all
// accounts: sent, bounces, replies, unsubscribes and connection errors, so a
// mailbox that hurts its owner's reputation is seen before it's blocked.
const STATUS: Record<string, string> = { connected: "متصل", disconnected: "غير متصل", error: "خطأ", paused: "متوقف" };

export default async function DeliverabilityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("platform.read");
  if (!connected()) return <NotConnected />;
  const p = periodOf(await searchParams);
  const boxes = await deliverability(p.since);
  const sent = boxes.reduce((a, b) => a + b.sent, 0);
  const bounced = boxes.reduce((a, b) => a + b.bounced, 0);
  const unsub = boxes.reduce((a, b) => a + b.unsubscribed, 0);
  const risky = boxes.filter((b) => (b.sent >= 20 && b.bounced / b.sent > BOUNCE_LIMIT) || b.status !== "connected" || b.lastError);
  const rows = [...boxes].sort((a, b) => Number(risky.includes(b)) - Number(risky.includes(a)) || b.sent - a.sent);
  return (
    <div className="yd">
      <div className="yd-head">
        <h1><Tx>جودة الإرسال</Tx></h1>
        <DashToolbar preset={p.preset} from={p.from} to={p.to} filters={[]} />
      </div>
      <Group title="صناديق البريد" tone="platform">
        <Stat tone="platform" label="صناديق متصلة" value={boxes.filter((b) => b.status === "connected").length} />
        <Stat tone="platform" label="تحتاج انتباهًا" value={risky.length} good="down" />
        <Stat tone="platform" label="المُرسل" value={sent} />
        <Stat tone="platform" label="نسبة الارتداد" format="pct" value={sent ? bounced / sent : null} good="down" />
        <Stat tone="platform" label="إلغاء الاشتراك" value={unsub} good="down" />
      </Group>
      <Panel title="كل صناديق البريد">
        <div className="yd-table-wrap">
          <table className="yd-table yd-wrap">
            <thead><tr><th><Tx>البريد</Tx></th><th><Tx>الحساب</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الحد اليومي</Tx></th><th><Tx>المُرسل</Tx></th><th><Tx>الارتداد</Tx></th><th><Tx>الردود</Tx></th><th><Tx>إلغاء الاشتراك</Tx></th><th><Tx>آخر خطأ</Tx></th></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <th scope="row" dir="ltr">{b.email}<br /><span className="yd-prev">{b.provider}</span></th>
                  <td dir="auto">{b.workspace}</td>
                  <td><span className={`yd-chip${b.status === "connected" ? " good" : " bad"}`}><Tx>{STATUS[b.status] ?? b.status}</Tx></span></td>
                  <td dir="ltr">{b.dailyLimit}</td>
                  <td dir="ltr">{b.sent}</td>
                  <td dir="ltr">{b.sent ? <span className={b.sent >= 20 && b.bounced / b.sent > BOUNCE_LIMIT ? "yd-chip bad" : ""}>{fmtValue(b.bounced / b.sent, "pct")}</span> : "—"}</td>
                  <td dir="ltr">{b.replies}</td>
                  <td dir="ltr">{b.unsubscribed}</td>
                  <td dir="auto">{b.lastError ?? ""}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={9} className="yd-empty"><Tx>لا توجد صناديق بريد</Tx></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
