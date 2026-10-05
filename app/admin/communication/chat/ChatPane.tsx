"use client";

import { Tx, useT } from "@/components/bos/I18n";
import { nowMs } from "@/lib/bos/clock";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUploadAction, finalizeUploadAction } from "@/app/admin/_actions/common";
import { createClient } from "@/lib/supabase/client";
import { deleteMessageAction, editMessageAction, fetchMessagesAction, markChannelReadAction, postMessageAction } from "./actions";

type Msg = Awaited<ReturnType<typeof fetchMessagesAction>>[number];
type Person = { id: string; name: string };

const linkRoutes: Record<string, (id: string) => string> = {
  client: (id) => `/admin/clients/${id}`,
  deal: (id) => `/admin/sales/deals/${id}`,
  lead: (id) => `/admin/sales/leads/${id}`,
};
const linkLabels: Record<string, string> = { client: "حساب", deal: "صفقة", lead: "عميل محتمل" };

function time(iso: string) {
  const d = new Date(iso);
  const today = new Date(nowMs());
  const hm = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === today.toDateString() ? hm : `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${hm}`;
}

function renderBody(body: string, people: Person[]) {
  // Highlight @mentions of known people.
  const names = people.map((p) => p.name).sort((a, b) => b.length - a.length);
  if (!names.length || !body.includes("@")) return body;
  const parts: React.ReactNode[] = [];
  let rest = body;
  let key = 0;
  while (rest.length) {
    const i = rest.indexOf("@");
    if (i < 0) {
      parts.push(rest);
      break;
    }
    parts.push(rest.slice(0, i));
    const after = rest.slice(i + 1);
    const hit = names.find((n) => after.toLowerCase().startsWith(n.toLowerCase())) ?? names.map((n) => n.split(" ")[0]).find((f) => after.toLowerCase().startsWith(f.toLowerCase()));
    if (hit) {
      parts.push(<span key={key++} className="bos-mention">@{after.slice(0, hit.length)}</span>);
      rest = after.slice(hit.length);
    } else {
      parts.push("@");
      rest = after;
    }
  }
  return parts;
}

function MessageItem({ m, people, meId, onReply, canReply, refresh }: { m: Msg; people: Person[]; meId: string; onReply?: (id: string) => void; canReply: boolean; refresh: () => void }) {
  const author = people.find((p) => p.id === m.author_user_id)?.name ?? (m.author_contact_id ? "العميل" : "النظام");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.body);
  const [pending, start] = useTransition();
  if (m.is_system) return <div className="bos-msg system"><span>{m.body}</span><time>{time(m.created_at)}</time></div>;
  return (
    <div className={`bos-msg${m.author_user_id === meId ? " mine" : ""}`}>
      <div className="bos-msg-head">
        <strong><Tx>{author}</Tx></strong>
        <time>{time(m.created_at)}</time>
        {m.edited_at && !m.deleted_at ? <span className="bos-faint"><Tx>(معدّلة)</Tx></span> : null}
      </div>
      {m.deleted_at ? (
        <div className="bos-msg-body bos-faint"><Tx>تم حذف هذه الرسالة</Tx></div>
      ) : editing ? (
        <div className="bos-row" style={{ gap: 6 }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} style={{ flex: 1 }} />
          <button type="button" className="admin-btn small" disabled={pending} onClick={() => start(async () => { const r = await editMessageAction(m.id, text); if (r.ok) { setEditing(false); refresh(); } else alert(r.error); })}><Tx>حفظ</Tx></button>
          <button type="button" className="admin-btn small ghost" onClick={() => setEditing(false)}><Tx>إلغاء</Tx></button>
        </div>
      ) : (
        <div className="bos-msg-body">{renderBody(m.body, people)}</div>
      )}
      {m.linked_entity_type && m.linked_entity_id && linkRoutes[m.linked_entity_type] ? (
        <Link className="bos-chip" href={linkRoutes[m.linked_entity_type](m.linked_entity_id)}>{linkLabels[m.linked_entity_type]} ↗</Link>
      ) : null}
      {m.files.length ? (
        <div className="bos-row" style={{ gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          {m.files.map((f) => <a key={f.id} className="bos-chip" href={`/api/bos/files/${f.id}`} target="_blank" rel="noreferrer">📎 {f.name}</a>)}
        </div>
      ) : null}
      {!m.deleted_at ? (
        <div className="bos-msg-actions">
          {canReply && onReply ? <button type="button" onClick={() => onReply(m.id)}>{m.replyCount ? `${m.replyCount} ردود` : "رد"}</button> : null}
          {m.author_user_id === meId ? <button type="button" onClick={() => setEditing(true)}><Tx>تعديل</Tx></button> : null}
          {m.author_user_id === meId ? <button type="button" onClick={() => { if (confirm("حذف الرسالة؟")) start(async () => { await deleteMessageAction(m.id); refresh(); }); }}><Tx>حذف</Tx></button> : null}
        </div>
      ) : null}
    </div>
  );
}

function Composer({ channelId, parentId, people, onSent, canPost }: { channelId: string; parentId: string | null; people: Person[]; onSent: () => void; canPost: boolean }) {
  const t = useT();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [mentionQ, setMentionQ] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const suggestions = mentionQ !== null ? people.filter((p) => p.name.toLowerCase().includes(mentionQ.toLowerCase())).slice(0, 6) : [];

  const onChange = (v: string) => {
    setText(v);
    const caret = ref.current?.selectionStart ?? v.length;
    const m = v.slice(0, caret).match(/@([\p{L}\p{N} ]{0,30})$/u);
    setMentionQ(m ? m[1] : null);
  };
  const pick = (p: Person) => {
    const caret = ref.current?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([\p{L}\p{N} ]{0,30})$/u, `@${p.name} `);
    setText(before + text.slice(caret));
    setMentionQ(null);
    ref.current?.focus();
  };
  const send = () => {
    const body = text.trim() || (files.length ? files.map((f) => f.name).join("، ") : "");
    if (!body) return;
    setError(null);
    start(async () => {
      const r = await postMessageAction(channelId, body, parentId);
      if (!r.ok) return setError(r.error);
      const messageId = r.data?.id;
      if (messageId && files.length) {
        const supabase = createClient();
        for (const f of files) {
          const started = await createUploadAction({ entityType: "message", entityId: messageId, name: f.name, size: f.size, mime: f.type || undefined });
          if (!started.ok || !started.data) { setError(started.ok ? "تعذر الرفع" : started.error); continue; }
          const { error: upErr } = await supabase.storage.from("bos-files").uploadToSignedUrl(started.data.path, started.data.token, f);
          if (upErr) { setError(upErr.message); continue; }
          await finalizeUploadAction(started.data.fileId);
        }
      }
      setText("");
      setFiles([]);
      onSent();
    });
  };
  if (!canPost) return <div className="bos-faint" style={{ padding: 10, fontSize: 13 }}><Tx>لا يمكنك الإرسال في هذه القناة.</Tx></div>;
  return (
    <div className="bos-composer">
      {suggestions.length ? (
        <div className="bos-mention-list">
          {suggestions.map((p) => <button key={p.id} type="button" onMouseDown={(e) => { e.preventDefault(); pick(p); }}>{p.name}</button>)}
        </div>
      ) : null}
      {files.length ? <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>{files.map((f, i) => <span key={i} className="bos-chip">📎 {f.name} <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="إزالة">×</button></span>)}</div> : null}
      <div className="bos-row" style={{ gap: 6, alignItems: "flex-end" }}>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !suggestions.length) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={parentId ? "اكتب رداً..." : "اكتب رسالة... (@ للإشارة، Shift+Enter لسطر جديد)"}
          rows={2}
          maxLength={10000}
          style={{ flex: 1 }}
          aria-label="الرسالة"
        />
        <label className="admin-btn small ghost" style={{ cursor: "pointer" }} title={t("إرفاق ملف")}>
          📎
          <input type="file" multiple hidden onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])} />
        </label>
        <button type="button" className="admin-btn small" onClick={send} disabled={pending} aria-busy={pending}><Tx>إرسال</Tx></button>
      </div>
      {error ? <div className="bos-form-error"><Tx>{error}</Tx></div> : null}
    </div>
  );
}

