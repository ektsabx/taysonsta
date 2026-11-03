import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { Group, Panel, Stat } from "@/components/yolias/dash/Stat";
import { DashToolbar } from "@/components/yolias/dash/Toolbar";
import { periodOf } from "@/components/yolias/dash/period";
import { fmtValue } from "@/components/yolias/dash/format";
import { campaignOps, type CampaignFlag } from "@/services/yolias/campaign-ops";
import { PauseForm } from "./PauseForm";

// Campaign operations (audit, 2026-11-03): every campaign across all accounts,
// the platform's sending and results, and what needs attention (stuck,
// bouncing, failing), with a pause for a campaign at risk.
const FLAG: Record<CampaignFlag, string> = { stuck: "متوقفة عن الإرسال", bounces: "ارتداد مرتفع", failures: "رسائل فشلت" };
const STATUS: Record<string, string> = { draft: "مسودة", scheduled: "مجدولة", active: "نشطة", paused: "متوقفة", completed: "مكتملة", failed: "فشلت" };

export default async function CampaignOpsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return <NotConnected />;
  const sp = await searchParams;
  const p = periodOf(sp);
  const canEdit = can(bos, "platform.manage", "all");
  const all = await campaignOps(p.since);
  const show = sp.show === "attention" ? all.filter((c) => c.flags.length) : sp.show === "active" ? all.filter((c) => c.status === "active") : all;
  const sum = (k: "sent" | "bounced" | "replies" | "interested" | "meetings") => all.reduce((a, c) => a + c[k], 0);
  const sent = sum("sent");
  const rate = (a: number, b: number) => (b ? a / b : null);
  const rows = [...show].sort((a, b) => b.flags.length - a.flags.length || b.sent - a.sent).slice(0, 200);
  return (
    <div className="yd">
      <div className="yd-head">
        <h1><Tx>عمليات الحملات</Tx></h1>
        <DashToolbar preset={p.preset} from={p.from} to={p.to} filters={[{ key: "show", label: "العرض", options: [{ value: "attention", label: "تحتاج انتباهًا" }, { value: "active", label: "النشطة" }] }]} />
      </div>
      <Group title="الحملات" tone="platform">
        <Stat tone="platform" label="كل الحملات" value={all.length} />
        <Stat tone="platform" label="النشطة" value={all.filter((c) => c.status === "active").length} />
        <Stat tone="platform" label="المتوقفة" value={all.filter((c) => c.status === "paused").length} />
        <Stat tone="platform" label="المكتملة" value={all.filter((c) => c.status === "completed").length} />
        <Stat tone="platform" label="تحتاج انتباهًا" value={all.filter((c) => c.flags.length).length} href="?show=attention" />
      </Group>
      <Group title="الإرسال والنتائج" tone="growth">
        <Stat tone="growth" label="المُرسل" value={sent} />
        <Stat tone="growth" label="نسبة الارتداد" format="pct" value={rate(sum("bounced"), sent)} good="down" />
        <Stat tone="growth" label="الردود" value={sum("replies")} />
        <Stat tone="growth" label="المهتمون" value={sum("interested")} />
        <Stat tone="growth" label="الاجتماعات" value={sum("meetings")} />
        <Stat tone="economics" label="تكلفة الذكاء الاصطناعي" format="usd" value={all.reduce((a, c) => a + c.aiCostUsd, 0)} good="down" />
        <Stat tone="growth" label="اجتماع لكل 100 رسالة" value={sent ? (sum("meetings") / sent) * 100 : null} />
      </Group>
      <Panel title="الحملات عبر كل الحسابات">
        <div className="yd-table-wrap">
          <table className="yd-table yd-wrap">
            <thead><tr><th><Tx>الحملة</Tx></th><th><Tx>الحساب</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>المُرسل</Tx></th><th><Tx>الارتداد</Tx></th><th><Tx>فشلت</Tx></th><th><Tx>الردود</Tx></th><th><Tx>المهتمون</Tx></th><th><Tx>الاجتماعات</Tx></th><th><Tx>تكلفة الذكاء الاصطناعي</Tx></th><th><Tx>تنبيهات</Tx></th>{canEdit && <th />}</tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <th scope="row" dir="auto">{c.name}<br /><span className="yd-prev" dir="ltr">{c.mailbox ?? ""}</span></th>
                  <td><Link href={`/admin/platform/workspaces/${c.workspaceId}`} dir="auto">{c.workspace}</Link></td>
                  <td><Tx>{STATUS[c.status] ?? c.status}</Tx></td>
                  <td dir="ltr">{c.sent}</td>
                  <td dir="ltr">{c.sent ? fmtValue(c.bounced / c.sent, "pct") : "—"}</td>
                  <td dir="ltr">{c.failed}</td>
                  <td dir="ltr">{c.replies}</td>
                  <td dir="ltr">{c.interested}</td>
                  <td dir="ltr">{c.meetings}</td>
                  <td dir="ltr">{fmtValue(c.aiCostUsd, "usd")}</td>
                  <td>{c.flags.map((f) => <span key={f} className="yd-chip bad"><Tx>{FLAG[f]}</Tx></span>)}</td>
                  {canEdit && <td>{(c.status === "active" || c.status === "scheduled") && c.flags.length > 0 && <PauseForm id={c.id} />}</td>}
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={12} className="yd-empty"><Tx>لا توجد حملات</Tx></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
