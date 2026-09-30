"use client";

import { Tx, useT } from "@/components/bos/I18n";
import { nowMs } from "@/lib/bos/clock";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { getNotificationsAction, markNotificationsReadAction } from "@/app/admin/_actions/common";
import { BosIcon } from "@/components/bos/icons";

type Item = Awaited<ReturnType<typeof getNotificationsAction>>["items"][number];

function ago(iso: string) {
  const diff = Math.round((nowMs() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "الآن";
  if (diff < 60) return `منذ ${diff} د`;
  if (diff < 1440) return `منذ ${Math.round(diff / 60)} س`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// Header bell (§41, §98): unread count, latest items, mark read. Polls every
// 60s while the tab is visible.
export function NotificationCenter({ initialUnread }: { initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const tr = useT();
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        const data = await getNotificationsAction();
        setUnread(data.unread);
        setItems(data.items);
      } catch {
        // session expired; the next navigation will redirect to login
      }
    });
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") load();
    };
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="bos-menu bos-bell" ref={ref}>
      <button
        type="button"
        className="admin-icon-btn"
        aria-label={tr("الإشعارات ({unread} غير مقروء)", { unread })}
        onClick={() => {
          setOpen((v) => !v);
          load();
        }}
      >
        <BosIcon name="bell" />
        {unread > 0 ? <span className="bos-bell-count">{unread > 99 ? "99+" : unread}</span> : null}
      </button>
      {open ? (
        <div className="bos-menu-panel bos-notif-panel">
          <div className="bos-row" style={{ justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid rgba(var(--bos-fg-rgb), 0.08)" }}>
            <strong style={{ fontSize: 13 }}><Tx>الإشعارات</Tx></strong>
            {unread > 0 ? (
              <button
                type="button"
                style={{ width: "auto", padding: "2px 6px", fontSize: 12 }}
                onClick={() =>
                  startTransition(async () => {
                    await markNotificationsReadAction("all");
                    load();
                  })
                }
              >
                <Tx>تعليم الكل كمقروء</Tx>
              </button>
            ) : null}
          </div>
          {items.length === 0 ? <div className="bos-faint" style={{ padding: 16, fontSize: 12.5 }}><Tx>لا توجد إشعارات.</Tx></div> : null}
          {items.map((n) => (
            <Link
              key={n.id}
              href={n.link ?? "/admin/communication/notifications"}
              className={`bos-notif-item${n.read ? "" : " unread"}`}
              onClick={() => {
                setOpen(false);
                if (!n.read) startTransition(async () => void (await markNotificationsReadAction([n.id])));
              }}
            >
              <div className="t"><Tx>{n.title}</Tx></div>
              {n.body ? <div className="m">{n.body}</div> : null}
              <div className="m">{ago(n.createdAt)}</div>
            </Link>
          ))}
          <Link href="/admin/communication/notifications" className="bos-notif-item" style={{ textAlign: "center", fontSize: 12.5 }} onClick={() => setOpen(false)}>
            <Tx>كل الإشعارات</Tx>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
