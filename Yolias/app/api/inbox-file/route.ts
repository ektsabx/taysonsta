import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

// A file from a conversation: only for members of the workspace it belongs to.
export async function GET(req: NextRequest) {
  const session = await getSession();
  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!session || !path.startsWith(`${session.workspace.id}/`) || path.includes("..")) return new NextResponse(null, { status: 404 });
  const { data } = await createAdminClient().storage.from("inbox-files").createSignedUrl(path, 300);
  return data?.signedUrl ? NextResponse.redirect(data.signedUrl, 302) : new NextResponse(null, { status: 404 });
}
