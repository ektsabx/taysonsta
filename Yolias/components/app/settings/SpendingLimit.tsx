"use client";

import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { getSpendingLimit, resetSpendingLimit, setSpendingLimit, type SpendingLimit as Limit } from "@/app/(app)/dashboard/actions";

// Settings → Billing (owner, 2026-11-02, D-274): the account spending limit, like an ads account's.
const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: v % 1 ? 2 : 0, minimumFractionDigits: v % 1 ? 2 : 0 }).format(v);

export function SpendingLimit() {
  const { t, locale } = useI18n();
  const L = t.ag.rx.limit;
  const toast = useToast();
  const [data, setData] = useState<Limit | null>(null);
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const load = () => getSpendingLimit().then((d) => { setData(d); setValue(d.limitUsd == null ? "" : String(d.limitUsd)); });
  useEffect(() => { void load(); }, []);
  const act = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => start(async () => {
    const r = await fn();
    if (!r.ok) toast(r.error ?? t.ws.common.error, "error"); else { if (r.message) toast(r.message); await load(); }
  });
  if (!data) return null;
  const pct = data.limitUsd ? Math.min(100, (data.spentUsd / data.limitUsd) * 100) : 0;
  return (
    <section className="sl" data-setting="spending-limit">
      <div className="sl-row">
        <div className="sl-label"><strong>{L.title}</strong>{data.limitUsd == null && <span>{L.none}</span>}</div>
        {data.canManage && (
          <div className="sl-form">
            <span className="cb-money"><span aria-hidden>$</span><input className="form-input num" type="number" min={1} step="1" inputMode="decimal" value={value} placeholder={L.none} aria-label={L.title} onChange={(e) => setValue(e.target.value)} /></span>
            <button type="button" className="sdr-btn primary sm" disabled={pending || !value || Number(value) === data.limitUsd} onClick={() => act(() => setSpendingLimit(Number(value)))}>{L.save}</button>
          </div>
        )}
      </div>
      {data.limitUsd != null && (
        <div className="sl-meter">
          <div className="sl-line"><strong><bdi dir="ltr">{usd(data.spentUsd)}</bdi></strong><span>{fmt(L.of, { usd: usd(data.limitUsd) })}</span>{data.since && <small>{fmt(L.since, { date: formatDate(data.since, locale) })}</small>}</div>
          <div className={`db-account-bar${pct >= 100 ? " full" : ""}`}><i style={{ width: `${pct}%` }} /></div>
          {pct >= 100 && <p className="sl-reached">{L.reached}</p>}
        </div>
      )}
      {data.canManage && data.limitUsd != null && (
        <div className="sl-actions">
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => { if (confirm(L.resetConfirm)) act(() => resetSpendingLimit()); }}>{L.reset}</button>
          <button type="button" className="sdr-btn ghost sm" disabled={pending} onClick={() => act(() => setSpendingLimit(null))}>{L.remove}</button>
        </div>
      )}
    </section>
  );
}
