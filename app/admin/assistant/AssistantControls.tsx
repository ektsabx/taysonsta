"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, useT } from "@/components/bos/I18n";
import { askAction, deleteThreadAction } from "./actions";

const examples = ["ما أهم المشاكل اليوم؟", "ما المهام المتأخرة؟", "ما الفواتير المستحقة؟", "ما المشاريع المعرّضة للخطر؟", "ما الصفقات التي تحتاج متابعة؟", "ما أكثر أسباب التذاكر؟", "كيف أنشئ عرض سعر؟"];

export function AskBox({ threadId }: { threadId: string | null }) {
  const t = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const send = (text: string) => start(async () => {
    setErr(null);
    const r = await askAction(threadId, text);
    if (!r.ok) return setErr(r.error);
    setQ("");
    if (r.threadId !== threadId) router.push(`/admin/assistant?t=${r.threadId}`);
    else router.refresh();
  });
  return (
    <div className="bos-stack" style={{ gap: 8 }}>
      {!threadId ? <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>{examples.map((e) => <button key={e} type="button" className="admin-btn small ghost" disabled={pending} onClick={() => send(t(e))}><Tx>{e}</Tx></button>)}</div> : null}
      <form className="bos-row" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); if (q.trim()) send(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("اسأل عن بيانات شركتك…")} style={{ flex: 1 }} maxLength={2000} aria-label={t("السؤال")} />
        <button type="submit" className="admin-btn" disabled={pending || !q.trim()}>{pending ? t("جارٍ التفكير…") : t("اسأل")}</button>
      </form>
      {err ? <span className="bos-danger" style={{ fontSize: 12 }}>{t(err)}</span> : null}
    </div>
  );
}

export function DeleteThread({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button type="button" className="admin-btn small ghost" disabled={pending} aria-label="حذف" onClick={() => start(async () => { await deleteThreadAction(id); router.push("/admin/assistant"); })}>×</button>;
}
