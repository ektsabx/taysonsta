"use client";

import { useState } from "react";
import { Tx } from "@/components/bos/I18n";

// Make a link for one place you share Yolias (owner, 2026-11-10).
export function LinkBuilder() {
  const [v, setV] = useState({ source: "", medium: "", campaign: "", path: "/" });
  const clean = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "_").slice(0, 80);
  const q = new URLSearchParams();
  if (clean(v.source)) q.set("utm_source", clean(v.source));
  if (clean(v.medium)) q.set("utm_medium", clean(v.medium));
  if (clean(v.campaign)) q.set("utm_campaign", clean(v.campaign));
  const url = `https://www.yolias.com${v.path.startsWith("/") ? v.path : `/${v.path}`}${q.size ? `?${q}` : ""}`;
  const field = (k: keyof typeof v, label: string, ph: string) => (
    <div className="bos-field"><label><Tx>{label}</Tx></label><input dir="ltr" value={v[k]} placeholder={ph} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></div>
  );
  return (
    <div className="bos-form">
      {field("source", "المصدر (utm_source)", "facebook_group")}
      {field("medium", "الوسيلة (utm_medium)", "social")}
      {field("campaign", "الحملة (utm_campaign)", "launch_week")}
      {field("path", "الصفحة", "/pricing")}
      <div className="bos-field"><label><Tx>الرابط</Tx></label><input dir="ltr" readOnly value={url} onFocus={(e) => e.currentTarget.select()} /></div>
      <button type="button" className="admin-btn small app-save" disabled={!q.size} onClick={() => void navigator.clipboard.writeText(url)}><Tx>نسخ الرابط</Tx></button>
    </div>
  );
}
