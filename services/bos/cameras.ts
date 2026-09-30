import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import { can, type BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { nowIso } from "@/lib/bos/clock";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";

// Office cameras (docs/bos/30 §29, doc 31 Phase 19): a registry of allowed
// devices with branch, location, connection type and status, an event log,
// and a viewer only where a browser-playable protocol exists (HLS / MJPEG
// over https from the camera vendor's cloud or a local gateway). RTSP/ONVIF
// can't be played by browsers — they are marked "needs a gateway" instead of
// faking a stream. No camera credentials are stored or shown; viewing is
// limited to permitted roles, requires a confirmed privacy notice, and is logged.

export type Camera = Tables<"cameras">;
const PLAYABLE = ["hls", "mjpeg"];

async function log(cameraId: string, kind: "created" | "updated" | "viewed" | "status_check" | "disabled" | "enabled", actorId: string | null, detail: string | null = null) {
  await db().from("camera_events").insert({ camera_id: cameraId, kind, actor_user_id: actorId, detail: detail?.slice(0, 500) ?? null });
}

export async function listCameras(bos: BosUser) {
  if (!can(bos, "cameras.read")) throw new ForbiddenError();
  const { data } = await db().from("cameras").select("*, branches(name)").order("name");
  return data ?? [];
}

export interface CameraInput { name: string; branch_id: string | null; location_label: string | null; connection_type: Camera["connection_type"]; vendor: string | null; model: string | null; serial_number: string | null; viewer_url: string | null; status: Camera["status"]; allowed_role_ids: string[]; notice_displayed: boolean; notes: string | null }

export async function saveCamera(bos: BosUser, id: string | null, input: CameraInput) {
  if (!can(bos, "cameras.manage")) throw new ForbiddenError();
  if (!input.name.trim()) throw new ValidationError("اسم الكاميرا مطلوب.", { name: "مطلوب" });
  if (input.viewer_url) {
    if (!/^https:\/\/[^\s]+$/.test(input.viewer_url)) throw new ValidationError("رابط العرض يجب أن يبدأ بـ https://", { viewer_url: "غير صالح" });
    if (/^https:\/\/[^/]*@/.test(input.viewer_url) || /[?&](pass(word)?|pwd|user(name)?)=/i.test(input.viewer_url)) throw new ValidationError("لا تضع اسم مستخدم أو كلمة مرور في الرابط — استخدم رابطاً موقّعاً من البوابة أو السحابة.", { viewer_url: "يحتوي بيانات دخول" });
    if (!PLAYABLE.includes(input.connection_type)) throw new ValidationError("رابط العرض للكاميرات بنوع HLS أو MJPEG فقط.");
  }
  const row = { ...input, name: input.name.trim(), connection_status: (PLAYABLE.includes(input.connection_type) ? "unknown" : "unsupported") as Camera["connection_status"] };
  if (id) {
    const { data: before } = await db().from("cameras").select("status").eq("id", id).maybeSingle();
    if (!before) throw new NotFoundError();
    const { error } = await db().from("cameras").update(row).eq("id", id);
    if (error) throw error;
    await log(id, before.status !== input.status ? (input.status === "disabled" ? "disabled" : "enabled") : "updated", bos.userId);
  } else {
    const { data, error } = await db().from("cameras").insert({ ...row, created_by: bos.userId }).select("id").single();
    if (error) throw error;
    id = data.id;
    await log(id, "created", bos.userId);
  }
  await audit({ actorId: bos.userId, action: "camera.saved", entityType: "camera", entityId: id, newValue: { name: row.name, type: row.connection_type, status: row.status } });
  return id;
}

// Reachability of the viewer URL (HLS / MJPEG) — never logs the URL itself.
export async function checkCamera(bos: BosUser, id: string, fetcher: typeof fetch = fetch) {
  if (!can(bos, "cameras.manage")) throw new ForbiddenError();
  const { data: cam } = await db().from("cameras").select("*").eq("id", id).maybeSingle();
  if (!cam) throw new NotFoundError();
  let status: Camera["connection_status"] = "unsupported";
  let error: string | null = null;
  if (PLAYABLE.includes(cam.connection_type) && cam.viewer_url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetcher(cam.viewer_url, { method: "GET", signal: ctrl.signal, headers: { Range: "bytes=0-1023" } });
      status = r.ok || r.status === 206 ? "online" : "offline";
      if (!r.ok && r.status !== 206) error = `HTTP ${r.status}`;
    } catch (e) {
      status = "offline";
      error = e instanceof Error && e.name === "AbortError" ? "Timeout" : "Unreachable";
    } finally {
      clearTimeout(t);
    }
  } else if (PLAYABLE.includes(cam.connection_type)) {
    status = "unknown";
    error = "No viewer URL";
  } else error = "RTSP/ONVIF needs a gateway that serves HLS";
  await db().from("cameras").update({ connection_status: status, last_checked_at: nowIso(), last_error: error }).eq("id", id);
  await log(id, "status_check", bos.userId, `${status}${error ? ` · ${error}` : ""}`);
  return { status, error };
}

// Viewing: permission + role allow-list + active + notice confirmed; logged.
export async function viewCamera(bos: BosUser, id: string) {
  if (!can(bos, "cameras.view_sensitive")) throw new ForbiddenError("ليس لديك صلاحية مشاهدة الكاميرات.");
  const { data: cam } = await db().from("cameras").select("*, branches(name)").eq("id", id).maybeSingle();
  if (!cam) throw new NotFoundError();
  if (cam.allowed_role_ids.length && !bos.isSuperAdmin) {
    const { data: roles } = await db().from("user_roles").select("role_id").eq("user_id", bos.userId);
    if (!(roles ?? []).some((r) => cam.allowed_role_ids.includes(r.role_id))) throw new ForbiddenError("هذه الكاميرا مقصورة على أدوار محددة.");
  }
  if (cam.status !== "active") throw new ValidationError("الكاميرا غير مفعّلة.");
  if (!cam.notice_displayed) throw new ValidationError("لا يمكن العرض قبل تأكيد وجود إشعار الخصوصية وسياسة الاستخدام.");
  if (!PLAYABLE.includes(cam.connection_type) || !cam.viewer_url) throw new ValidationError("لا يوجد بروتوكول عرض مدعوم في المتصفح لهذه الكاميرا — راجع دليل الإعداد.");
  await log(id, "viewed", bos.userId);
  return cam;
}

export async function cameraEvents(bos: BosUser, id: string) {
  if (!can(bos, "cameras.read")) throw new ForbiddenError();
  const { data } = await db().from("camera_events").select("*").eq("camera_id", id).order("occurred_at", { ascending: false }).limit(100);
  return data ?? [];
}
