import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/bos/db";
import { getSetting } from "@/lib/bos/settings";

// Company logo / icon (public brand assets — used on the login page, portal,
// documents and emails). ?k=logo|icon
export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("k");
  if (kind !== "logo" && kind !== "icon") return new NextResponse(null, { status: 400 });
  const company = await getSetting("company");
  const path = kind === "logo" ? company.logo_path : company.icon_path;
  if (!path) return new NextResponse(null, { status: 404 });
  const { data } = await db().storage.from("bos-files").createSignedUrl(path, 3600);
  if (!data?.signedUrl) return new NextResponse(null, { status: 404 });
  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set("Cache-Control", "public, max-age=600");
  return res;
}
