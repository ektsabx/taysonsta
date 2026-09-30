import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { listTimeline } from "@/services/bos/shared";
import { formatDateTime, formatDate } from "@/lib/bos/format";
import { entityHref, entityTypeLabels } from "@/lib/bos/links";
import { EmptyState, UserAvatar } from "@/components/bos/ui";

// Global activity timeline for any entity (§65): human, system and automated
// events, status changes, comments, files and approvals — all recorded as
// activity_events linked to this entity.
export async function ActivityTimeline({
  entityType,
  entityId,
  limit = 60,
  moreHref,
}: {
  entityType: string;
  entityId: string;
  limit?: number;
  moreHref?: string;
}) {
  const { items, hasMore } = await listTimeline(entityType, entityId, limit);

  if (!items.length) {
    return <EmptyState title="لا توجد أحداث بعد" description="كل إجراء على هذا السجل سيظهر هنا تلقائياً." />;
  }

  const days = items.map((item) => formatDate(item.occurredAt));
  return (
    <div>
      <ol className="bos-timeline">
        {items.map((item, i) => {
          const day = days[i];
          const showDay = i === 0 || day !== days[i - 1];
          const fromOther = item.entityType !== entityType || item.entityId !== entityId;
          const otherHref = fromOther ? entityHref(item.entityType, item.entityId) : null;
          return (
            <li key={item.id} className={`kind-${item.actorType}`}>
              {showDay ? <div className="bos-timeline-date"><Tx>{day}</Tx></div> : null}
              <div className="bos-timeline-summary">{item.summary}</div>
              <div className="bos-timeline-meta">
                <span>{formatDateTime(item.occurredAt)}</span>
                <span>
                  {item.actorType === "automation"
                    ? "أتمتة"
                    : item.actorType === "system"
                      ? "النظام"
                      : item.actorType === "client"
                        ? "العميل"
                        : <span className="bos-row" style={{ gap: 4, display: "inline-flex" }}>{item.actorId ? <UserAvatar name={item.actorName} userId={item.actorId} /> : null}{item.actorName ?? "—"}</span>}
                </span>
                {otherHref ? (
                  <Link href={otherHref} className="bos-link-muted">
                    <Tx>{entityTypeLabels[item.entityType] ?? item.entityType}</Tx>
                  </Link>
                ) : null}
                <span className="bos-faint"><Tx>{item.type}</Tx></span>
              </div>
            </li>
          );
        })}
      </ol>
      {hasMore && moreHref ? (
        <Link href={moreHref} className="admin-btn small ghost">
          <Tx>عرض المزيد</Tx>
        </Link>
      ) : null}
    </div>
  );
}
