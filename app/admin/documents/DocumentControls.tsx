"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, Opt, useT } from "@/components/bos/I18n";
import { ModalButton, ConfirmButton } from "@/components/bos/Dialog";
import { ActionForm, SubmitButton, TextField } from "@/components/bos/Form";
import { documentStatusAction, duplicateTemplateAction, emailDocumentAction, generateDocumentAction, previewAction, restoreVersionAction, saveTemplateVersionAction, templateMetaAction } from "./actions";

type O = { value: string; label: string };
export interface TemplateOpt { id: string; name: string; language: string; doc_type: string }

function Preview({ html }: { html: string | null }) {
  if (!html) return null;
  return <iframe title="preview" className="bos-doc-preview" srcDoc={html} sandbox="allow-same-origin" />;
}

// Issue a document from a record: choose template → preview → issue (frozen).
export function GenerateDocumentButton({ entityType, entityId, templates }: { entityType: string; entityId: string; templates: TemplateOpt[] }) {
  const t = useT();
  const router = useRouter();
  const [tpl, setTpl] = useState(templates[0]?.id ?? "");
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!templates.length) return null;
  return (
    <ModalButton label="+ إصدار مستند" title="إصدار مستند من هذا السجل" className="admin-btn small secondary" wide>
      {() => (
        <div className="bos-stack">
          <div className="bos-row" style={{ gap: 8, alignItems: "flex-end" }}>
            <div className="bos-field" style={{ flex: 1 }}>
              <label><Tx>القالب</Tx></label>
              <select value={tpl} onChange={(e) => { setTpl(e.target.value); setHtml(null); }}>
                {templates.map((x) => <option key={x.id} value={x.id}>{`${t(x.name)} (${x.language === "ar" ? "العربية" : "English"})`}</option>)}
              </select>
            </div>
            <button type="button" className="admin-btn small secondary" disabled={pending || !tpl} onClick={() => start(async () => {
              setErr(null);
              const r = await previewAction(tpl, entityType, entityId);
              if (r.ok) setHtml(r.data!.html);
              else setErr(r.error);
            })}><Tx>معاينة</Tx></button>
            <button type="button" className="admin-btn small" disabled={pending || !tpl} onClick={() => start(async () => {
              setErr(null);
              const r = await generateDocumentAction(tpl, entityType, entityId);
              if (r.ok) router.push(`/admin/documents/${r.data!.id}`);
              else setErr(r.error);
            })}><Tx>{pending ? "جارٍ الإصدار..." : "إصدار وتجميد"}</Tx></button>
          </div>
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>الإصدار يحفظ نسخة ثابتة (HTML و DOCX) لا تتغير لاحقاً حتى لو تغيّر القالب أو السجل.</Tx></p>
          {err ? <div className="bos-form-error"><Tx>{err}</Tx></div> : null}
          <Preview html={html} />
        </div>
      )}
    </ModalButton>
  );
}

