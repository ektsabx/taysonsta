"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx } from "@/components/bos/I18n";
import { setArticleAiAction, setArticleStatusAction } from "@/app/admin/knowledge/actions";

// Row actions for the support knowledge base — existing KB actions, server-authorised.
export function KbRowActions({ id, status, ai, canPublish, canEdit }: { id: string; status: string; ai: boolean; canPublish: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { setErr(null); const r = await fn(); if (!r.ok) setErr(r.error ?? ""); else router.refresh(); });
  return (
    <span className="bos-row" style={{ gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {canEdit ? <label className="bos-check" style={{ fontSize: 12 }}><input type="checkbox" checked={ai} disabled={pending} onChange={(e) => run(() => setArticleAiAction(id, e.target.checked))} /><Tx>للوكيل الذكي</Tx></label> : null}
      {canPublish ? (status === "published"
        ? <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => run(() => setArticleStatusAction(id, "draft"))}><Tx>إلغاء النشر</Tx></button>
        : <button type="button" className="admin-btn small secondary" disabled={pending} onClick={() => run(() => setArticleStatusAction(id, "published"))}><Tx>نشر</Tx></button>) : null}
      {err ? <span className="bos-field-error" style={{ fontSize: 11.5 }}><Tx>{err}</Tx></span> : null}
    </span>
  );
}
