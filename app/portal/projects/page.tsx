import Link from "next/link";
import { requirePortalSection } from "@/lib/bos/portal-auth";
import { portalProjects } from "@/services/bos/portal";
import { formatDate } from "@/lib/bos/format";
import { PBadge, PEmpty, PProgress, PTop } from "../ui";

export default async function PortalProjectsPage() {
  const p = await requirePortalSection("projects");
  const projects = await portalProjects(p);
  return (
    <>
      <PTop title="المشاريع" />
      <div className="portal-card">
        {projects.length ? (
          <table className="portal-table">
            <thead><tr><th>المشروع</th><th>الحالة</th><th>التقدم</th><th>التسليم</th></tr></thead>
            <tbody>
              {projects.map((pr) => (
                <tr key={pr.id}>
                  <td><Link href={`/portal/projects/${pr.id}`}>{pr.name}</Link><div className="portal-muted">{pr.project_number}</div></td>
                  <td><PBadge map="project_status" value={pr.status} /></td>
                  <td style={{ minWidth: 140 }}><PProgress value={pr.progress} /><span className="portal-muted">{pr.progress}%</span></td>
                  <td>{formatDate(pr.completed_at ?? pr.deadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <PEmpty title="لا توجد مشاريع" />}
      </div>
    </>
  );
}
