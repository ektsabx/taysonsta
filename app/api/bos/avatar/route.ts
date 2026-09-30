import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/bos/db";
import { getBosSession } from "@/lib/bos/auth";
import { initials } from "@/lib/bos/format";

// Employee photo (docs/bos/28 §30). Any signed-in staff member may see
// colleagues' photos (they appear across the admin). `?u=<userId>` or
// `?e=<employeeId>`. With a photo → short-lived signed URL; without → an
// initials avatar drawn in the BOS palette (never a random picture).
const UUID = /^[0-9a-f-]{36}$/i;

function initialsSvg(name: string) {
  const text = initials(name).replace(/[<>&"']/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#262626"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Tahoma,sans-serif" font-size="36" font-weight="800" fill="#ffffff">${text}</text></svg>`;
}

export async function GET(request: NextRequest) {
  const session = await getBosSession();
  if (session.status !== "ok") return new NextResponse(null, { status: 401 });

  const u = request.nextUrl.searchParams.get("u");
  const e = request.nextUrl.searchParams.get("e");
  if ((!u || !UUID.test(u)) && (!e || !UUID.test(e))) return new NextResponse(null, { status: 400 });

  const query = db().from("employees").select("full_name, photo_path");
  const { data } = await (e && UUID.test(e) ? query.eq("id", e) : query.eq("user_id", u as string)).maybeSingle();

  if (data?.photo_path) {
    const { data: signed } = await db().storage.from("bos-files").createSignedUrl(data.photo_path, 600);
    if (signed?.signedUrl) {
      const res = NextResponse.redirect(signed.signedUrl, 302);
      res.headers.set("Cache-Control", "private, max-age=300");
      return res;
    }
  }
  return new NextResponse(initialsSvg(data?.full_name ?? "?"), {
    status: 200,
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "private, max-age=300" },
  });
}
