import { NextResponse, type NextRequest } from "next/server";
import { getBosUser } from "@/lib/bos/auth";
import { documentDocxBytes } from "@/services/bos/documents";
import { audit } from "@/lib/bos/audit";

// Download the frozen DOCX copy (docs/bos/30 §8.3). Same access rules as the
// document page: documents.read + access to the source record.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bos = await getBosUser();
  if (!bos) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  try {
    const { bytes, filename } = await documentDocxBytes(bos, id);
    await audit({ actorId: bos.userId, action: "document.downloaded", entityType: "document", entityId: id, newValue: { format: "docx" } });
    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }
}
