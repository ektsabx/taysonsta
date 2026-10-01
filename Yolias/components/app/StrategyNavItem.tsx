"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { deleteStrategy, pinStrategy, renameStrategy } from "@/app/(app)/actions";
import { useToast } from "@/components/Toast";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";

interface Props {
  id: string;
  title: string;
  pinned: boolean;
  active: boolean;
}

// One sidebar history row: hover shows "…" → Pin / Rename / Delete.
export function StrategyNavItem({ id, title, pinned, active }: Props) {
  const { t } = useI18n();
  const n = t.nav;
  const router = useRouter();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(title);
  const [, start] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const saveRename = () => {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === title) return setDraft(title);
    start(async () => {
      const r = await renameStrategy(id, next);
      toast(r.ok ? t.toast.renamed : t.toast.failed, r.ok ? "success" : "error");
      router.refresh();
    });
  };

  const remove = () => {
    setConfirming(false);
    start(async () => {
      const r = await deleteStrategy(id);
      toast(r.ok ? t.toast.deleted : t.toast.failed, r.ok ? "success" : "error");
      if (r.ok && active) router.push("/");
      router.refresh();
    });
  };

  if (editing) {
    return (
      <div className="nav-item editing">
        <input
          ref={inputRef}
          className="nav-rename"
          value={draft}
          maxLength={60}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveRename();
            if (e.key === "Escape") {
              setDraft(title);
              setEditing(false);
            }
          }}
          aria-label={n.rename}
        />
      </div>
    );
  }

  return (
    <>
      <div className={`nav-item has-menu${active ? " active" : ""}${menuOpen ? " menu-open" : ""}`}>
        <Link href={`/search/${id}`} className="nav-item-inner nav-item-link" title={title}>
          {pinned ? <Pin /> : <History />}
          <span>{title}</span>
        </Link>
        <div className="nav-item-menu" ref={menuRef}>
          <button type="button" className="nav-item-more" aria-label={fmt(n.moreOptions, { title })} aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            <MoreHorizontal />
          </button>
          {menuOpen && (
            <div className="item-menu" role="menu">
              <button type="button" role="menuitem" className="menu-item" onClick={() => { setMenuOpen(false); start(async () => { const r = await pinStrategy(id, !pinned); toast(!r.ok ? t.toast.failed : pinned ? t.toast.unpinned : t.toast.pinned, r.ok ? "success" : "error"); router.refresh(); }); }}>
                {pinned ? <PinOff /> : <Pin />}
                <span>{pinned ? n.unpin : n.pin}</span>
              </button>
              <button type="button" role="menuitem" className="menu-item" onClick={() => { setMenuOpen(false); setDraft(title); setEditing(true); }}>
                <Pencil />
                <span>{n.rename}</span>
              </button>
              <button type="button" role="menuitem" className="menu-item danger" onClick={() => { setMenuOpen(false); setConfirming(true); }}>
                <Trash2 />
                <span>{n.delete}</span>
              </button>
            </div>
          )}
        </div>
      </div>
      {confirming && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setConfirming(false)}>
          <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`del-${id}`}>
            <h3 id={`del-${id}`}>{n.deleteTitle}</h3>
            <p>{fmt(n.deleteBody, { title })}</p>
            <div className="confirm-actions">
              <button type="button" className="btn-secondary" onClick={() => setConfirming(false)} autoFocus>{n.cancel}</button>
              <button type="button" className="btn-danger solid" onClick={remove}>{n.delete}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
