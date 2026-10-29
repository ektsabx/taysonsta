"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Printer, Send, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/Toast";
import { sendQuote } from "@/app/(app)/crm/[id]/quote/actions";

type Line = { text: string; qty: number; price: number };

export function QuoteSheet({ locale, from, to, amount, currency, offering, leadId, back }: {
  locale: "ar" | "en"; from: { name: string; website: string; email: string }; to: { name: string; contact: string; email: string };
  amount: number; currency: string; offering: string; leadId: string;
  /** Where the quote was opened from: the conversation or the customer record. */
  back: "inbox" | "crm";
}) {
  const { t } = useI18n();
  const q = t.quote;
  const toast = useToast();
  const router = useRouter();
  const [sending, start] = useTransition();
  const backHref = back === "inbox" ? `/inbox?lead=${leadId}` : `/crm/${leadId}`;
  const [lines, setLines] = useState<Line[]>([{ text: offering.split(/[.\n]/)[0]?.slice(0, 120) || q.item, qty: 1, price: amount }]);
  const [notes, setNotes] = useState(q.defaultNotes);
  const today = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { dateStyle: "long" }).format(new Date());
  const money = (v: number) => new Intl.NumberFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { style: "currency", currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD", maximumFractionDigits: 2 }).format(v);
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const set = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const cur = /^[A-Z]{3}$/.test(currency) ? currency : "USD";
  // The quote as the email's text (owner, 2026-10-29): sent in the conversation like a reply.
  const asText = () => [
    q.intro, "",
    `${q.title} · ${from.name} · ${today}`,
    `${q.to}: ${to.name}${to.contact ? ` (${to.contact})` : ""}`, "",
    ...lines.filter((l) => l.text.trim()).map((l, i) => `${i + 1}. ${l.text.trim()}: ${l.qty} × ${money(l.price)} = ${money(l.qty * l.price)}`), "",
    `${q.total}: ${money(total)}`,
    ...(notes.trim() ? ["", notes.trim()] : []),
  ].join("\n");
  const send = () => start(async () => {
    const r = await sendQuote({ leadId, currency: cur, lines: lines.filter((l) => l.text.trim()).map((l) => ({ text: l.text.trim(), qty: l.qty, price: l.price })), notes, text: asText() });
    if (!r.ok) { toast(r.error, "error"); return; }
    toast(q.sent);
    router.push(backHref);
  });
  return (
    <div className="page-view">
      <div className="quote-tools no-print">
        <Link className="sdr-back" href={backHref}><ChevronLeft className="flip-rtl" />{back === "inbox" ? q.backInbox : q.back}</Link>
        <span className="quote-actions">
          <button type="button" className="btn-secondary" onClick={() => window.print()}><Printer size={15} /> {q.print}</button>
          <button type="button" className="btn-primary" disabled={sending || !to.email || total <= 0} title={!to.email ? q.errors.noEmail : undefined} onClick={send}><Send size={15} /> {q.send}</button>
        </span>
        {!to.email && <p className="quote-hint">{q.errors.noEmail}</p>}
      </div>
      <article className="quote-sheet" dir={locale === "ar" ? "rtl" : "ltr"}>
        <header className="quote-head">
          <div><h1>{from.name}</h1><p>{[from.website, from.email].filter(Boolean).join(" · ")}</p></div>
          <div className="quote-meta"><strong>{q.title}</strong><span>{today}</span></div>
        </header>
        <section className="quote-to"><span>{q.to}</span><strong>{to.name}</strong>{to.contact && <span>{to.contact}</span>}{to.email && <span dir="ltr">{to.email}</span>}</section>
        <table className="quote-lines">
          <thead><tr><th>{q.description}</th><th>{q.qty}</th><th>{q.price}</th><th>{q.amount}</th><th className="no-print" /></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td><input value={l.text} onChange={(e) => set(i, { text: e.target.value })} aria-label={q.description} dir="auto" /></td>
                <td><input type="number" min={1} value={l.qty} onChange={(e) => set(i, { qty: Math.max(1, Number(e.target.value) || 1) })} aria-label={q.qty} dir="ltr" /></td>
                <td><input type="number" min={0} value={l.price} onChange={(e) => set(i, { price: Math.max(0, Number(e.target.value) || 0) })} aria-label={q.price} dir="ltr" /></td>
                <td dir="ltr">{money(l.qty * l.price)}</td>
                <td className="no-print">{lines.length > 1 && <button type="button" className="sdr-icon-btn" aria-label={q.remove} onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 /></button>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={3}>{q.total}</td><td dir="ltr"><strong>{money(total)}</strong></td><td className="no-print" /></tr></tfoot>
        </table>
        <button type="button" className="sdr-btn no-print" onClick={() => setLines([...lines, { text: "", qty: 1, price: 0 }])}><Plus />{q.addLine}</button>
        <section className="quote-notes"><span>{q.notes}</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} dir="auto" /></section>
      </article>
    </div>
  );
}
