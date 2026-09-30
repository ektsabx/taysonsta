import { Tx } from "@/components/bos/I18n";
import { listComments } from "@/services/bos/shared";
import { formatDateTime } from "@/lib/bos/format";
import { CommentComposer, DeleteCommentButton } from "@/components/bos/CommentComposer";

export async function Comments({
  entityType,
  entityId,
  viewerId,
  allowClientVisible = false,
}: {
  entityType: string;
  entityId: string;
  viewerId: string;
  allowClientVisible?: boolean;
}) {
  const comments = await listComments(entityType, entityId, viewerId);
  return (
    <div>
      {comments.length === 0 ? <div className="bos-faint" style={{ fontSize: 13, marginBottom: 10 }}><Tx>لا توجد ملاحظات بعد.</Tx></div> : null}
      {comments.map((c) => (
        <div key={c.id} className="bos-comment">
          <div className="bos-comment-head">
            <strong style={{ color: "var(--bos-strong)" }}><Tx>{c.authorName}</Tx></strong>
            <span>{formatDateTime(c.createdAt)}</span>
            {!c.isInternal ? <span className="bos-badge tone-accent plain"><Tx>مرئي للعميل</Tx></span> : null}
            {c.mine ? <DeleteCommentButton commentId={c.id} /> : null}
          </div>
          <div className="bos-comment-body">{c.body}</div>
        </div>
      ))}
      <CommentComposer entityType={entityType} entityId={entityId} allowClientVisible={allowClientVisible} />
    </div>
  );
}
