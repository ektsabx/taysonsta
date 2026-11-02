"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { createPixelAction } from "@/app/(app)/events/actions";

// Events Manager's home (D-274): every pixel of the workspace as a card, like Integrations, and "Create a pixel".
export function PixelList({ cards, canManage }: { cards: { id: string; publicId: string; name: string; lastEventAt: string | null; week: number; active: boolean }[]; canManage: boolean }) {
  const { t, locale } = useI18n();
  const E = t.ag.rx.ev;
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [naming, setNaming] = useState<string | null>(null);
  const create = () => start(async () => {
    const r = await createPixelAction(naming ?? "");
    if (!r.ok) { toast(r.error, "error"); return; }
    setNaming(null);
    router.push(`/events/${r.id}?tab=setup`);
  });
  return (
    <div className="sdr-page ev">
      <header className="sdr-head">
        <div><h2>{E.title}</h2><p>{E.subtitle}</p></div>
        {canManage && <div className="sdr-head-actions"><button type="button" className="sdr-btn primary" onClick={() => setNaming("")}><Plus />{E.create}</button></div>}
      </header>
      {naming != null && (
        <div className="ev-new">
          <input className="form-input" autoFocus dir="auto" maxLength={80} placeholder={E.namePh} value={naming} onChange={(e) => setNaming(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); }} />
          <button type="button" className="sdr-btn primary" disabled={pending || !naming.trim()} onClick={create}>{E.createBtn}</button>
          <button type="button" className="sdr-btn" onClick={() => setNaming(null)}>{t.ws.common.cancel}</button>
        </div>
      )}
      <div className="ev-cards">
        {cards.map((c) => (
          <Link key={c.id} href={`/events/${c.id}`} className="integration-card ev-card">
            <span className="ev-ico"><Activity /></span>
            <div className="ev-card-body">
              <strong dir="auto">{c.name}</strong>
              <span dir="ltr" className="ev-card-id">ID {c.publicId}</span>
              <span className="ev-card-status"><span className={`ev-dot${c.active ? " on" : ""}`} />{c.active ? E.active : c.lastEventAt ? E.quiet : E.notInstalled}</span>
            </div>
            <div className="ev-card-stats">
              <span><strong>{formatNumber(c.week, locale)}</strong><small>{E.week}</small></span>
              {c.lastEventAt && <small>{fmt(E.lastAt, { at: formatDateTime(c.lastEventAt, locale) })}</small>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
