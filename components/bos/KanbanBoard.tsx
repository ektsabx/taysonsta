"use client";

import { useT, Tx } from "@/components/bos/I18n";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/bos/action";

export interface KanbanColumn {
  key: string;
  title: string;
  meta?: ReactNode;
}

export interface KanbanCard {
  id: string;
  column: string;
  content: ReactNode;
}

// Drag-and-drop board used by lead/deal pipelines, tasks, bugs (§98).
// Moves are optimistic; the server action is the source of truth and can
// reject a move (e.g. invalid transition, Won needs a dialog).
export function KanbanBoard({
  columns,
  cards,
  onMove,
  interceptMove,
}: {
  columns: KanbanColumn[];
  cards: KanbanCard[];
  onMove: (id: string, toColumn: string) => Promise<ActionState>;
  interceptMove?: Record<string, string>;
}) {
  const t = useT();
  const [items, setItems] = useState(cards);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const [prevCards, setPrevCards] = useState(cards);
  if (cards !== prevCards) {
    setPrevCards(cards);
    setItems(cards);
  }

  function move(id: string, to: string) {
    const card = items.find((c) => c.id === id);
    if (!card || card.column === to) return;
    if (interceptMove?.[to]) {
      router.push(interceptMove[to].replace("{id}", id));
      return;
    }
    const previous = items;
    setItems((list) => list.map((c) => (c.id === id ? { ...c, column: to } : c)));
    startTransition(async () => {
      const result = await onMove(id, to);
      if (!result.ok) {
        setItems(previous);
        setError(result.error);
      } else {
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <>
      {error ? (
        <div className="bos-form-error" role="alert" style={{ marginBottom: 10 }}>
          <Tx>{error}</Tx>
        </div>
      ) : null}
      <div className="bos-kanban">
        {columns.map((col) => {
          const colCards = items.filter((c) => c.column === col.key);
          return (
            <div
              key={col.key}
              className={`bos-kanban-col${over === col.key ? " drag-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/plain") || dragId;
                if (id) move(id, col.key);
              }}
            >
              <div className="bos-kanban-col-head">
                <div className="title">
                  <span><Tx>{col.title}</Tx></span>
                  <span className="bos-faint">{colCards.length}</span>
                </div>
                {col.meta ? <div className="meta"><Tx>{col.meta}</Tx></div> : null}
              </div>
              <div className="bos-kanban-cards">
                {colCards.map((card) => (
                  <div
                    key={card.id}
                    className={`bos-kanban-card${dragId === card.id ? " dragging" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", card.id);
                      setDragId(card.id);
                    }}
                    onDragEnd={() => setDragId(null)}
                  >
                    {card.content}
                    <select
                      aria-label={t("نقل إلى")}
                      value={card.column}
                      onChange={(e) => move(card.id, e.target.value)}
                      style={{ marginTop: 6, width: "100%", background: "var(--bos-input)", color: "rgba(var(--bos-fg-rgb), 0.7)", border: "1px solid rgba(var(--bos-fg-rgb), 0.1)", borderRadius: 5, fontSize: 11.5, height: 26 }}
                    >
                      {columns.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
