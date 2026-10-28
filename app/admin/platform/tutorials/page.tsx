import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { listTutorials } from "@/services/yolias/tutorials";
import { moveTutorialAction, removeTutorialAction } from "./actions";
import { TutorialForm } from "./TutorialForm";

// Platform videos (owner, 2026-10-28): what Yolias users see in Help →
// Platform videos (/help-center/videos). Changes show at once, no deploy.
export default async function TutorialsPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="فيديوهات شرح المنصة" /><NotConnected /></>);
  const items = await listTutorials();
  const manage = can(bos, "platform.manage", "all");
  const site = (process.env.YOLIAS_SITE_URL ?? "").replace(/\/$/, "");
  return (
    <>
      <PageHeader title="فيديوهات شرح المنصة" subtitle="الفيديوهات التي تظهر لمستخدمي يولياس من المساعدة ← شرح المنصة بالفيديو، بالترتيب هنا." />
      {manage && <Card title="إضافة فيديو"><TutorialForm value={null} /></Card>}
      <Card title="الفيديوهات">
        {!items.length ? <EmptyState title="لا توجد فيديوهات بعد" /> : (
          <div style={{ display: "grid", gap: 16 }}>
            {items.map((v, i) => (
              <details key={v.id} className="bos-card" style={{ padding: 14 }}>
                <summary style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", cursor: "pointer" }}>
                  <strong>{i + 1}. {v.title.ar || v.title.en}</strong>
                  {v.published ? <StatusBadge tone="success" label="منشور" /> : <StatusBadge tone="neutral" label="مخفي" />}
                  <span className="bos-faint" dir="ltr" style={{ fontSize: 12, overflowWrap: "anywhere" }}>{v.url}</span>
                </summary>
                <div style={{ marginTop: 12 }}>
                  {manage ? (
                    <>
                      <TutorialForm value={v} />
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        {i > 0 && <ActionForm action={moveTutorialAction} successMessage="تم"><input type="hidden" name="id" value={v.id} /><input type="hidden" name="dir" value="up" /><SubmitButton label="تحريك لأعلى" pendingLabel="..." className="admin-btn secondary" /></ActionForm>}
                        {i < items.length - 1 && <ActionForm action={moveTutorialAction} successMessage="تم"><input type="hidden" name="id" value={v.id} /><input type="hidden" name="dir" value="down" /><SubmitButton label="تحريك لأسفل" pendingLabel="..." className="admin-btn secondary" /></ActionForm>}
                        <ActionForm action={removeTutorialAction} successMessage="تم الحذف"><input type="hidden" name="id" value={v.id} /><SubmitButton label="حذف" pendingLabel="جارٍ الحذف..." className="admin-btn danger" /></ActionForm>
                      </div>
                    </>
                  ) : <p className="bos-faint"><Tx>التعديل يحتاج صلاحية إدارة المنصة.</Tx></p>}
                </div>
              </details>
            ))}
          </div>
        )}
        {site && <p className="bos-faint" style={{ fontSize: 12, marginTop: 12 }}><Tx>الصفحة العامة:</Tx> <a className="bos-link" href={`${site}/help-center/videos`} target="_blank" rel="noreferrer" dir="ltr">{site}/help-center/videos</a></p>}
      </Card>
    </>
  );
}
