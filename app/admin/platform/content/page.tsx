import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, EmptyState, StatusBadge, Tabs } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { contentKinds, kindLabel, type ContentKind } from "@/lib/yolias/content";
import { listContent } from "@/services/yolias/content";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";

const statusTone = { draft: { tone: "neutral" as const, label: "مسودة" }, published: { tone: "success" as const, label: "منشورة" }, hidden: { tone: "warning" as const, label: "مخفية" } };

// Yolias website content (final spec phase 9): Help Center, Docs, Blog and
// the legal pages, in both languages.
export default async function ContentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="محتوى الموقع" /><NotConnected /></>);
  const sp = await searchParams;
  const kind: ContentKind = (contentKinds as readonly string[]).includes(sp.kind ?? "") ? (sp.kind as ContentKind) : "help";
  const rows = await listContent(kind);
  const manage = can(bos, "platform.manage", "all");
  const site = (process.env.YOLIAS_SITE_URL ?? "").replace(/\/$/, "");
  const path = (slug: string) => (kind === "help" ? `/help-center/${slug}` : `/${kind}/${slug}`);
  return (
    <>
      <PageHeader title="محتوى الموقع" subtitle="صفحات مركز المساعدة والتوثيق والمدونة والصفحات القانونية لموقع Yolias، باللغتين" actions={manage && kind !== "legal" ? <Link className="admin-btn" href={`/admin/platform/content/new?kind=${kind}`}><Tx>صفحة جديدة</Tx></Link> : undefined} />
      <Tabs tabs={contentKinds.map((k) => ({ key: k, label: kindLabel[k] }))} active={kind} baseHref="/admin/platform/content" param="kind" />
      <Card flush>
        {rows.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>العنوان</Tx></th><th><Tx>الرابط</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>آخر تعديل</Tx></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link className="bos-link" href={`/admin/platform/content/${r.id}`}>{r.doc.ar?.title ?? r.slug}</Link><span className="cell-sub" dir="ltr">{r.doc.en?.title}</span></td>
                  <td dir="ltr">{site ? <a className="bos-link" href={`${site}${path(r.slug)}`} target="_blank" rel="noreferrer">{path(r.slug)}</a> : path(r.slug)}</td>
                  <td><StatusBadge tone={statusTone[r.status].tone} label={statusTone[r.status].label} /></td>
                  <td>{r.updated_by ? `${r.updated_by} · ` : ""}{formatDateTime(r.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد صفحات" description="شغّل npm run content:seed في Yolias لنسخ المحتوى الحالي." />}
      </Card>
    </>
  );
}
