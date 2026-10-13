import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KeyValues, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { acquisitionSources, getWelcomeVideo, otherSources, SOURCE_LABELS } from "@/services/yolias/onboarding";
import { WelcomeVideoForm } from "./WelcomeVideoForm";

// Yolias onboarding (D-199): the welcome video after sign-in and where new
// users heard about Yolias ("How Did You Find Us?").
export default async function OnboardingPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الترحيب ومصادر التسجيل" /><NotConnected /></>);
  const [video, sources, others] = await Promise.all([getWelcomeVideo(), acquisitionSources(), otherSources()]);
  const manage = can(bos, "platform.manage", "all");
  const total = sources.reduce((a, s) => a + s.users, 0) || 1;
  return (
    <>
      <PageHeader title="الترحيب ومصادر التسجيل" subtitle="فيديو الترحيب الذي يظهر للمستخدم مرة واحدة بعد تسجيل الدخول، ومن أين عرف المستخدمون عن Yolias." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        <Card title="فيديو الترحيب">
          <KeyValues items={[
            { label: "الحالة", value: <Tx>{video.enabled && video.url ? "مفعّل" : "متوقف"}</Tx> },
            { label: "آخر تعديل", value: video.updatedAt ? formatDateTime(video.updatedAt) : "—" },
          ]} />
          {manage ? <WelcomeVideoForm value={video} /> : <p className="bos-faint"><Tx>التعديل يحتاج صلاحية إدارة المنصة.</Tx></p>}
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>يظهر الفيديو الجديد فورًا دون إعادة نشر. المستخدم الذي أغلق الفيديو يمكنه مشاهدته مرة أخرى من قائمة حسابه.</Tx></p>
        </Card>
        <Card title="كيف عرفوا عنا؟">
          {!sources.length ? <EmptyState title="لا توجد بيانات بعد" /> : (
            <div className="bos-table-scroll">
              <BosTable className="bos-table">
                <thead><tr><th><Tx>المصدر</Tx></th><th><Tx>المستخدمون</Tx></th><th><Tx>آخر 30 يومًا</Tx></th><th>%</th></tr></thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.source}>
                      <td><Tx>{SOURCE_LABELS[s.source] ?? s.source}</Tx></td>
                      <td className="bos-num">{num(s.users)}</td>
                      <td className="bos-num">{num(s.last30)}</td>
                      <td className="bos-num">{Math.round((s.users / total) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </BosTable>
            </div>
          )}
        </Card>
        <Card title="إجابات «أخرى»">
          {!others.length ? <EmptyState title="لا توجد إجابات بعد" /> : (
            <ul style={{ display: "grid", gap: 6, fontSize: 13 }}>
              {others.map((o, i) => <li key={i}>{o.text} <span className="bos-faint">· {o.at ? formatDateTime(o.at) : "—"}</span></li>)}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
