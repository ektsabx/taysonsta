import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Ends a session that has no usable workspace (e.g. a broken invitation), so
// the user lands on /login instead of bouncing between /login and /.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login?error=account_unavailable", request.url));
}
