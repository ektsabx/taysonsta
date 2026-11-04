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
const copy = { title: "Notifications", markAll: "Mark all as read", empty: "You're all caught up.", unread: "Unread", tabs: { ads: "Ads", all: "All", messages: "Messages", system: "System" } };

// D-274 (owner, 2026-11-02): tabs like Facebook's notifications, and an Unread switch.
type Tab = "ads" | "all" | "messages" | "system";
const TABS: Tab[] = ["ads", "all", "messages", "system"];
function tabOf(it: { kind: string; link: string | null }): Exclude<Tab, "all"> {
  if (it.kind === "meeting" || it.link?.startsWith("/inbox")) return "messages";
  if (["outreach", "campaign", "discovery_ready", "leads_review", "campaign_changes", "campaign_summary"].includes(it.kind) || it.link?.startsWith("/campaigns") || it.link?.startsWith("/search/")) return "ads";
  return "system";
}

export function NotificationBell({ unread: initialUnread }: { unread: number }) {
  const n = copy;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const [tab, setTab] = useState<Tab>("all");
  const [onlyUnread, setOnlyUnread] = useState(false);
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

  const shown = (items ?? []).filter((it) => (tab === "all" || tabOf(it) === tab) && (!onlyUnread || !it.read_at));
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
          <div className="notif-tabs" role="tablist">
            {TABS.map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{n.tabs[k]}</button>)}
            <label className="notif-unread"><span>{n.unread}</span><button type="button" role="switch" aria-checked={onlyUnread} aria-label={n.unread} className={`cm-sw${onlyUnread ? " on" : ""}`} onClick={() => setOnlyUnread((v) => !v)}><i /></button></label>
          </div>
          {items === null ? <p className="notif-empty">Loading</p> : shown.length === 0 ? <p className="notif-empty">{n.empty}</p> : (
            <ul>
              {shown.map((it) => (
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
