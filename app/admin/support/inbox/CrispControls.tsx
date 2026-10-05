"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tx, Opt, useT } from "@/components/bos/I18n";
import { ConfirmButton } from "@/components/bos/Dialog";
import type { ActionState } from "@/lib/bos/action";
import { assignAction, escalateAction, metaAction, replyAction, spamAction, statusAction, ticketFromConversationAction } from "./actions";

// Inbox workspace controls (docs/bos/37 §7, Crisp-inspired layout). Every
// control calls the existing server actions; permissions are enforced there.

type O = { value: string; label: string };

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<ActionState<unknown>>, after?: (d: unknown) => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? "" } : { ok: false, text: r.error });
      if (r.ok) {
        after?.((r as { data?: unknown }).data);
        router.refresh();
      }
    });
  return { pending, msg, run, setMsg };
}

// URL-driven select (status / channel / team / priority) for the list header.
export function QuerySelect({ name, value, options, label }: { name: string; value: string; options: O[]; label: string }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <select className="cx-select" aria-label={t(label)} value={value} onChange={(e) => {
      const p = new URLSearchParams(sp.toString());
      if (e.target.value) p.set(name, e.target.value);
      else p.delete(name);
      p.delete("c");
      router.push(`${pathname}${p.toString() ? `?${p}` : ""}`, { scroll: false });
    }}>
      {options.map((o) => <Opt key={o.value} value={o.value}>{o.label}</Opt>)}
    </select>
  );
}

// Keeps the latest message in view when a conversation opens or updates.
export function ScrollToEnd({ dep }: { dep: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const box = ref.current?.closest(".cx-messages");
    if (box) box.scrollTop = box.scrollHeight;
  }, [dep]);
  return <span ref={ref} aria-hidden />;
}

export function ThreadActions({ id, status, assigneeId, me, hasTicket, spam, canUpdate }: { id: string; status: string; assigneeId: string | null; me: string; hasTicket: boolean; spam: boolean; canUpdate: boolean }) {
  const t = useT();
  const router = useRouter();
  const { pending, msg, run } = useRun();
  const [menu, setMenu] = useState(false);
  const [snooze, setSnooze] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menu]);
  const closed = status === "resolved" || status === "closed";
  if (spam) {
    return (
      <div className="cx-thread-actions">
        {canUpdate ? <button type="button" className="admin-btn small" disabled={pending} onClick={() => run(() => spamAction(id, "restore"), () => router.push(`/admin/support/inbox?c=${id}`))}><Tx>ليست رسالة مزعجة — استعادة</Tx></button> : null}
        {msg && !msg.ok ? <span className="bos-field-error"><Tx>{msg.text}</Tx></span> : null}
      </div>
    );
  }
  return (
    <div className="cx-thread-actions">
      {assigneeId !== me ? <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => run(() => assignAction(id, { assignee_id: me }))}><Tx>إسناد لي</Tx></button> : null}
      {canUpdate ? (!closed
        ? <button type="button" className="admin-btn small success" disabled={pending} onClick={() => run(() => statusAction(id, "resolved"))}><Tx>تم الحل</Tx></button>
        : <button type="button" className="admin-btn small secondary" disabled={pending} onClick={() => run(() => statusAction(id, "open"))}><Tx>إعادة فتح</Tx></button>) : null}
      {canUpdate ? (
        <div className="cx-menu" ref={menuRef}>
          <button type="button" className="admin-icon-btn" aria-haspopup="menu" aria-expanded={menu} aria-label={t("إجراءات أخرى")} onClick={() => setMenu((v) => !v)}>⋯</button>
          {menu ? (
            <div className="cx-menu-list" role="menu">
              {!closed && status !== "pending_internal" ? <button type="button" role="menuitem" disabled={pending} onClick={() => { setMenu(false); run(() => statusAction(id, "pending_internal")); }}><Tx>بانتظار الفريق</Tx></button> : null}
              {!closed && status !== "pending_customer" ? <button type="button" role="menuitem" disabled={pending} onClick={() => { setMenu(false); run(() => statusAction(id, "pending_customer")); }}><Tx>بانتظار العميل</Tx></button> : null}
              {status === "resolved" ? <button type="button" role="menuitem" disabled={pending} onClick={() => { setMenu(false); run(() => statusAction(id, "closed")); }}><Tx>إغلاق</Tx></button> : null}
              {!hasTicket ? <button type="button" role="menuitem" disabled={pending} onClick={() => { setMenu(false); run(() => ticketFromConversationAction(id), (d) => { const x = d as { id: string } | undefined; if (x) router.push(`/admin/support/tickets/${x.id}`); }); }}><Tx>إنشاء تذكرة</Tx></button> : null}
              {!closed ? (
                <div className="cx-menu-snooze">
                  <input type="datetime-local" aria-label={t("تأجيل حتى")} value={snooze} onChange={(e) => setSnooze(e.target.value)} />
                  <button type="button" className="admin-btn small ghost" disabled={pending || !snooze} onClick={() => { setMenu(false); run(() => statusAction(id, "snoozed", new Date(snooze).toISOString())); }}><Tx>تأجيل</Tx></button>
                </div>
              ) : null}
              <div className="cx-menu-sep" />
              <button type="button" role="menuitem" className="danger" disabled={pending} onClick={() => { setMenu(false); run(() => spamAction(id, "mark"), () => router.push("/admin/support/inbox")); }}><Tx>نقل إلى الرسائل المزعجة</Tx></button>
            </div>
          ) : null}
        </div>
      ) : null}
      {!closed && canUpdate ? <ConfirmButton label="تصعيد" className="admin-btn small danger" title="تصعيد المحادثة" message={t("ترفع الأولوية ويُبلَّغ قادة الفريق.")} requireReason reasonLabel="سبب التصعيد" confirmLabel="تصعيد" action={(reason) => escalateAction(id, reason)} /> : null}
      {msg && !msg.ok ? <span className="bos-field-error"><Tx>{msg.text}</Tx></span> : null}
    </div>
  );
}

