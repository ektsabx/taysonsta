import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/bos/db";
import { getPortalUser, portalDb } from "@/lib/bos/portal-auth";

// Portal file access: the file must be client-visible, finalized and belong
// to an entity of the signed-in client (checked under RLS), then a 60 s
// signed URL is issued.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = await getPortalUser();
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await portalDb();
  const { data: file } = await s.from("files").select("id, name, storage_path, client_visible, is_finalized, deleted_at").eq("id", id).maybeSingle();
  if (!file || !file.client_visible || !file.is_finalized || file.deleted_at) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const download = request.nextUrl.searchParams.get("download") === "1";
  const { data: signed } = await db().storage.from("bos-files").createSignedUrl(file.storage_path, 60, download ? { download: file.name } : undefined);
  if (!signed) return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  await db().from("audit_logs").insert({ actor_user_id: null, actor_type: "client", action: "file.downloaded_by_client", entity_type: "file", entity_id: id, metadata: { contact_id: p.contactId, client_id: p.clientId } });
  return NextResponse.redirect(signed.signedUrl);
}
