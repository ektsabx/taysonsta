import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { listApplications, listJobs } from "@/services/bos/hr/recruitment";
import { PageHeader } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { KanbanBoard } from "@/components/bos/KanbanBoard";
import { SubNav } from "@/components/bos/SubNav";
import { hrSection } from "@/lib/bos/hr-nav";
import { formatDate } from "@/lib/bos/format";
import { moveApplicationAction } from "../actions";
import { stageLabels } from "../RecruitmentControls";

const columns = ["new", "in_review", "contacted", "interview", "evaluation", "accepted", "offer", "offer_accepted", "hired"];

// Recruitment pipeline (kanban). Offer / accepted / hired move only through
// the offer and hire actions; the server rejects other moves.
export default async function PipelinePage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("recruitment.read");
  const sp = await readParams(searchParams);
  const [apps, jobs] = await Promise.all([listApplications({ job: sp.job, q: sp.q }), listJobs()]);
  const visible = apps.filter((a) => columns.includes(a.status));
  return (
    <>
      <PageHeader title="مسار التوظيف" subtitle={<Tx vars={{ visible_count: visible.length }}>{"{visible_count} طلب نشط"}</Tx>} breadcrumbs={[{ label: "التوظيف", href: "/admin/team/recruitment" }, { label: "المسار" }]} />
      <SubNav items={hrSection(bos, "recruitment")} active="pipeline" label="التوظيف" />
      <FilterBar searchPlaceholder="بحث..." filters={[{ key: "job", label: "الوظيفة", type: "select", options: jobs.map((j) => ({ value: j.id, label: j.title })) }]} />
      <KanbanBoard
        columns={columns.map((c) => ({ key: c, title: stageLabels[c], meta: visible.filter((a) => a.status === c).length }))}
        cards={visible.map((a) => ({
          id: a.id,
          column: a.status,
          content: (
            <div>
              <Link href={`/admin/team/recruitment/applications/${a.id}`} style={{ fontWeight: 700 }}>{a.first_name} {a.last_name}</Link>
              <div className="bos-faint" style={{ fontSize: 12 }}>{(a.career_jobs as { title: string } | null)?.title}</div>
              <div className="bos-faint" style={{ fontSize: 11.5 }}>{a.country} · {a.years_experience} سنة · {formatDate(a.created_at)}{a.rating ? ` · ${"★".repeat(Math.round(Number(a.rating)))}` : ""}</div>
            </div>
          ),
        }))}
        onMove={moveApplicationAction}
      />
    </>
  );
}
