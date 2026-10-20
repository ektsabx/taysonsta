"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { STAGES } from "@/lib/automations/schema";
import { setStage } from "@/app/(app)/crm/actions";
import { StageSelect, useRun } from "./bits";
import { money, shortDate } from "./format";
import type { LeadStage } from "@/types/database";

export interface KanbanLead { id: string; name: string; company: string | null; stage: LeadStage; value: number | null; currency: string; nextMeeting: string | null; followUp: string | null; owner: string | null }

// Kanban by sales stage (D-195). Drag a card to another column, or use the
// stage menu on the card (keyboard and touch). Same data as the table.
export function CrmKanban({ leads, timeZone }: { leads: KanbanLead[]; timeZone: string | null }) {
  const { t, locale } = useI18n();
  const { run } = useRun();
  const [items, setItems] = useState(leads);
  const [over, setOver] = useState<LeadStage | null>(null);
  // Fresh server data replaces the optimistic copy.
  const [source, setSource] = useState(leads);
  if (source !== leads) { setSource(leads); setItems(leads); }

  const move = (id: string, stage: LeadStage) => {
    const lead = items.find((l) => l.id === id);
    if (!lead || lead.stage === stage) return;
    setItems((all) => all.map((l) => (l.id === id ? { ...l, stage } : l)));
    run(() => setStage(id, stage), { success: t.ws.crm.stageChanged });
  };

  return (
    <div className="kanban">
      {STAGES.map((stage) => {
        const col = items.filter((l) => l.stage === stage);
        const totals = col.reduce<Record<string, number>>((acc, l) => { if (l.value != null) acc[l.currency] = (acc[l.currency] ?? 0) + Number(l.value); return acc; }, {});
        return (
          <section
            key={stage}
            className={`kanban-col${over === stage ? " drop" : ""}`}
            aria-label={t.ws.stages[stage]}
            onDragOver={(e) => { e.preventDefault(); setOver(stage); }}
            onDragLeave={() => setOver((s) => (s === stage ? null : s))}
            onDrop={(e) => { e.preventDefault(); setOver(null); move(e.dataTransfer.getData("text/plain"), stage); }}
          >
            <header className="kanban-head">
              <strong className={`stage-${stage}`}>{t.ws.stages[stage]} · {col.length}</strong>
              <span dir="ltr">{Object.entries(totals).map(([cur, v]) => money(v, cur, locale)).join(" + ")}</span>
            </header>
            <div className="kanban-cards">
              {!col.length && <div className="kanban-empty">-</div>}
              {col.map((l) => (
                <article key={l.id} className="kanban-card" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}>
                  <Link href={`/crm/${l.id}`}>{l.name}</Link>
                  {l.company && l.company !== l.name && <span className="cell-sub">{l.company}</span>}
                  <div className="kanban-card-foot">
                    <span dir="ltr">{money(l.value, l.currency, locale)}</span>
                    {(l.nextMeeting || l.followUp) && <span><CalendarClock size={12} /> {shortDate(l.nextMeeting ?? l.followUp, locale, timeZone)}</span>}
                  </div>
                  {l.owner && <span className="cell-sub">{l.owner}</span>}
                  <StageSelect leadId={l.id} stage={l.stage} label={t.ws.crm.moveTo} />
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
