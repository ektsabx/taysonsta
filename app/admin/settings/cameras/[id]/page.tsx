import { BosTable } from "@/components/bos/BosTable";
import { notFound } from "next/navigation";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { formatDateTime } from "@/lib/bos/format";
import { cameraEvents, viewCamera } from "@/services/bos/cameras";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";

const kindLabel: Record<string, string> = { created: "إضافة", updated: "تعديل", viewed: "مشاهدة", status_check: "فحص الاتصال", disabled: "تعطيل", enabled: "تفعيل" };

// One camera: viewer (when permitted and supported) + event log.
export default async function CameraPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("cameras.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: cam } = await db().from("cameras").select("id, name, connection_type, status").eq("id", id).maybeSingle();
  if (!cam) notFound();
  let viewer: { url: string; type: string } | null = null;
  let reason: string | null = null;
  if (can(bos, "cameras.view_sensitive")) {
    try {
      const c = await viewCamera(bos, id);
      viewer = { url: c.viewer_url!, type: c.connection_type };
    } catch (e) {
      reason = e instanceof Error ? e.message : "غير متاح";
    }
  } else reason = "ليس لديك صلاحية مشاهدة الكاميرات.";
  const events = await cameraEvents(bos, id);
  const { data: people } = await db().from("employees").select("user_id, full_name").in("user_id", [...new Set(events.map((e) => e.actor_user_id).filter(Boolean))].concat(["00000000-0000-0000-0000-000000000000"]) as string[]);
  const name = new Map((people ?? []).map((p) => [p.user_id, p.full_name]));
  return (
    <>
      <PageHeader title={cam.name} />
      <Card title="العرض">
        {viewer ? (
          <>
            <p className="bos-hint"><Tx>هذه المشاهدة مسجلة باسمك.</Tx></p>
            {viewer.type === "hls" ? <video src={viewer.url} controls autoPlay muted playsInline style={{ width: "100%", maxHeight: 520, background: "#000", borderRadius: 8 }} /> : <img src={viewer.url} alt={cam.name} style={{ width: "100%", maxHeight: 520, objectFit: "contain", background: "#000", borderRadius: 8 }} />}
          </>
        ) : <p className="bos-hint" style={{ margin: 0 }}><Tx>{reason ?? "غير متاح"}</Tx></p>}
      </Card>
      <Card title="سجل الأحداث" flush>
        {events.length ? <BosTable className="bos-table" style={{ fontSize: 12.5 }}><tbody>{events.map((e) => <tr key={e.id}><td className="bos-nowrap">{formatDateTime(e.occurred_at)}</td><td><Tx>{kindLabel[e.kind] ?? e.kind}</Tx></td><td>{e.actor_user_id ? name.get(e.actor_user_id) ?? "—" : "—"}</td><td>{e.detail ?? ""}</td></tr>)}</tbody></BosTable> : <EmptyState title="لا توجد أحداث" />}
      </Card>
    </>
  );
}
