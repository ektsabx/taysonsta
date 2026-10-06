"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, Copy, LoaderCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { YoliasMark, YoliasThinking } from "@/components/YoliasMark";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { rateReply } from "@/app/(app)/actions";

export interface ThreadTurn {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  rating?: -1 | 1 | null;
}

type AgentError = "notConfigured" | "failed" | "forbidden" | "rateLimited" | "notFound";

interface Props {
  /** The search (sidebar "Recent") whose conversation this is. */
  strategyId: string;
  initial: ThreadTurn[];
  /** The first exchange: the request and Yolias's search card, as list items. */
  lead?: ReactNode;
  /** Plan badge + Upgrade in the composer. */
  plan?: { label: string; canUpgrade: boolean };
}

// Yolias AI conversation, Claude-style (final spec phase 7): one thread per
// search — the request, Yolias's search card, then every follow-up in the
// same thread — with live thinking / tool states while Yolias works, actions
// on each reply (copy, like, dislike, time), and one composer at the bottom.
// Every turn is saved on the server; history is read from there.
export function AgentThread({ strategyId, initial, lead, plan }: Props) {
  const { t, locale } = useI18n();
  const a = t.agent;
  const router = useRouter();
  const [turns, setTurns] = useState<ThreadTurn[]>(initial);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<AgentError | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const tempIds = useRef(0);

  useEffect(() => {
    if (pending || turns.length > initial.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, pending, initial.length]);

  const send = async (value = text.trim()) => {
    if (!value || pending) return;
    setError(null);
    setPending(true);
    setStatus(a.thinkingShort);
    const tempId = -(++tempIds.current);
    setTurns((cur) => [...cur, { id: tempId, role: "user", content: value, created_at: new Date().toISOString() }]);
    setText("");
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ strategyId, text: value }) });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError((["notConfigured", "forbidden", "rateLimited", "notFound"] as string[]).includes(body.error ?? "") ? (body.error as AgentError) : "failed");
        return;
      }
      // NDJSON events: thinking → tool … → done | error.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      while (!finished) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const e = JSON.parse(line) as { type: string; name?: string; error?: string; reply?: ThreadTurn; user?: ThreadTurn };
          if (e.type === "thinking" || e.type === "tool_done") setStatus(a.thinkingShort);
          else if (e.type === "tool") setStatus(a.tools[e.name as keyof typeof a.tools] ?? a.working);
          else if (e.type === "done" && e.reply) {
            const reply = e.reply;
            const user = e.user;
            setTurns((cur) => [...cur.map((x) => (x.id === tempId && user ? user : x)), { ...reply, rating: null }]);
            finished = true;
          } else if (e.type === "error") {
            setError((e.error as AgentError) ?? "failed");
            finished = true;
          }
        }
      }
      // A tool may have started a campaign or changed results: refresh server data.
      router.refresh();
    } catch {
      setError("failed");
    } finally {
      setPending(false);
      setStatus(null);
      inputRef.current?.focus();
    }
  };

  const intl = locale === "ar" ? "ar-u-nu-latn" : "en-US";
  const time = (iso?: string) => (iso ? new Intl.DateTimeFormat(intl, { hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "");
  const fullTime = (iso?: string) => (iso ? new Intl.DateTimeFormat(intl, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "");

  return (
    <section className="agent-thread" aria-label={a.title}>
      {(lead || turns.length > 0) && (
        <ol className="agent-turns">
          {lead}
          {turns.map((m) => (
            <li key={m.id} className={`agent-turn ${m.role}`}>
              {m.role === "assistant" && <YoliasMark size={18} />}
              <div className="agent-turn-body">
                <div className="agent-turn-text" dir="auto"><Rich text={m.content} /></div>
                {m.role === "assistant" ? (
                  <ReplyActions turn={m} time={time(m.created_at)} title={fullTime(m.created_at)} />
                ) : (
                  m.created_at && <time className="turn-time" dateTime={m.created_at} title={fullTime(m.created_at)}>{time(m.created_at)}</time>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {pending && (
        <div className="agent-turn assistant">
          <YoliasThinking label={status ?? a.thinkingShort} />
        </div>
      )}
      {error && <p className="prompt-error" role="alert">{a.errors[error]}</p>}

      <div className="prompt-container agent-composer">
        <textarea
          ref={inputRef}
          className="prompt-input"
          rows={2}
          dir="auto"
          placeholder={turns.length ? a.placeholderMore : a.placeholder}
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="prompt-footer">
          <div className="prompt-attachments">
            {plan && <span className="plan-badge composer-plan">{fmt(a.plan, { plan: plan.label })}</span>}
            {plan?.canUpgrade && <Link className="composer-upgrade" href="/checkout">{a.upgrade}</Link>}
            <span className="artifact-note">{a.hint}</span>
          </div>
          <button className="btn-send" type="button" aria-label={a.send} onClick={() => void send()} disabled={pending || !text.trim()}>
            {pending ? <LoaderCircle className="spin" /> : <ArrowUp />}
          </button>
        </div>
      </div>
      <div ref={endRef} />
    </section>
  );
}

/** Copy, like, dislike and the time of one reply. */
function ReplyActions({ turn, time, title }: { turn: ThreadTurn; time: string; title: string }) {
  const { t } = useI18n();
  const a = t.agent;
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<-1 | 1 | null>(turn.rating ?? null);
  const saved = turn.id > 0;
  const rate = (r: 1 | -1) => {
    const next = rating === r ? null : r;
    setRating(next);
    void rateReply(turn.id, next);
  };
  return (
    <div className="reply-actions">
      <button type="button" aria-label={copied ? a.copied : a.copy} title={copied ? a.copied : a.copy} onClick={() => {
        void navigator.clipboard.writeText(turn.content).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}>{copied ? <Check /> : <Copy />}</button>
      {saved && (
        <>
          <button type="button" aria-label={a.like} title={a.like} aria-pressed={rating === 1} className={rating === 1 ? "on" : ""} onClick={() => rate(1)}><ThumbsUp /></button>
          <button type="button" aria-label={a.dislike} title={a.dislike} aria-pressed={rating === -1} className={rating === -1 ? "on" : ""} onClick={() => rate(-1)}><ThumbsDown /></button>
        </>
      )}
      {time && <time className="turn-time" title={title}>{time}</time>}
    </div>
  );
}

/** Plain text with paragraphs and "-" lists (the agent writes no markdown headings or tables). */
function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{l.replace(/^\s*[-•]\s+/, "")}</li>)}</ul>;
        }
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{l}</Fragment>)}</p>;
      })}
    </>
  );
}
