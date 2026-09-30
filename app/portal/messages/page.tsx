import Link from "next/link";
import { requirePortalSection } from "@/lib/bos/portal-auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { portalMessages, portalProjects } from "@/services/bos/portal";
import { formatDateTime } from "@/lib/bos/format";
import { PEmpty, PTop } from "../ui";
import { MessageBox } from "../PortalControls";

export default async function PortalMessagesPage({ searchParams }: { searchParams: SearchParams }) {
  const p = await requirePortalSection("messages");
  const sp = await readParams(searchParams);
  const projects = (await portalProjects(p)).filter((x) => x.status !== "cancelled");
  const current = projects.find((x) => x.id === sp.project) ?? projects[0];
  const thread = current ? await portalMessages(p, current.id) : null;
  return (
    <>
      <PTop title="الرسائل" />
      {projects.length > 1 ? (
        <div className="portal-card" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {projects.map((pr) => <Link key={pr.id} href={`/portal/messages?project=${pr.id}`} className={`portal-btn ${pr.id === current?.id ? "" : "secondary"}`}>{pr.name}</Link>)}
        </div>
      ) : null}
      {current && thread ? (
        <div className="portal-card">
          <h2>{current.name}</h2>
          <div style={{ maxHeight: "55vh", overflowY: "auto", marginBottom: 12 }}>
            {thread.messages.length ? thread.messages.map((m) => (
              <div key={m.id} className={`portal-msg${m.mine ? " mine" : ""}`}>
                <div className="meta">{m.author} · {formatDateTime(m.created_at)}</div>
                <div className="bubble">{m.body}</div>
              </div>
            )) : <PEmpty title="ابدأ المحادثة مع فريق المشروع" />}
          </div>
          <MessageBox projectId={current.id} />
        </div>
      ) : <div className="portal-card"><PEmpty title="لا توجد مشاريع للمراسلة" /></div>}
    </>
  );
}
