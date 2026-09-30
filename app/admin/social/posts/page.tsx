import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { formatDateTime } from "@/lib/bos/format";
import { userNameMap } from "@/services/bos/shared";
import { platforms, type Platform } from "@/lib/bos/social/platforms";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { SubNav } from "@/components/bos/SubNav";
import { socialNav } from "../social-nav";
import { postStatus } from "../labels";

// Social posts list (docs/bos/30 §12.2–12.3).
export default async function SocialPostsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("social.read");
  const sp = await readParams(searchParams);
  let q = db().from("social_posts").select("id, number, title, status, scheduled_at, published_at, owner_id, created_at, social_post_targets(status, social_accounts(platform))").order("created_at", { ascending: false }).limit(200);
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.q) q = q.ilike("title", `%${sp.q.replace(/[%_]/g, "")}%`);
  if (bos.permissions.get("social.read") !== "all") q = q.eq("owner_id", bos.userId);
  const [{ data: posts }, names] = await Promise.all([q, userNameMap()]);
  return (
    <>
      <PageHeader title="المنشورات" breadcrumbs={[{ label: "التسويق" }, { label: "المنشورات" }]} actions={can(bos, "social.create") ? <Link className="admin-btn small" href="/admin/social/posts/new"><Tx>+ منشور</Tx></Link> : null} />
      <SubNav items={socialNav(bos)} active="posts" label="التواصل الاجتماعي" />
      <FilterBar searchPlaceholder="بحث بالعنوان..." filters={[{ key: "status", label: "الحالة", type: "select", options: Object.entries(postStatus).map(([value, s]) => ({ value, label: s.label })) }]} />
      <Card flush>
        {posts?.length ? (
          <table className="bos-table">
            <thead><tr><th>#</th><th><Tx>العنوان</Tx></th><th><Tx>المنصات</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الموعد / النشر</Tx></th><th><Tx>المسؤول</Tx></th></tr></thead>
            <tbody>
              {posts.map((p) => {
                const ts = (p.social_post_targets ?? []) as unknown as { status: string; social_accounts: { platform: Platform } }[];
                return (
                  <tr key={p.id}>
                    <td className="bos-nowrap"><Link href={`/admin/social/posts/${p.id}`}>{p.number}</Link></td>
                    <td><Link href={`/admin/social/posts/${p.id}`}>{p.title}</Link></td>
                    <td>{[...new Set(ts.map((t) => t.social_accounts.platform))].map((pl) => <span key={pl} className="bos-tag" style={{ marginInlineEnd: 4 }}><Tx>{platforms[pl].label}</Tx></span>)}</td>
                    <td><StatusBadge tone={postStatus[p.status]?.tone ?? "neutral"} label={postStatus[p.status]?.label ?? p.status} /></td>
                    <td className="bos-nowrap">{p.published_at ? formatDateTime(p.published_at) : p.scheduled_at ? formatDateTime(p.scheduled_at) : "—"}</td>
                    <td>{p.owner_id ? names.get(p.owner_id) ?? "—" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد منشورات" />}
      </Card>
    </>
  );
}
