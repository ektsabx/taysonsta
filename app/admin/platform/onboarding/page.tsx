import { requirePermission, can } from "@/lib/bos/auth";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { Panel } from "@/components/yolias/dash/Stat";
import { SortTable } from "@/components/yolias/dash/SortTable";
import { acquisitionSources, getOnboardingSteps, otherSources, SOURCE_LABELS } from "@/services/yolias/onboarding";
import { StepsEditor } from "./StepsEditor";

// Onboarding (owner, 2026-11-03, D-276): the pages Yolias shows after sign-up,
// edited here, and where new users heard about Yolias. The welcome video is
// in Popups.
export default async function OnboardingPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return <NotConnected />;
  const [steps, sources, others] = await Promise.all([getOnboardingSteps(), acquisitionSources(), otherSources()]);
  const manage = can(bos, "platform.manage", "all");
  return (
    <div className="yd">
      <div className="yd-head"><h1><Tx>صفحات الإعداد</Tx></h1></div>
      <Panel title="الصفحات">{manage ? <StepsEditor initial={steps} /> : null}</Panel>
      <div className="yd-grid2">
        <Panel title="كيف عرفوا عنا؟">
          <SortTable firstLabel="المصدر" initial="users"
            cols={[{ key: "users", label: "المستخدمون", bar: true }, { key: "last30", label: "آخر 30 يومًا" }]}
            rows={sources.map((s) => ({ id: s.source, label: <Tx>{SOURCE_LABELS[s.source] ?? s.source}</Tx>, sortLabel: s.source, values: { users: s.users, last30: s.last30 } }))} />
        </Panel>
        <Panel title="إجابات «أخرى»">
          <ul className="yd-list">{others.map((o, i) => <li key={i}><span>{o.text}</span><small>{o.at ? formatDateTime(o.at) : "—"}</small></li>)}</ul>
          {!others.length && <p className="yd-empty"><Tx>لا توجد بيانات في هذه الفترة</Tx></p>}
        </Panel>
      </div>
    </div>
  );
}
