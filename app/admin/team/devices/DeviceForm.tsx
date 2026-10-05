"use client";

import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { saveDeviceAction } from "../actions";

export interface DeviceValues {
  id?: string;
  asset_id?: string;
  type?: string;
  model?: string | null;
  serial_number?: string | null;
  os?: string | null;
  purchase_date?: string | null;
  warranty_until?: string | null;
  condition?: string;
  location?: string | null;
  mdm_provider?: string | null;
  mdm_reference?: string | null;
  notes?: string | null;
  name?: string | null;
  purchase_value?: number | null;
  currency?: string | null;
  vendor_id?: string | null;
  quantity?: number;
  min_quantity?: number | null;
  license_seats?: number | null;
  license_expiry?: string | null;
  license_account?: string | null;
  next_maintenance_date?: string | null;
}

type O = { value: string; label: string };

export function DeviceForm({ initial = {}, vendors = [] }: { initial?: DeviceValues; vendors?: O[] }) {
  return (
    <ActionForm action={saveDeviceAction.bind(null, initial.id ?? null)} successMessage="تم الحفظ">
      <div className="bos-form-grid">
        <TextField name="asset_id" label="رقم الأصل" required placeholder="TS-MAC-001" dir="ltr" defaultValue={initial.asset_id ?? ""} />
        <SelectField name="type" label="النوع" options={[{ value: "laptop", label: "لابتوب" }, { value: "desktop", label: "كمبيوتر مكتبي" }, { value: "monitor", label: "شاشة" }, { value: "mobile", label: "هاتف" }, { value: "tablet", label: "تابلت" }, { value: "headset", label: "سماعة" }, { value: "office_equipment", label: "معدات مكتبية" }, { value: "software_license", label: "ترخيص برنامج" }, { value: "loanable", label: "أصل للإعارة" }, { value: "spare_part", label: "قطع غيار ومخزون" }, { value: "other", label: "أخرى" }]} defaultValue={initial.type ?? "laptop"} />
        <TextField name="name" label="الاسم" placeholder="Adobe Creative Cloud / طابعة المكتب" defaultValue={initial.name ?? ""} />
        <TextField name="model" label="الموديل" placeholder="MacBook Pro 14" defaultValue={initial.model ?? ""} />
        <TextField name="serial_number" label="الرقم التسلسلي" dir="ltr" defaultValue={initial.serial_number ?? ""} />
        <TextField name="os" label="نظام التشغيل" defaultValue={initial.os ?? ""} />
        <SelectField name="condition" label="الحالة" options={[{ value: "new", label: "جديد" }, { value: "good", label: "جيد" }, { value: "fair", label: "مقبول" }, { value: "poor", label: "ضعيف" }, { value: "damaged", label: "تالف" }]} defaultValue={initial.condition ?? "good"} />
        <TextField name="purchase_date" label="تاريخ الشراء" type="date" defaultValue={initial.purchase_date ?? ""} />
        <TextField name="warranty_until" label="الضمان حتى" type="date" defaultValue={initial.warranty_until ?? ""} />
        <TextField name="location" label="الموقع" defaultValue={initial.location ?? ""} />
        <TextField name="mdm_provider" label="نظام إدارة الأجهزة (MDM)" hint="للتكامل إن وُجد — النظام ليس بديلاً عن MDM" defaultValue={initial.mdm_provider ?? ""} />
        <TextField name="mdm_reference" label="مرجع MDM" dir="ltr" defaultValue={initial.mdm_reference ?? ""} />
        <TextField name="purchase_value" label="قيمة الشراء" type="number" step="0.01" min={0} defaultValue={initial.purchase_value != null ? String(initial.purchase_value) : ""} />
        <TextField name="currency" label="العملة" dir="ltr" placeholder="EGP" defaultValue={initial.currency ?? ""} />
        {vendors.length ? <SelectField name="vendor_id" label="المورد" placeholder="—" options={vendors} defaultValue={initial.vendor_id ?? ""} /> : null}
        <TextField name="next_maintenance_date" label="الصيانة الدورية القادمة" type="date" defaultValue={initial.next_maintenance_date ?? ""} />
        <TextField name="quantity" label="الكمية (للمخزون)" type="number" min={0} defaultValue={String(initial.quantity ?? 1)} hint="لقطع الغيار والمخزون؛ الأجهزة = 1" />
        <TextField name="min_quantity" label="الحد الأدنى للمخزون" type="number" min={0} defaultValue={initial.min_quantity != null ? String(initial.min_quantity) : ""} />
        <TextField name="license_seats" label="عدد مقاعد الترخيص" type="number" min={1} defaultValue={initial.license_seats != null ? String(initial.license_seats) : ""} />
        <TextField name="license_expiry" label="انتهاء الترخيص" type="date" defaultValue={initial.license_expiry ?? ""} />
        <TextField name="license_account" label="حساب/رقم طلب الترخيص" hint="مرجع فقط — لا تكتب مفاتيح أو كلمات مرور" defaultValue={initial.license_account ?? ""} />
        <TextAreaField name="notes" label="ملاحظات" rows={2} defaultValue={initial.notes ?? ""} />
      </div>
      <div className="bos-form-actions"><SubmitButton label={initial.id ? "حفظ" : "إضافة الجهاز"} /></div>
    </ActionForm>
  );
}
