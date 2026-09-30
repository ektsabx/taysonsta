import { NextResponse, type NextRequest } from "next/server";
import { getBosUser } from "@/lib/bos/auth";
import { getDocument } from "@/services/bos/documents";

// Print view of the frozen HTML (browser "Save as PDF" produces the PDF with
// correct Arabic shaping) — docs/bos/30 §8.3.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bos = await getBosUser();
  if (!bos) return NextResponse.redirect(new URL("/admin/login", _request.url));
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  try {
    const d = await getDocument(bos, id);
    const html = d.rendered_html.replace("</body>", '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300))</script></body>');
    return new NextResponse(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
        "x-frame-options": "SAMEORIGIN",
        "content-security-policy": "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'",
      },
    });
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }
}
