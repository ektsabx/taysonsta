"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, LoaderCircle } from "lucide-react";
import { YoliasMark, YoliasThinking } from "@/components/YoliasMark";
import { useI18n } from "@/lib/i18n/client";

export interface ThreadTurn {
  id: number;
  role: "user" | "assistant";
  content: string;
}

type AgentError = "notConfigured" | "failed" | "forbidden" | "rateLimited";

// The saved Yolias AI conversation of one search (D-115), under its result
// card. Each turn is saved on the server; history is read from there.
export function AgentThread({ strategyId, initial }: { strategyId: string; initial: ThreadTurn[] }) {
  const { t } = useI18n();
  const a = t.agent;
  const router = useRouter();
  const [turns, setTurns] = useState<ThreadTurn[]>(initial);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AgentError | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pending || turns.length > initial.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, pending, initial.length]);

  const send = async () => {
    const value = text.trim();
    if (!value || pending) return;
    setError(null);
    setPending(true);
    setTurns((cur) => [...cur, { id: -Date.now(), role: "user", content: value }]);
    setText("");
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ strategyId, text: value }) });
      const body = (await res.json().catch(() => ({}))) as { reply?: ThreadTurn; error?: string };
      if (!res.ok || !body.reply) {
        setError(body.error === "notConfigured" || body.error === "forbidden" || body.error === "rateLimited" ? body.error : "failed");
        return;
      }
      setTurns((cur) => [...cur, body.reply!]);
      // A tool may have started a campaign or changed results: refresh server data.
      router.refresh();
    } catch {
      setError("failed");
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <section className="agent-thread" aria-label={a.title}>
      {turns.length > 0 && (
        <ol className="agent-turns">
          {turns.map((m) => (
            <li key={m.id} className={`agent-turn ${m.role}`}>
              {m.role === "assistant" && <YoliasMark size={18} />}
              <div className="agent-turn-text" dir="auto">{m.content}</div>
            </li>
          ))}
        </ol>
      )}
      {pending && <div className="agent-turn assistant"><YoliasThinking label={a.thinking} /></div>}
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
