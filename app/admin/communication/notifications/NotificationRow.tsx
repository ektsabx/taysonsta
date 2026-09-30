"use client";

import { Tx } from "@/components/bos/I18n";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsReadAction, markNotificationUnreadAction } from "@/app/admin/_actions/common";

export function NotificationRow({ n }: { n: { id: string; title: string; body: string | null; link: string | null; created: string; read: boolean; type: string } }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toggle = () => start(async () => { await (n.read ? markNotificationUnreadAction(n.id) : markNotificationsReadAction([n.id])); router.refresh(); });
  return (
    <div className={`bos-notif-row${n.read ? "" : " unread"}`}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {n.link ? <Link href={n.link} onClick={() => !n.read && markNotificationsReadAction([n.id])}><Tx>{n.title}</Tx></Link> : <span><Tx>{n.title}</Tx></span>}
        {n.body ? <div className="bos-faint" style={{ fontSize: 12.5 }}>{n.body}</div> : null}
        <div className="bos-faint" style={{ fontSize: 11.5 }}>{n.created} · {n.type}</div>
      </div>
      <button type="button" className="admin-btn small ghost" disabled={pending} onClick={toggle}><Tx>{n.read ? "غير مقروء" : "مقروء"}</Tx></button>
    </div>
  );
}

export function MarkAllReadButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <button type="button" className="admin-btn small secondary" disabled={pending} onClick={() => start(async () => { await markNotificationsReadAction("all"); router.refresh(); })}><Tx>تعليم الكل كمقروء</Tx></button>;
}