// Message pane with 10s polling while visible (docs/bos/14), load-older,
// single-level threads and read tracking.
export function ChatPane({ channelId, initial, people, meId, canPost, threadId }: { channelId: string; initial: Msg[]; people: Person[]; meId: string; canPost: boolean; threadId: string | null }) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [thread, setThread] = useState<string | null>(threadId);
  const [threadMsgs, setThreadMsgs] = useState<Msg[]>([]);
  const [hasOlder, setHasOlder] = useState(initial.length >= 100);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [, start] = useTransition();

  const refresh = useCallback(() => {
    start(async () => {
      const fresh = await fetchMessagesAction(channelId, {});
      setMessages((prev) => {
        const older = prev.filter((m) => fresh.length && m.created_at < fresh[0].created_at);
        return [...older, ...fresh];
      });
      if (thread) setThreadMsgs(await fetchMessagesAction(channelId, { parentId: thread }));
      await markChannelReadAction(channelId);
    });
  }, [channelId, thread]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    markChannelReadAction(channelId).then(() => router.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 10_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!thread) return;
    start(async () => setThreadMsgs(await fetchMessagesAction(channelId, { parentId: thread })));
  }, [thread, channelId]);

  const loadOlder = () =>
    start(async () => {
      const older = await fetchMessagesAction(channelId, { before: messages[0]?.created_at });
      setHasOlder(older.length >= 50);
      setMessages((prev) => [...older, ...prev]);
    });

  const root = thread ? messages.find((m) => m.id === thread) : null;
  return (
    <div className={`bos-chat-pane${thread ? " with-thread" : ""}`}>
      <div className="bos-chat-main">
        <div className="bos-msg-list" ref={listRef}>
          {hasOlder ? <button type="button" className="admin-btn small ghost" style={{ alignSelf: "center" }} onClick={loadOlder}><Tx>تحميل الأقدم</Tx></button> : null}
          {messages.length ? messages.map((m) => <MessageItem key={m.id} m={m} people={people} meId={meId} onReply={setThread} canReply refresh={refresh} />) : <div className="bos-faint" style={{ textAlign: "center", padding: 30 }}><Tx>لا توجد رسائل بعد. ابدأ المحادثة.</Tx></div>}
        </div>
        <Composer channelId={channelId} parentId={null} people={people} canPost={canPost} onSent={() => { refresh(); setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 300); }} />
      </div>
      {thread ? (
        <aside className="bos-thread">
          <div className="bos-row" style={{ justifyContent: "space-between" }}>
            <strong><Tx>الردود</Tx></strong>
            <button type="button" className="admin-btn small ghost" onClick={() => setThread(null)}><Tx>إغلاق</Tx></button>
          </div>
          {root ? <MessageItem m={root} people={people} meId={meId} canReply={false} refresh={refresh} /> : null}
          <div className="bos-msg-list" style={{ flex: 1 }}>
            {threadMsgs.map((m) => <MessageItem key={m.id} m={m} people={people} meId={meId} canReply={false} refresh={refresh} />)}
          </div>
          <Composer channelId={channelId} parentId={thread} people={people} canPost={canPost} onSent={refresh} />
        </aside>
      ) : null}
    </div>
  );
}
