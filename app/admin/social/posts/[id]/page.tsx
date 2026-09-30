import { BosTable } from "@/components/bos/BosTable";
import { notFound } from "next/navigation";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { NotFoundError } from "@/lib/bos/errors";
import { formatDateTime } from "@/lib/bos/format";
import { getPost, listAccounts } from "@/services/bos/social";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { composeText, engagementRate, metricDefs, platforms, type MediaItem, type MetricKey, type Platform } from "@/lib/bos/social/platforms";
import { PageHeader, Card, StatusBadge, KeyValues } from "@/components/bos/ui";
import { PostEditor, type AccountOpt } from "../../PostEditor";
import { ManualMetricsButton, PostWorkflow, TargetControls } from "../../SocialControls";
import { postStatus, targetStatus } from "../../labels";

const EDITABLE = ["draft", "changes_requested", "approved", "scheduled", "failed"];

// One social post: workflow, per-platform targets (status, link, errors,
// retry, manual publish), metrics with source + last sync, editor.
export default async function SocialPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("social.read");
  const { id } = await params;
  let data: Awaited<ReturnType<typeof getPost>>;
  try {
    data = await getPost(bos, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { post, targets } = data;
  const [accounts, staff, names] = await Promise.all([listAccounts({ activeOnly: true }), listActiveStaff(), userNameMap()]);
  const media = post.media as unknown as MediaItem[];
  const canEdit = can(bos, "social.update") && EDITABLE.includes(post.status);
  return (
    <>
      <PageHeader title={`${post.number} · ${post.title}`} />
      <Card title={<span className="bos-row" style={{ gap: 8 }}><Tx>الحالة</Tx><StatusBadge tone={postStatus[post.status]?.tone ?? "neutral"} label={postStatus[post.status]?.label ?? post.status} /></span>}>
        <KeyValues items={[
          { label: "المسؤول", value: post.owner_id ? names.get(post.owner_id) ?? "—" : "—" },
          { label: "الموعد", value: post.scheduled_at ? formatDateTime(post.scheduled_at) : "—" },
          { label: "نُشر", value: post.published_at ? formatDateTime(post.published_at) : "—" },
          { label: "اعتمده", value: post.approved_by ? `${names.get(post.approved_by) ?? "—"} · ${formatDateTime(post.approved_at)}` : "—" },
          { label: "ملاحظات المراجعة", value: post.review_note ?? "—", hidden: !post.review_note },
          { label: "الحملة", value: post.campaign ?? "—", hidden: !post.campaign },
        ]} />
        {can(bos, "social.update") ? <div style={{ marginTop: 10 }}><PostWorkflow id={post.id} status={post.status} canApprove={can(bos, "social.approve")} reviewers={staff.map((s) => ({ value: s.userId, label: s.name }))} /></div> : null}
      </Card>
      <Card title="المنصات" flush>
        <BosTable className="bos-table">
          <thead><tr><th><Tx>المنصة</Tx></th><th><Tx>النص النهائي</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الأرقام</Tx></th><th /></tr></thead>
          <tbody>
            {targets.map((t) => {
              const acc = t.social_accounts as unknown as { platform: Platform; mode: string; name: string; handle: string | null };
              const ms = (t.social_post_metrics ?? []) as unknown as { metric: MetricKey; value: number; source: string; fetched_at: string }[];
              const m = Object.fromEntries(ms.map((x) => [x.metric, Number(x.value)])) as Partial<Record<MetricKey, number>>;
              const er = engagementRate(m);
              const last = ms.reduce<string | null>((a, x) => (!a || x.fetched_at > a ? x.fetched_at : a), null);
              return (
                <tr key={t.id}>
                  <td><strong><Tx>{platforms[acc.platform].label}</Tx></strong><div className="bos-faint" style={{ fontSize: 12 }}>{acc.name}{acc.handle ? ` ${acc.handle}` : ""}</div></td>
                  <td style={{ maxWidth: 340 }}><div style={{ whiteSpace: "pre-wrap", fontSize: 12.5 }} dir="auto">{composeText(post.base_text, t.text_override, post.hashtags).slice(0, 400)}</div></td>
                  <td>
                    <StatusBadge tone={targetStatus[t.status]?.tone ?? "neutral"} label={targetStatus[t.status]?.label ?? t.status} />
                    {t.post_url ? <div><a href={t.post_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}><Tx>فتح المنشور</Tx></a></div> : null}
                    {t.error ? <div className="bos-danger" style={{ fontSize: 11.5 }} title={t.error}>{t.error.slice(0, 120)}</div> : null}
                    {t.next_attempt_at ? <div className="bos-faint" style={{ fontSize: 11 }}><Tx>إعادة محاولة تلقائية:</Tx> {formatDateTime(t.next_attempt_at)}</div> : null}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {ms.length ? (
                      <>
                        {ms.map((x) => <div key={x.metric} title={metricDefs[x.metric]?.definition}><Tx>{metricDefs[x.metric]?.label ?? x.metric}</Tx>: <b className="bos-num">{Number(x.value).toLocaleString("en-US")}</b> <span className="bos-faint">({x.source === "api" ? "API" : <Tx>يدوي</Tx>})</span></div>)}
                        {er != null ? <div><Tx>معدل التفاعل</Tx>: <b>{er}%</b></div> : null}
                        <div className="bos-faint"><Tx>آخر تحديث:</Tx> {formatDateTime(last)}</div>
                      </>
                    ) : t.status === "published" ? <span className="bos-faint"><Tx>غير متاح بعد</Tx></span> : "—"}
                  </td>
                  <td>
                    {can(bos, "social.update") ? <div className="bos-stack" style={{ gap: 6 }}>
                      <TargetControls targetId={t.id} status={t.status} mode={acc.mode} platform={acc.platform} />
                      {t.status === "published" ? <ManualMetricsButton targetId={t.id} current={m as Record<string, number>} /> : null}
                    </div> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </BosTable>
      </Card>
      {media.length ? <Card title="الوسائط"><div className="bos-row" style={{ gap: 8, flexWrap: "wrap" }}>{media.map((m) => m.type === "image" ? <a key={m.url} href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt={m.alt ?? ""} style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8 }} /></a> : <a key={m.url} href={m.url} target="_blank" rel="noreferrer" dir="ltr">{m.url}</a>)}</div></Card> : null}
      {canEdit ? (
        <Card title="تعديل">
          <PostEditor accounts={accounts as AccountOpt[]} initial={{ id: post.id, title: post.title, base_text: post.base_text, hashtags: post.hashtags, media, link_url: post.link_url, scheduled_at: post.scheduled_at, campaign: post.campaign, targets: targets.map((t) => ({ account_id: t.account_id, text_override: t.text_override, locked: !!t.external_post_id })) }} />
        </Card>
      ) : null}
    </>
  );
}
