"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Globe, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { createPixelAction, deletePixelAction, editPixelAction } from "@/app/(app)/events/actions";

// Events Manager's home (D-274): every pixel of the workspace as a card, like
// Integrations. "Create a pixel" opens a window with the name and website,
// like Facebook's and TikTok's; each card's ⋯ menu edits or deletes it (D-275).
type Card = { id: string; publicId: string; name: string; websiteUrl: string | null; lastEventAt: string | null; week: number; active: boolean };
type Open = { kind: "create" } | { kind: "edit"; card: Card } | { kind: "delete"; card: Card } | null;

export function PixelList({ cards, canManage }: { cards: Card[]; canManage: boolean }) {
  const { t, locale } = useI18n();
  const E = t.ag.rx.ev;
  const [open, setOpen] = useState<Open>(null);
  const [menu, setMenu] = useState<string | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);
  return (
    <div className="sdr-page ev">
      <header className="sdr-head">
        <div><h2>{E.title}</h2><p>{E.subtitle}</p></div>
        {canManage && <div className="sdr-head-actions"><button type="button" className="sdr-btn primary" onClick={() => setOpen({ kind: "create" })}><Plus />{E.create}</button></div>}
      </header>
      <div className="ev-cards">
        {cards.map((c) => (
          <div key={c.id} className="integration-card ev-card-wrap">
            <Link href={`/events/${c.id}`} className="ev-card">
              <span className="ev-ico"><Activity /></span>
              <div className="ev-card-body">
                <strong dir="auto">{c.name}</strong>
                <span dir="ltr" className="ev-card-id">ID {c.publicId}</span>
                {c.websiteUrl && <span dir="ltr" className="ev-card-site"><Globe />{c.websiteUrl.replace(/^https?:\/\//, "")}</span>}
                <span className="ev-card-status"><span className={`ev-dot${c.active ? " on" : ""}`} />{c.active ? E.active : c.lastEventAt ? E.quiet : E.notInstalled}</span>
              </div>
              <div className="ev-card-stats">
                <span><strong>{formatNumber(c.week, locale)}</strong><small>{E.week}</small></span>
                {c.lastEventAt && <small>{fmt(E.lastAt, { at: formatDateTime(c.lastEventAt, locale) })}</small>}
              </div>
            </Link>
            {canManage && (
              <div className="integration-card-menu">
                <button type="button" className="sdr-icon-btn" aria-label={E.more} aria-haspopup="menu" aria-expanded={menu === c.id} onClick={(e) => { e.stopPropagation(); setMenu(menu === c.id ? null : c.id); }}><MoreHorizontal /></button>
                {menu === c.id && (
                  <div className="sdr-menu-panel" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setMenu(null); setOpen({ kind: "edit", card: c }); }}><Pencil />{E.edit}</button>
                    <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(null); setOpen({ kind: "delete", card: c }); }}><Trash2 />{E.del}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {open?.kind === "create" && <PixelDialog onClose={() => setOpen(null)} />}
      {open?.kind === "edit" && <PixelDialog card={open.card} onClose={() => setOpen(null)} />}
      {open?.kind === "delete" && <DeleteDialog card={open.card} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useI18n();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="sdr-dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sdr-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sdr-dialog-head"><h4>{title}</h4><button type="button" className="sdr-icon-btn" aria-label={t.common.close} onClick={onClose}><X /></button></div>
        <div className="sdr-dialog-body">{children}</div>
      </div>
    </div>
  );
}

/** Create a pixel (no card) or edit one: its name and website. */
function PixelDialog({ card, onClose }: { card?: Card; onClose: () => void }) {
  const { t } = useI18n();
  const E = t.ag.rx.ev;
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(card?.name ?? "");
  const [website, setWebsite] = useState(card?.websiteUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const submit = () => start(async () => {
    setError(null);
    if (card) {
      const r = await editPixelAction(card.id, { name, website });
      if (!r.ok) { setError(r.error); return; }
      toast(r.message ?? E.saved);
      onClose();
      router.refresh();
      return;
    }
    const r = await createPixelAction({ name, website });
    if (!r.ok) { setError(r.error); return; }
    toast(r.message ?? E.created);
    router.push(`/events/${r.id}?tab=setup`);
  });
  return (
    <Dialog title={card ? E.editTitle : E.createTitle} onClose={onClose}>
      <form className="ev-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {!card && <p className="ws-hint">{E.createLine}</p>}
        <label className="ws-field"><span className="ws-label">{E.name}</span><input className="form-input" autoFocus dir="auto" maxLength={80} placeholder={E.namePh} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="ws-field"><span className="ws-label">{E.site}</span><input className="form-input" dir="ltr" type="text" inputMode="url" autoComplete="url" maxLength={300} placeholder={E.sitePh} value={website} onChange={(e) => setWebsite(e.target.value)} /><span className="ws-hint">{E.siteHint}</span></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="sdr-foot">
          <button type="button" className="sdr-btn" onClick={onClose}>{E.cancel}</button>
          <button type="submit" className="sdr-btn primary" disabled={pending || !name.trim()}>{card ? E.save : E.createBtn}</button>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteDialog({ card, onClose }: { card: Card; onClose: () => void }) {
  const { t } = useI18n();
  const E = t.ag.rx.ev;
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const remove = () => start(async () => {
    const r = await deletePixelAction(card.id);
    if (!r.ok) { setError(r.error); return; }
    toast(r.message ?? E.deleted);
    onClose();
    router.refresh();
  });
  return (
    <Dialog title={E.delTitle} onClose={onClose}>
      <p><strong dir="auto">{card.name}</strong> <span dir="ltr" className="ev-card-id">ID {card.publicId}</span></p>
      <p className="ws-hint">{E.delLine}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="sdr-foot">
        <button type="button" className="sdr-btn" onClick={onClose}>{E.cancel}</button>
        <button type="button" className="sdr-btn danger" disabled={pending} onClick={remove}>{E.delBtn}</button>
      </div>
    </Dialog>
  );
}
