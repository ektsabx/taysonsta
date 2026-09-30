import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/bos/db";
import { getBosSession } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { audit } from "@/lib/bos/audit";

// Secure file access (§75): the bucket is private; after a permission check
// we redirect to a 60-second signed URL. Portal users use /portal/files/[id].
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getBosSession();
  if (session.status !== "ok") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const bos = session.bos;

  const { data: file } = await db().from("files").select("*").eq("id", id).maybeSingle();
  if (!file || file.deleted_at || !file.is_finalized) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let allowed = file.uploaded_by === bos.userId || bos.isSuperAdmin;
  if (!allowed && file.entity_type && file.entity_id) {
    allowed = await canAccessEntity(bos, file.entity_type, file.entity_id);
  }
  if (!allowed) {
    const { data: roles } = await db().from("user_roles").select("role_id").eq("user_id", bos.userId);
    const roleIds = (roles ?? []).map((r) => r.role_id);
    const { data: shares } = await db().from("file_shares").select("shared_with_user_id, shared_with_role_id").eq("file_id", id);
    allowed = (shares ?? []).some((s) => s.shared_with_user_id === bos.userId || (s.shared_with_role_id && roleIds.includes(s.shared_with_role_id)));
  }
  if (!allowed && file.is_template && bos.permissions.has("files.read")) {
    allowed = true;
  }
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const download = request.nextUrl.searchParams.get("download") === "1";
  const { data: signed, error } = await db()
    .storage.from("bos-files")
    .createSignedUrl(file.storage_path, 60, download ? { download: file.name } : undefined);
  if (error || !signed) {
    return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  }

  if (download) {
    await audit({ actorId: bos.userId, action: "file.downloaded", entityType: "file", entityId: file.id, metadata: { name: file.name } });
  }
  return NextResponse.redirect(signed.signedUrl, 302);
}
