"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tx, useT } from "@/components/bos/I18n";
import { ModalButton } from "@/components/bos/Dialog";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { portalPermissionsAction, saveDeploymentAction, saveSupportPlanAction } from "@/app/admin/_actions/portal-extra";

const permLabels: Record<string, string> = { projects: "المشاريع والنشر", approvals: "الموافقات", change_requests: "طلبات التغيير", invoices: "الفواتير", payments: "المدفوعات", contracts: "العقود والعروض", documents: "المستندات الصادرة", support: "الدعم والصيانة", messages: "رسائل المشاريع", meetings: "الاجتماعات", files: "الملفات", upload: "رفع الملفات" };

export function PortalPermissionsButton({ clientId, portalUserId, permissions }: { clientId: string; portalUserId: string; permissions: Record<string, boolean> }) {
  const t = useT();
  const router = useRouter();
  const [perms, setPerms] = useState<Record<string, boolean>>(Object.fromEntries(Object.keys(permLabels).map((k) => [k, permissions[k] !== false])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <ModalButton label="صلاحيات البوابة" title="ما يراه هذا المستخدم في بوابة العملاء" className="admin-btn small ghost">
      {() => (
        <div className="bos-stack" style={{ gap: 8 }}>
          <div className="bos-row" style={{ gap: 12, flexWrap: "wrap" }}>
            {Object.entries(permLabels).map(([k, l]) => <label key={k} className="bos-check"><input type="checkbox" checked={perms[k]} disabled={k === "upload" && !perms.files} onChange={(e) => setPerms((p) => ({ ...p, [k]: e.target.checked }))} /> <Tx>{l}</Tx></label>)}
          </div>
          <p className="bos-hint" style={{ margin: 0 }}><Tx>البيانات دائماً مقصورة على حساب العميل نفسه؛ هذه الخيارات تحدد الأقسام المتاحة لهذا المستخدم فقط.</Tx></p>
          <div className="bos-row" style={{ gap: 6, alignItems: "center" }}>
            <button type="button" className="admin-btn small" disabled={pending} onClick={() => start(async () => { const r = await portalPermissionsAction(clientId, portalUserId, perms); setMsg(r.ok ? { ok: true, text: r.message ?? "تم" } : { ok: false, text: r.error }); router.refresh(); })}><Tx>حفظ</Tx></button>
            {msg ? <span className={msg.ok ? "bos-faint" : "bos-danger"} style={{ fontSize: 12 }}>{t(msg.text)}</span> : null}
          </div>
        </div>
      )}
    </ModalButton>
  );
}

type Dep = { id: string; environment: string; version: string | null; url: string | null; status: string; scheduled_at: string | null; notes: string | null; client_visible: boolean };
const toLocal = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export function DeploymentButton({ projectId, dep }: { projectId: string; dep?: Dep }) {
  return (
    <ModalButton label={dep ? "تعديل" : "+ عملية نشر"} title={dep ? "تعديل عملية النشر" : "عملية نشر جديدة"} className={dep ? "admin-btn small ghost" : "admin-btn small"}>
      {(close) => (
        <ActionForm action={saveDeploymentAction} onSuccess={close} successMessage="تم الحفظ">
          <input type="hidden" name="project_id" value={projectId} />
          {dep ? <input type="hidden" name="id" value={dep.id} /> : null}
          <div className="bos-form-grid">
            <SelectField name="environment" label="البيئة" defaultValue={dep?.environment ?? "production"} options={[{ value: "production", label: "الإنتاج" }, { value: "staging", label: "Staging" }, { value: "testing", label: "اختبار" }, { value: "other", label: "أخرى" }]} />
            <SelectField name="status" label="الحالة" defaultValue={dep?.status ?? "planned"} options={[{ value: "planned", label: "مخطط" }, { value: "in_progress", label: "جارٍ النشر" }, { value: "deployed", label: "منشور" }, { value: "failed", label: "فشل" }, { value: "rolled_back", label: "تم التراجع" }]} />
            <TextField name="version" label="الإصدار" dir="ltr" defaultValue={dep?.version ?? ""} />
            <TextField name="url" label="الرابط" dir="ltr" defaultValue={dep?.url ?? ""} />
            <TextField name="scheduled_at" label="الموعد المخطط" type="datetime-local" defaultValue={toLocal(dep?.scheduled_at)} />
            <TextAreaField name="notes" label="ملاحظات (يراها العميل إن كانت ظاهرة)" rows={2} defaultValue={dep?.notes ?? ""} />
            <CheckboxField name="client_visible" label="ظاهرة للعميل في البوابة" defaultChecked={dep?.client_visible ?? true} />
          </div>
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

type Plan = { id: string; project_id: string | null; name: string; status: string; starts_on: string; ends_on: string | null; monthly_hours: number | null; response_hours: number | null; includes: string | null; notes: string | null };

export function SupportPlanButton({ clientId, projects, plan }: { clientId: string; projects: { value: string; label: string }[]; plan?: Plan }) {
  return (
    <ModalButton label={plan ? "تعديل" : "+ خطة صيانة"} title={plan ? "تعديل خطة الصيانة والدعم" : "خطة صيانة ودعم جديدة"} className={plan ? "admin-btn small ghost" : "admin-btn small"}>
      {(close) => (
        <ActionForm action={saveSupportPlanAction} onSuccess={close} successMessage="تم الحفظ">
          <input type="hidden" name="client_id" value={clientId} />
          {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
          <div className="bos-form-grid">
            <TextField name="name" label="اسم الخطة" defaultValue={plan?.name ?? ""} required />
            <SelectField name="status" label="الحالة" defaultValue={plan?.status ?? "active"} options={[{ value: "active", label: "سارية" }, { value: "paused", label: "موقوفة" }, { value: "expired", label: "منتهية" }, { value: "cancelled", label: "ملغاة" }]} />
            <SelectField name="project_id" label="المشروع" placeholder="—" options={projects} defaultValue={plan?.project_id ?? ""} />
            <TextField name="starts_on" label="تبدأ" type="date" defaultValue={plan?.starts_on ?? new Date().toISOString().slice(0, 10)} required />
            <TextField name="ends_on" label="تنتهي" type="date" defaultValue={plan?.ends_on ?? ""} />
            <TextField name="monthly_hours" label="ساعات شهرية" type="number" step="0.5" min={0} defaultValue={plan?.monthly_hours != null ? String(plan.monthly_hours) : ""} hint="تُحسب الساعات المستخدمة من ساعات المشروع المعتمدة" />
            <TextField name="response_hours" label="زمن الاستجابة (ساعات)" type="number" min={1} defaultValue={plan?.response_hours != null ? String(plan.response_hours) : ""} />
            <TextAreaField name="includes" label="ما تشمله الخطة (يظهر للعميل)" rows={3} defaultValue={plan?.includes ?? ""} />
            <TextAreaField name="notes" label="ملاحظات داخلية" rows={2} defaultValue={plan?.notes ?? ""} />
          </div>
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}
