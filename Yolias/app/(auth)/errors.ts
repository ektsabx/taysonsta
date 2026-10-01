export const authErrors: Record<string, string> = {
  link_invalid: "That sign-in link is invalid or has expired. Request a new one below.",
  account_unavailable: "Your account isn't linked to a workspace. Sign in again, or contact your workspace admin.",
  link_missing: "That sign-in link is incomplete. Request a new one below.",
};

export async function errorFrom(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const sp = await searchParams;
  return typeof sp.error === "string" ? authErrors[sp.error] : undefined;
}
