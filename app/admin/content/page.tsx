import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { listItems, listStages } from "@/services/bos/content";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { SubNav } from "@/components/bos/SubNav";
import { contentNav } from "./content-nav";
import { platformOptions, priorityLabels, typeLabels } from "./labels";

// Content board (docs/bos/30 §13.3): one column per active stage.
export default async function ContentBoardPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("content.read");
  const sp = await readParams(searchParams);
  const [items, stages, staff, names] = await Promise.all([listItems(bos, { owner: sp.owner, platform: sp.platform, type: sp.type, q: sp.q, priority: sp.priority }), listStages(true), listActiveStaff(), userNameMap()]);
  const today = new Date().toISOString().slice(0, 10);
  const showArchived = sp.archived === "1";
  const cols = stages.filter((s) => showArchived || s.key !== "archived");
  return (
    <>
      <PageHeader title="استوديو المحتوى" subtitle="من الفكرة حتى النشر والتحليل" breadcrumbs={[{ label: "التسويق" }, { label: "استوديو المحتوى" }]} actions={can(bos, "content.create") ? <Link className="admin-btn small" href="/admin/content/new"><Tx>+ فكرة</Tx></Link> : null} />
      <SubNav items={contentNav(bos)} active="board" label="استوديو المحتوى" />
      <FilterBar searchPlaceholder="بحث بالعنوان..." filters={[
        { key: "owner", label: "المسؤول", type: "select", options: staff.map((s) => ({ value: s.userId, label: s.name })) },
        { key: "platform", label: "المنصة", type: "select", options: platformOptions },
        { key: "type", label: "النوع", type: "select", options: Object.entries(typeLabels).map(([value, label]) => ({ value, label })) },
        { key: "priority", label: "الأولوية", type: "select", options: Object.entries(priorityLabels).map(([value, label]) => ({ value, label })) },
        { key: "archived", label: "المؤرشف", type: "select", options: [{ value: "1", label: "إظهار" }] },
      ]} />
      {items.length ? (
        <div className="bos-kanban">
          {cols.map((s) => {
            const list = items.filter((i) => i.stage === s.key);
            return (
              <div key={s.key} className="bos-kanban-col">
                <div className="bos-kanban-col-head"><div className="title"><span><Tx>{s.name}</Tx>{s.requires_approval ? " 🔒" : ""}</span><span className="bos-faint">{list.length}</span></div></div>
                <div className="bos-kanban-cards">
                {list.map((i) => {
                  const tasks = (i.content_tasks ?? []) as { done_at: string | null }[];
                  const late = i.deadline && i.deadline < today && !["published", "analyzed", "archived"].includes(i.stage);
                  return (
                    <Link key={i.id} href={`/admin/content/${i.id}`} className="bos-kanban-card" style={{ color: "inherit", textDecoration: "none", cursor: "pointer" }}>
                      <span className="title">{i.title}</span>
                      <div className="bos-faint" style={{ fontSize: 11.5 }}><Tx>{typeLabels[i.content_type] ?? i.content_type}</Tx>{i.owner_id ? ` · ${names.get(i.owner_id) ?? ""}` : ""}</div>
                      <div className="bos-row" style={{ gap: 6, fontSize: 11, marginTop: 4, flexWrap: "wrap" }}>
                        {i.priority !== "normal" ? <span className={`bos-tag${i.priority === "urgent" || i.priority === "high" ? " bos-danger" : ""}`}><Tx>{priorityLabels[i.priority]}</Tx></span> : null}
                        {i.deadline ? <span className={late ? "bos-danger" : "bos-faint"}>⏰ {i.deadline}</span> : null}
                        {tasks.length ? <span className="bos-faint">☑ {tasks.filter((t) => t.done_at).length}/{tasks.length}</span> : null}
                        {i.approved_at ? <span className="bos-faint">✓</span> : null}
                      </div>
                    </Link>
                  );
                })}
                </div>
              </div>
            );
          })}
        </div>
      ) : <Card><EmptyState title="لا يوجد محتوى بعد" description="ابدأ بفكرة، أو استخدم مولّد الأفكار." /></Card>}
    </>
  );
}
