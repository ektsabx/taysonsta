"use client";

import { useMemo, useState } from "react";
import { Tx, useT } from "@/components/bos/I18n";
import { ActionForm, FormSection, SubmitButton, TextField } from "@/components/bos/Form";
import { composeText, platforms, validateTarget, type MediaItem, type Platform } from "@/lib/bos/social/platforms";
import { savePostAction } from "./actions";

export type AccountOpt = { id: string; platform: Platform; name: string; handle: string | null; mode: string; status: string };
export interface PostValues { id?: string; title?: string; base_text?: string; hashtags?: string[]; media?: MediaItem[]; link_url?: string | null; scheduled_at?: string | null; campaign?: string | null; targets?: { account_id: string; text_override: string | null; locked?: boolean }[] }

const toLocal = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export function PostEditor({ accounts, initial = {} }: { accounts: AccountOpt[]; initial?: PostValues }) {
  const t = useT();
  const [text, setText] = useState(initial.base_text ?? "");
  const [tags, setTags] = useState((initial.hashtags ?? []).map((h) => `#${h}`).join(" "));
  const [mediaRaw, setMediaRaw] = useState((initial.media ?? []).map((m) => m.url).join("\n"));
  const [selected, setSelected] = useState<string[]>((initial.targets ?? []).map((x) => x.account_id));
  const [versions, setVersions] = useState<Record<string, string>>(Object.fromEntries((initial.targets ?? []).filter((x) => x.text_override).map((x) => [x.account_id, x.text_override!])));
  const locked = new Set((initial.targets ?? []).filter((x) => x.locked).map((x) => x.account_id));
  const media: MediaItem[] = useMemo(() => mediaRaw.split(/\s+/).filter(Boolean).map((url) => ({ url, type: /\.(mp4|mov|webm)(\?|$)/i.test(url) ? "video" : "image" })), [mediaRaw]);
  const hashtags = tags.split(/[\s,،]+/).map((h) => h.replace(/^#/, "")).filter(Boolean);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <ActionForm action={savePostAction} successMessage="تم الحفظ">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormSection>
        <div className="bos-form-grid">
          <TextField name="title" label="عنوان داخلي" defaultValue={initial.title ?? ""} required span={2} />
          <TextField name="campaign" label="الحملة" defaultValue={initial.campaign ?? ""} />
          <TextField name="scheduled_at" label="موعد النشر المقترح" type="datetime-local" defaultValue={toLocal(initial.scheduled_at)} />
        </div>
        <div className="bos-field" style={{ marginTop: 8 }}>
          <label><Tx>النص الأساسي</Tx></label>
          <textarea name="base_text" rows={6} value={text} onChange={(e) => setText(e.target.value)} dir="auto" />
        </div>
        <div className="bos-form-grid" style={{ marginTop: 8 }}>
          <div className="bos-field"><label><Tx>الوسوم</Tx></label><input name="hashtags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#taysonsta #design" dir="ltr" /></div>
          <TextField name="link_url" label="رابط (اختياري)" dir="ltr" defaultValue={initial.link_url ?? ""} />
          <div className="bos-field" style={{ gridColumn: "1 / -1" }}><label><Tx>روابط الصور/الفيديو (https عامة، رابط في كل سطر)</Tx></label><textarea name="media" rows={2} value={mediaRaw} onChange={(e) => setMediaRaw(e.target.value)} dir="ltr" /></div>
        </div>
      </FormSection>
      <FormSection title="المنصات والنسخ">
        {accounts.length ? null : <p className="bos-hint"><Tx>لا توجد حسابات — أضفها من صفحة الحسابات.</Tx></p>}
        <div className="bos-stack" style={{ gap: 10 }}>
          {accounts.map((a) => {
            const on = selected.includes(a.id);
            const final = composeText(text, versions[a.id] || null, hashtags);
            const v = validateTarget(a.platform, final, media);
            const spec = platforms[a.platform];
            const max = media.length && spec.captionMaxWithMedia ? spec.captionMaxWithMedia : spec.textMax;
            return (
              <div key={a.id} style={{ border: "1px solid var(--bos-border)", borderRadius: 10, padding: 10, opacity: on ? 1 : 0.7 }}>
                <label className="bos-check">
                  <input type="checkbox" name="account_ids[]" value={a.id} checked={on} disabled={locked.has(a.id)} onChange={() => toggle(a.id)} />
                  <strong><Tx>{spec.label}</Tx></strong> · {a.name}{a.handle ? ` (${a.handle})` : ""} <span className="bos-tag"><Tx>{a.mode === "api" ? "نشر تلقائي" : "نشر يدوي"}</Tx></span>
                </label>
                {locked.has(a.id) ? <input type="hidden" name="account_ids[]" value={a.id} /> : null}
                {on ? (
                  <div className="bos-stack" style={{ gap: 6, marginTop: 6 }}>
                    <textarea name={`text_${a.id}`} rows={3} placeholder={t("نسخة خاصة بهذه المنصة (اتركها فارغة لاستخدام النص الأساسي)")} value={versions[a.id] ?? ""} onChange={(e) => setVersions((s) => ({ ...s, [a.id]: e.target.value }))} dir="auto" disabled={locked.has(a.id)} />
                    <div className="bos-faint" style={{ fontSize: 12 }}><Tx>المعاينة</Tx> · {[...final].length}/{max}</div>
                    <div style={{ whiteSpace: "pre-wrap", padding: 8, background: "rgba(var(--bos-fg-rgb), .04)", borderRadius: 8, fontSize: 13.5 }} dir="auto">{final || "—"}{media.length ? `\n🖼 ×${media.length}` : ""}</div>
                    {v.errors.map((e) => <div key={e} className="bos-danger" style={{ fontSize: 12 }}>✖ {t(e)}</div>)}
                    {v.warnings.map((w) => <div key={w} className="bos-faint" style={{ fontSize: 12 }}>⚠ {t(w)}</div>)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </FormSection>
      <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
    </ActionForm>
  );
}
