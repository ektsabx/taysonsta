"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { cleanNotificationText, notificationTime } from "@/lib/notification-text";
import { listNotifications, markRead } from "@/app/(app)/notifications/actions";

type Item = Awaited<ReturnType<typeof listNotifications>>[number];

/**
 * The bell: unread count, the latest notices, mark read (final spec phase 9).
 * One language, English, and a plain Claude-like list (owner, 2026-10-19).
 */
const copy = { title: "Notifications", markAll: "Mark all as read", empty: "You're all caught up." };

export function NotificationBell({ unread: initialUnread }: { unread: number }) {
  const n = copy;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const ref = useRef<HTMLDivElement>(null);

  // A fresh count from the server (after navigation / refresh) replaces the local one.
  const [seen, setSeen] = useState(initialUnread);
  if (seen !== initialUnread) {
    setSeen(initialUnread);
    setUnread(initialUnread);
  }
  useEffect(() => {
    if (!open) return;
    void listNotifications().then(setItems);
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const openItem = async (it: Item) => {
    if (!it.read_at) {
      setUnread((u) => Math.max(0, u - 1));
      setItems((cur) => cur?.map((x) => (x.id === it.id ? { ...x, read_at: new Date().toISOString() } : x)) ?? null);
      await markRead([it.id]);
    }
    setOpen(false);
    if (it.link) router.push(it.link);
  };

  return (
    <div className="notif" ref={ref}>
      <button type="button" className="notif-button" aria-label={unread ? `${n.title} (${unread})` : n.title} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell />
        {unread > 0 && <span className="notif-count">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label={n.title} dir="ltr" lang="en">
          <div className="notif-head">
            <strong>{n.title}</strong>
            {unread > 0 && <button type="button" className="link-button" onClick={async () => {
              setUnread(0);
              setItems((cur) => cur?.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })) ?? null);
              await markRead("all");
            }}>{n.markAll}</button>}
          </div>
          {items === null ? <p className="notif-empty">Loading</p> : items.length === 0 ? <p className="notif-empty">{n.empty}</p> : (
            <ul>
              {items.map((it) => (
                <li key={it.id}>
                  <button type="button" className={it.read_at ? "" : "unread"} onClick={() => void openItem(it)}>
                    <span className="notif-dot" aria-hidden="true" />
                    <span className="notif-text">
                      <span className="notif-title" dir="auto">{cleanNotificationText(it.title)}</span>
                      {it.body ? <span className="notif-body" dir="auto">{cleanNotificationText(it.body)}</span> : null}
                    </span>
                    <time dateTime={it.created_at} title={new Date(it.created_at).toLocaleString("en-US")}>{notificationTime(it.created_at)}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