// Template editor: content + design; saving creates a new version. Live
// preview uses the unsaved draft against a real record.
export function TemplateEditor({ templateId, isEmail, initial, records }: {
  templateId: string;
  isEmail: boolean;
  initial: { subject: string; body: string; primary: string; accent: string; font_size: number; show_logo: boolean; header_note: string; footer_note: string };
  records: { type: string; label: string; options: O[] }[];
}) {
  const t = useT();
  const formRef = useRef<HTMLDivElement>(null);
  const [recType, setRecType] = useState(records[0]?.type ?? "");
  const [recId, setRecId] = useState(records[0]?.options[0]?.value ?? "");
  const [html, setHtml] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const current = records.find((r) => r.type === recType);

  const draft = () => {
    const root = formRef.current!;
    const val = (n: string) => (root.querySelector(`[name="${n}"]`) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "";
    return {
      subject: isEmail ? val("subject") : null,
      body: val("body"),
      primary: val("primary") || "#e51f26",
      accent: val("accent") || "#111827",
      font_size: Number(val("font_size")) || 11,
      show_logo: (root.querySelector('[name="show_logo"]') as HTMLInputElement | null)?.checked ?? true,
      header_note: val("header_note") || null,
      footer_note: val("footer_note") || null,
    };
  };

  return (
    <div className="bos-doc-editor">
      <div ref={formRef}>
        <ActionForm action={saveTemplateVersionAction} successMessage="تم الحفظ">
          <input type="hidden" name="template_id" value={templateId} />
          {isEmail ? <TextField name="subject" label="موضوع البريد" defaultValue={initial.subject} required /> : null}
          <div className="bos-field span-all">
            <label htmlFor="f-body"><Tx>المحتوى</Tx></label>
            <textarea id="f-body" name="body" defaultValue={initial.body} rows={24} dir="auto" className="bos-code" required />
          </div>
          <div className="bos-form-grid">
            <TextField name="primary" label="اللون الأساسي (#RRGGBB)" defaultValue={initial.primary} dir="ltr" />
            <TextField name="accent" label="لون النص (#RRGGBB)" defaultValue={initial.accent} dir="ltr" />
            <TextField name="font_size" label="حجم الخط (pt)" type="number" min={8} max={16} defaultValue={String(initial.font_size)} />
            <div className="bos-field"><label className="bos-check"><input type="checkbox" name="show_logo" defaultChecked={initial.show_logo} /> <Tx>إظهار الشعار</Tx></label></div>
            <TextField name="header_note" label="سطر إضافي في الترويسة" defaultValue={initial.header_note} />
            <TextField name="footer_note" label="التذييل" defaultValue={initial.footer_note} />
            <TextField name="change_note" label="ملاحظة التغيير" placeholder="ما الذي تغيّر في هذا الإصدار؟" />
          </div>
          <div className="bos-form-actions"><SubmitButton label="حفظ كإصدار جديد" /></div>
        </ActionForm>
      </div>
      <div className="bos-stack">
        <div className="bos-row" style={{ gap: 8, alignItems: "flex-end" }}>
          <div className="bos-field">
            <label><Tx>نوع السجل</Tx></label>
            <select value={recType} onChange={(e) => { setRecType(e.target.value); setRecId(records.find((r) => r.type === e.target.value)?.options[0]?.value ?? ""); }}>
              {records.map((r) => <Opt key={r.type} value={r.type}>{r.label}</Opt>)}
            </select>
          </div>
          <div className="bos-field" style={{ flex: 1 }}>
            <label><Tx>السجل للمعاينة</Tx></label>
            <select value={recId} onChange={(e) => setRecId(e.target.value)}>
              {(current?.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button type="button" className="admin-btn small secondary" disabled={pending || !recId} onClick={() => start(async () => {
            setErr(null);
            const r = await previewAction(templateId, recType, recId, draft());
            if (r.ok) { setHtml(r.data!.html); setSubject(r.data!.subject); } else setErr(r.error);
          })}><Tx>{pending ? "..." : "معاينة المسودة"}</Tx></button>
        </div>
        {!records.length ? <div className="bos-faint" style={{ fontSize: 12.5 }}><Tx>المعاينة متاحة من السجل نفسه لهذا النوع.</Tx></div> : null}
        {err ? <div className="bos-form-error"><Tx>{err}</Tx></div> : null}
        {subject ? <div><strong><Tx>الموضوع:</Tx></strong> {subject}</div> : null}
        <Preview html={html} />
        {!html ? <div className="bos-faint" style={{ fontSize: 12.5 }}>{t("اختر سجلاً حقيقياً واضغط «معاينة المسودة» — لا يُحفظ شيء.")}</div> : null}
      </div>
    </div>
  );
}

export function TemplateMetaControls({ id, name, active, roles, editRoles }: { id: string; name: string; active: boolean; roles: O[]; editRoles: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [n, setN] = useState(name);
  const [er, setEr] = useState<string[]>(editRoles);
  const save = (patch: { name?: string; is_active?: boolean; edit_role_keys?: string[] }) => start(async () => {
    const r = await templateMetaAction(id, patch);
    setMsg(r.ok ? { ok: true, text: r.message ?? "" } : { ok: false, text: r.error });
    router.refresh();
  });
  return (
    <div className="bos-stack">
      <div className="bos-form-grid">
        <div className="bos-field"><label><Tx>الاسم</Tx></label><input value={n} onChange={(e) => setN(e.target.value)} /></div>
        <div className="bos-field"><label><Tx>تعديل القالب مقصور على (فارغ = مديرو المستندات)</Tx></label>
          <select multiple value={er} onChange={(e) => setEr(Array.from(e.target.selectedOptions).map((o) => o.value))} style={{ minHeight: 80 }}>
            {roles.map((r) => <Opt key={r.value} value={r.value}>{r.label}</Opt>)}
          </select>
        </div>
      </div>
      <div className="bos-row" style={{ gap: 8 }}>
        <button type="button" className="admin-btn small" disabled={pending} onClick={() => save({ name: n, edit_role_keys: er })}><Tx>حفظ</Tx></button>
        <button type="button" className="admin-btn small ghost" disabled={pending} onClick={() => save({ is_active: !active })}><Tx>{active ? "تعطيل القالب" : "تفعيل القالب"}</Tx></button>
        {msg ? <span className={msg.ok ? "bos-success" : "bos-field-error"} style={{ fontSize: 12 }}><Tx>{msg.text}</Tx></span> : null}
      </div>
    </div>
  );
}

export function RestoreVersionButton({ templateId, versionId, version }: { templateId: string; versionId: string; version: number }) {
  const t = useT();
  return <ConfirmButton label="استعادة" className="admin-btn small ghost" title="استعادة إصدار" message={t("سيُنشأ إصدار جديد بمحتوى الإصدار v{v}. السجل السابق يبقى كما هو.", { v: version })} confirmLabel="استعادة" action={() => restoreVersionAction(templateId, versionId)} />;
}

export function DuplicateTemplateButton({ id, baseKey, name, language }: { id: string; baseKey: string; name: string; language: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <ModalButton label="نسخ" title="نسخ القالب" className="admin-btn small ghost">
      {() => (
        <form className="bos-stack" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          start(async () => {
            const r = await duplicateTemplateAction(id, String(f.get("key")), String(f.get("name")), String(f.get("language")) as "ar" | "en");
            if (r.ok) router.push(`/admin/documents/templates/${r.data!.id}`);
            else setErr(r.error);
          });
        }}>
          <div className="bos-form-grid">
            <div className="bos-field"><label><Tx>المفتاح</Tx></label><input name="key" dir="ltr" defaultValue={`${baseKey}_copy`} required /></div>
            <div className="bos-field"><label><Tx>الاسم</Tx></label><input name="name" defaultValue={name} required /></div>
            <div className="bos-field"><label><Tx>اللغة</Tx></label><select name="language" defaultValue={language}><option value="ar">العربية</option><option value="en">English</option></select></div>
          </div>
          {err ? <div className="bos-form-error"><Tx>{err}</Tx></div> : null}
          <div className="bos-form-actions"><button className="admin-btn" disabled={pending}><Tx>نسخ</Tx></button></div>
        </form>
      )}
    </ModalButton>
  );
}

export function DocumentActions({ id, status, defaultTo }: { id: string; status: string; defaultTo: string }) {
  const t = useT();
  if (status === "void") return null;
  return (
    <div className="bos-row" style={{ gap: 6 }}>
      <ModalButton label="إرسال بالبريد" title="إرسال المستند بالبريد" className="admin-btn small secondary">
        {(close) => (
          <ActionForm action={emailDocumentAction} onSuccess={close} successMessage="تم الإرسال">
            <input type="hidden" name="id" value={id} />
            <TextField name="to" label="إلى (بريد أو أكثر مفصولة بفاصلة)" defaultValue={defaultTo} dir="ltr" required />
            <p className="bos-faint" style={{ fontSize: 12 }}><Tx>يُرفق ملف DOCX المجمّد ويُرسل عبر مزود البريد في مركز التكاملات.</Tx></p>
            <div className="bos-form-actions"><SubmitButton label="إرسال" /></div>
          </ActionForm>
        )}
      </ModalButton>
      {status !== "signed" ? <ConfirmButton label="تسجيل التوقيع" className="admin-btn small ghost" title="تسجيل التوقيع" message={t("تأكيد أن هذا المستند تم توقيعه (يدوياً). التوقيع الإلكتروني عبر مزود خارجي يأتي في مرحلته.")} confirmLabel="تأكيد" action={() => documentStatusAction(id, "signed")} /> : null}
      <ConfirmButton label="إلغاء المستند" className="admin-btn small danger" title="إلغاء المستند" message={t("يبقى المستند في السجل كملغى ولا يمكن تعديله.")} requireReason reasonLabel="سبب الإلغاء" confirmLabel="إلغاء المستند" action={(reason) => documentStatusAction(id, "void", reason)} />
    </div>
  );
}