// Assignment and priority in the side panel.
export function ConversationFields({ id, assigneeId, teamId, priority, staff, teams, canAssign, canUpdate }: { id: string; assigneeId: string | null; teamId: string | null; priority: string; staff: O[]; teams: O[]; canAssign: boolean; canUpdate: boolean }) {
  const t = useT();
  const { pending, msg, run } = useRun();
  return (
    <div className="cx-fields">
      <label><span><Tx>المسؤول</Tx></span>
        <select value={assigneeId ?? ""} disabled={pending || !canAssign} onChange={(e) => run(() => assignAction(id, { assignee_id: e.target.value || null }))}>
          <option value="">{t("— غير معيّن —")}</option>
          {staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      <label><span><Tx>الفريق</Tx></span>
        <select value={teamId ?? ""} disabled={pending || !canAssign} onChange={(e) => run(() => assignAction(id, { team_id: e.target.value || null }))}>
          <option value="">—</option>
          {teams.map((s) => <Opt key={s.value} value={s.value}>{s.label}</Opt>)}
        </select>
      </label>
      <label><span><Tx>الأولوية</Tx></span>
        <select value={priority} disabled={pending || !canUpdate} onChange={(e) => run(() => metaAction(id, { priority: e.target.value as "normal" }))}>
          {[["low", "منخفضة"], ["normal", "عادية"], ["high", "عالية"], ["urgent", "عاجلة"]].map(([v, l]) => <Opt key={v} value={v}>{l}</Opt>)}
        </select>
      </label>
      {msg ? <span className={msg.ok ? "bos-success" : "bos-field-error"} style={{ fontSize: 12 }}><Tx>{msg.text}</Tx></span> : null}
    </div>
  );
}

// Crisp-style composer: Reply / Note tabs over one box, send on Ctrl/⌘+Enter.
export function CxComposer({ id, channel, customer, disabled }: { id: string; channel: string; customer: string; disabled: boolean }) {
  const t = useT();
  const { pending, msg, run, setMsg } = useRun();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const send = () => {
    if (!body.trim()) return;
    run(() => replyAction(id, body, internal), () => setBody(""));
  };
  const hint = internal ? "لا تُرسل للعميل — يراها الفريق فقط" : channel === "email" ? "يُرسل بالبريد للعميل" : channel === "manual" ? "يُحفظ كملاحظة لما قيل للعميل" : "يظهر للعميل في قناته";
  return (
    <div className={`cx-composer${internal ? " note" : ""}`}>
      <div className="cx-composer-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={!internal} className={!internal ? "on" : undefined} onClick={() => { setInternal(false); setMsg(null); }}><Tx>رد</Tx></button>
        <button type="button" role="tab" aria-selected={internal} className={internal ? "on" : undefined} onClick={() => { setInternal(true); setMsg(null); }}><Tx>ملاحظة</Tx></button>
        <span className="cx-composer-hint"><Tx>{hint}</Tx></span>
      </div>
      <div className="cx-composer-box">
        <textarea
          value={body}
          disabled={disabled || pending}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
          placeholder={internal ? t("اكتب ملاحظة داخلية...") : t("اكتب ردك إلى {name}... (Ctrl+Enter للإرسال)", { name: customer })}
          rows={3}
          dir="auto"
          aria-label={internal ? t("ملاحظة داخلية") : t("الرد")}
        />
        <button type="button" className="cx-send" disabled={disabled || pending || !body.trim()} onClick={send} aria-label={t(internal ? "حفظ الملاحظة" : "إرسال")}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 12l16-8-6 16-2.5-6.5L4 12z" /></svg>
        </button>
      </div>
      {msg ? <div className={msg.ok ? "bos-form-success" : "bos-form-error"} style={{ marginTop: 6 }}><Tx>{msg.text}</Tx></div> : null}
    </div>
  );
}
