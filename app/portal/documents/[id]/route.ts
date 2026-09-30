import { NextResponse, type NextRequest } from "next/server";
import { getPortalUser } from "@/lib/bos/portal-auth";
import { portalDocumentBytes } from "@/services/bos/portal-extra";

// Download an issued document shared with the client (sent or signed only).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const p = await getPortalUser();
  if (!p) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const { bytes, filename } = await portalDocumentBytes(p, id);
    return new NextResponse(bytes as unknown as BodyInit, { headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
