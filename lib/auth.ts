import { getBosSession, requireBosUser } from "@/lib/bos/auth";

// Legacy helpers kept for the pre-BOS admin pages (careers, booking,
// proposals). They now resolve through the BOS session, so only active
// employees count as staff — proposal/portal clients and suspended or
// archived employees are rejected even with a valid Supabase session.
export async function getAdminUser() {
  const session = await getBosSession();
  return session.status === "ok" ? session.bos.user : null;
}

export async function requireAdminUser() {
  const bos = await requireBosUser();
  return bos.user;
}
