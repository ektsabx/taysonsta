import { BosTable } from "@/components/bos/BosTable";
import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { formatDateTime } from "@/lib/bos/format";
import { listCameras } from "@/services/bos/cameras";
import { listRoles } from "@/services/bos/shared";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/bos/ui";
import { CameraButton, CheckButton } from "./CameraControls";

const conn: Record<string, { l: string; t: "success" | "danger" | "neutral" | "warning" }> = { online: { l: "متصلة", t: "success" }, offline: { l: "غير متصلة", t: "danger" }, error: { l: "خطأ", t: "danger" }, unknown: { l: "غير معروف", t: "neutral" }, unsupported: { l: "تحتاج بوابة", t: "warning" } };
const typeLabel: Record<string, string> = { hls: "HLS", mjpeg: "MJPEG", rtsp: "RTSP", onvif: "ONVIF", vendor_cloud: "سحابة المصنّع", other: "أخرى" };

// Office cameras (docs/bos/30 §29): registry, status, policy, viewer where supported.
export default async function CamerasPage() {
  const { bos } = await requirePermission("cameras.read");
  const [cams, { data: branches }, roles] = await Promise.all([listCameras(bos), db().from("branches").select("id, name").eq("status", "active").order("name"), listRoles()]);
  const manage = can(bos, "cameras.manage");
  const branchOpts = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));
  const roleOpts = roles.map((r) => ({ value: r.id, label: r.name }));
  return (
    <>
      <PageHeader title="كاميرات المكتب" subtitle="سجل الأجهزة المسموح بها وحالتها — العرض فقط حيث يدعم الجهاز بروتوكولاً مناسباً" actions={manage ? <CameraButton branches={branchOpts} roles={roleOpts} /> : null} />
      <Card flush>
        {cams.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الكاميرا</Tx></th><th><Tx>الفرع / الموقع</Tx></th><th><Tx>النوع</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الاتصال</Tx></th><th><Tx>الإشعار</Tx></th><th /></tr></thead>
            <tbody>{cams.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/admin/settings/cameras/${c.id}`}>{c.name}</Link>{c.vendor ? <div className="bos-faint" style={{ fontSize: 11 }}>{c.vendor} {c.model ?? ""}</div> : null}</td>
                <td>{(c.branches as { name: string } | null)?.name ?? "—"}{c.location_label ? ` · ${c.location_label}` : ""}</td>
                <td><Tx>{typeLabel[c.connection_type] ?? c.connection_type}</Tx></td>
                <td><StatusBadge tone={c.status === "active" ? "success" : "neutral"} label={c.status === "active" ? "مفعّلة" : c.status === "maintenance" ? "صيانة" : "معطّلة"} /></td>
                <td><StatusBadge tone={conn[c.connection_status]?.t ?? "neutral"} label={conn[c.connection_status]?.l ?? c.connection_status} />{c.last_checked_at ? <div className="bos-faint" style={{ fontSize: 11 }}>{formatDateTime(c.last_checked_at)}</div> : null}</td>
                <td>{c.notice_displayed ? "✓" : <span className="bos-danger"><Tx>غير مؤكد</Tx></span>}</td>
                <td className="bos-nowrap">{manage ? <><CheckButton id={c.id} /> <CameraButton camera={c} branches={branchOpts} roles={roleOpts} /></> : null}</td>
              </tr>
            ))}</tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد كاميرات مسجلة" />}
      </Card>
      <Card title="دليل الإعداد والحدود">
        <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13 }}>
          <li><Tx>لا توجد واجهة موحدة لكل الكاميرات. المتصفح يعرض فقط بث HLS أو MJPEG عبر https.</Tx></li>
          <li><Tx>كاميرات RTSP/ONVIF تحتاج بوابة (مثل خادم محلي يحوّل البث إلى HLS) أو سحابة المصنّع التي توفر رابط عرض.</Tx></li>
          <li><Tx>لا تُحفظ كلمات مرور الكاميرات في النظام ولا تظهر في الواجهة أو السجلات؛ استخدم روابط موقّعة مؤقتة من البوابة.</Tx></li>
          <li><Tx>المشاهدة مقصورة على صلاحية «مشاهدة الكاميرات» والأدوار المحددة، وتتطلب تأكيد وجود إشعار التصوير وسياسة الاستخدام، وكل مشاهدة مسجلة.</Tx></li>
          <li><Tx>لا يوجد تسجيل أو مراقبة خفية؛ التزم بقوانين الخصوصية والعمل المحلية.</Tx></li>
        </ul>
      </Card>
    </>
  );
}
