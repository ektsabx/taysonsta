import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/session";
import { isToken } from "@/lib/team/join";
import { JoinButton } from "./JoinButton";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).auth.join.title} | Yolias` };
}

/** A template with {email}-like slots, the values kept whole and left-to-right (an address never breaks at its hyphen). */
function slots(template: string, values: Record<string, string>) {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = part.match(/^\{(\w+)\}$/)?.[1];
    return key && key in values ? <bdi key={i} dir="ltr" className="join-value">{values[key]}</bdi> : part;
  });
}

// A team invitation (audit, 2026-11-10): the person sees who invited them and
// joins only by accepting here, or by creating their account from here.
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getDictionary();
  const j = t.auth.join;
  const admin = createAdminClient();
  const { data: inv } = isToken(token)
    ? await admin.from("workspace_invitations").select("email, role, accepted_at, workspace_id, invited_by").eq("token", token).maybeSingle()
    : { data: null };
  const session = await getSession();

  if (!inv) {
    return (<><h1>{j.invalidTitle}</h1><p className="auth-lead">{j.invalid}</p><Link className="btn-primary auth-submit" href={session ? "/dashboard" : "/login"}>{session ? j.open : j.signIn}</Link></>);
  }
  const [{ data: ws }, { data: by }] = await Promise.all([
    admin.from("workspaces").select("name").eq("id", inv.workspace_id).maybeSingle(),
    inv.invited_by ? admin.from("profiles").select("full_name, email").eq("id", inv.invited_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const inviter = by?.full_name || by?.email || "Yolias";
  const workspace = ws?.name || inviter;
  const role = t.settings.team.roles[inv.role as keyof typeof t.settings.team.roles] ?? inv.role;

  if (inv.accepted_at) {
    const inTeam = session?.workspace.id === inv.workspace_id;
    return (<><h1>{inTeam ? fmt(j.inTitle, { workspace }) : j.invalidTitle}</h1><p className="auth-lead">{inTeam ? fmt(j.in, { role }) : j.used}</p><Link className="btn-primary auth-submit" href={session ? "/dashboard" : "/login"}>{session ? j.open : j.signIn}</Link></>);
  }

  const lead = fmt(j.lead, { inviter, workspace, role });
  if (!session) {
    return (
      <>
        <h1>{fmt(j.heading, { workspace })}</h1>
        <p className="auth-lead">{lead} {slots(j.forEmail, { email: inv.email })}</p>
        <a className="btn-primary auth-submit" style={{ justifyContent: "center" }} href={`/join/${token}/start?to=signup`}>{j.create}</a>
        <p className="auth-alt">{j.haveAccount} <a href={`/join/${token}/start?to=login`}>{j.signIn}</a></p>
      </>
    );
  }
  if (session.email.toLowerCase() !== inv.email.toLowerCase()) {
    return (
      <>
        <h1>{fmt(j.heading, { workspace })}</h1>
        <p className="auth-lead">{slots(j.wrongEmail, { email: inv.email, current: session.email })}</p>
        <a className="btn-primary auth-submit" href="/auth/signout">{j.switchAccount}</a>
      </>
    );
  }
  return (
    <>
      <h1>{fmt(j.heading, { workspace })}</h1>
      <p className="auth-lead">{lead}</p>
      <JoinButton token={token} label={j.accept} errors={j.errors} />
    </>
  );
}
