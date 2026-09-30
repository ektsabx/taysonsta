import { getT } from "@/lib/bos/i18n/server";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { NotFoundError } from "@/lib/bos/errors";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getArticleBySlug, getVersion, kindLabels, playbookLabels } from "@/services/bos/knowledge";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, KeyValues, StatusBadge } from "@/components/bos/ui";
import { FileManager } from "@/components/bos/FileManager";
import { renderMarkdown } from "@/lib/bos/markdown";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { ChecklistRunner, MarkReadButton, StatusButtons, StepsEditor } from "../../KnowledgeControls";

export default async function ArticlePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: SearchParams }) {
  const t = await getT();
  const { bos } = await requirePermission("knowledge.read");
  const { slug } = await params;
  const sp = await readParams(searchParams);
  // Entity links use ids; normalise to the slug URL.
  if (/^[0-9a-f-]{36}$/.test(slug)) {
    const { data } = await db().from("kb_articles").select("slug").eq("id", slug).maybeSingle();
    if (data) redirect(`/admin/knowledge/articles/${data.slug}`);
  }
  let a;
  try {
    a = await getArticleBySlug(bos, slug);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const names = await userNameMap();
  const canEdit = a.author_id === bos.userId || bos.permissions.get("knowledge.update") === "all" || !!bos.permissions.get("knowledge.manage");
  const canManage = !!bos.permissions.get("knowledge.manage") || bos.isSuperAdmin;
  const viewVersion = sp.v ? Number(sp.v) : null;
  const old = viewVersion && viewVersion !== a.version ? await getVersion(a.id, viewVersion) : null;
  const steps = a.steps.filter((s) => s.kind === "step");
  const checklist = a.steps.filter((s) => s.kind === "checklist");
  const upToDate = !!a.myRead && a.myRead.version >= a.version;
  const cat = a.kb_categories as unknown as { name: string } | null;
  return (
    <>
      <PageHeader
        title={old ? `${old.title} (v${old.version})` : a.title}
        subtitle={
          <span className="bos-row" style={{ gap: 8, flexWrap: "wrap" }}>
            <StatusBadge tone="neutral" label={kindLabels[a.kind]} />
            {a.playbook_section ? <StatusBadge tone="accent" label={playbookLabels[a.playbook_section]} /> : null}
            <StatusBadge tone={a.status === "published" ? "success" : a.status === "archived" ? "neutral" : "warning"} label={a.status === "published" ? "منشور" : a.status === "archived" ? "مؤرشف" : "مسودة"} />
            {a.allowed_role_ids?.length ? <StatusBadge tone="warning" label="مقيد بأدوار" /> : null}
            <span className="bos-faint"><Tx vars={{ version: a.version, v: formatDate(a.updated_at) }}>{"v{version} · آخر تحديث {v}"}</Tx></span>
          </span>
        }
       
        actions={
          <>
            {a.status === "published" && !old ? (upToDate ? <span className="bos-faint" style={{ fontSize: 12 }}><Tx vars={{ v: a.myRead!.version, v2: formatDate(a.myRead!.read_at) }}>{"✓ قرأت v{v} في {v2}"}</Tx></span> : <MarkReadButton id={a.id} label={a.myRead ? `قرأت الإصدار الجديد v${a.version}` : "تم الاطلاع"} />) : null}
            {canEdit ? <Link className="admin-btn small secondary" href={`/admin/knowledge/articles/${a.slug}/edit`}><Tx>تعديل</Tx></Link> : null}
            {canManage ? <StatusButtons id={a.id} status={a.status} /> : null}
          </>
        }
      />
      {old ? <div className="bos-alert warning"><Tx vars={{ version: old.version }}>{"تعرض إصداراً سابقاً (v{version})."}</Tx> <Link className="bos-link" href={`/admin/knowledge/articles/${a.slug}`}><Tx vars={{ version: a.version }}>{"العودة للإصدار الحالي v{version}"}</Tx></Link></div> : null}
      <div className="bos-grid main-side">
        <div>
          <Card>
            <div className="bos-prose bos-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(old ? old.content : a.content) || `<p class="bos-faint">${t("لا يوجد محتوى بعد.")}</p>` }} />
          </Card>
          {a.kind === "sop" || steps.length || checklist.length ? (
            <>
              {steps.length ? (
                <Card title="الخطوات">
                  <ol className="bos-steps">
                    {steps.map((s) => <li key={s.id}><strong><Tx>{s.title}</Tx></strong>{s.description ? <div className="bos-faint" style={{ fontSize: 12.5 }}><Tx>{s.description}</Tx></div> : null}</li>)}
                  </ol>
                </Card>
              ) : null}
              {checklist.length ? <Card title="قائمة التحقق"><ChecklistRunner items={checklist} /></Card> : null}
              {canEdit ? <Card title="تحرير الخطوات وقائمة التحقق"><StepsEditor articleId={a.id} initial={a.steps.map((s) => ({ kind: s.kind, title: s.title, description: s.description }))} /></Card> : null}
            </>
          ) : null}
        </div>
        <div>
          <Card title="التفاصيل">
            <KeyValues
              items={[
                { label: "التصنيف", value: cat?.name },
                { label: "الوسوم", value: a.tags.length ? a.tags.map((t) => <Link key={t} className="bos-link" style={{ marginInlineEnd: 6 }} href={`/admin/knowledge?tag=${t}`}>#{t}</Link>) : null },
                { label: "الكاتب", value: a.author_id ? names.get(a.author_id) : null },
                { label: "المالك", value: a.owner_id ? names.get(a.owner_id) : null },
                { label: "النشر", value: a.published_at ? formatDate(a.published_at) : null },
                { label: "المستندات المطلوبة", value: a.required_documents },
              ]}
            />
          </Card>
          <Card title="المرفقات"><FileManager entityType="kb_article" entityId={a.id} canUpload={canEdit && can(bos, "files.create")} /></Card>
          <Card title="سجل الإصدارات">
            {a.versions.map((v) => (
              <div key={v.id} style={{ fontSize: 13, marginBottom: 6 }}>
                <Link className="bos-link" href={`/admin/knowledge/articles/${a.slug}${v.version === a.version ? "" : `?v=${v.version}`}`}>v{v.version}</Link> — {v.title}
                <div className="bos-faint" style={{ fontSize: 12 }}>{v.edited_by ? names.get(v.edited_by) ?? "—" : "النظام"} · {formatDateTime(v.created_at)}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
