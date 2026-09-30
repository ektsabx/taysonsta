"use client";

import { Tx } from "@/components/bos/I18n";
import { ActionButton, ModalButton } from "@/components/bos/Dialog";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { checkCameraAction, saveCameraAction } from "./actions";

type O = { value: string; label: string };
export interface CameraValues { id: string; name: string; branch_id: string | null; location_label: string | null; connection_type: string; vendor: string | null; model: string | null; serial_number: string | null; viewer_url: string | null; status: string; allowed_role_ids: string[]; notice_displayed: boolean; notes: string | null }

export function CameraButton({ camera, branches, roles }: { camera?: CameraValues; branches: O[]; roles: O[] }) {
  return (
    <ModalButton label={camera ? "تعديل" : "+ كاميرا"} title={camera ? "تعديل الكاميرا" : "كاميرا جديدة"} className={camera ? "admin-btn small ghost" : "admin-btn small"}>
      {(close) => (
        <ActionForm action={saveCameraAction} onSuccess={close} successMessage="تم الحفظ">
          {camera ? <input type="hidden" name="id" value={camera.id} /> : null}
          <div className="bos-form-grid">
            <TextField name="name" label="الاسم" defaultValue={camera?.name ?? ""} required />
            <SelectField name="branch_id" label="الفرع" placeholder="—" options={branches} defaultValue={camera?.branch_id ?? ""} />
            <TextField name="location_label" label="الموقع داخل المكتب" defaultValue={camera?.location_label ?? ""} />
            <SelectField name="connection_type" label="نوع الاتصال" defaultValue={camera?.connection_type ?? "hls"} options={[{ value: "hls", label: "HLS (بث عبر https)" }, { value: "mjpeg", label: "MJPEG عبر https" }, { value: "rtsp", label: "RTSP (يحتاج بوابة)" }, { value: "onvif", label: "ONVIF (يحتاج بوابة)" }, { value: "vendor_cloud", label: "سحابة المصنّع" }, { value: "other", label: "أخرى" }]} />
            <TextField name="viewer_url" label="رابط العرض (https — بدون كلمات مرور)" dir="ltr" defaultValue={camera?.viewer_url ?? ""} hint="رابط HLS/MJPEG من سحابة المصنّع أو بوابة محلية، ويفضل رابطاً موقّعاً مؤقتاً" span="all" />
            <TextField name="vendor" label="المصنّع" defaultValue={camera?.vendor ?? ""} />
            <TextField name="model" label="الموديل" defaultValue={camera?.model ?? ""} />
            <TextField name="serial_number" label="الرقم التسلسلي" dir="ltr" defaultValue={camera?.serial_number ?? ""} />
            <SelectField name="status" label="الحالة" defaultValue={camera?.status ?? "active"} options={[{ value: "active", label: "مفعّلة" }, { value: "maintenance", label: "صيانة" }, { value: "disabled", label: "معطّلة" }]} />
            <TextAreaField name="notes" label="ملاحظات" rows={2} defaultValue={camera?.notes ?? ""} />
            <CheckboxField name="notice_displayed" label="يوجد إشعار واضح بالتصوير في المكان وسياسة استخدام معتمدة" defaultChecked={camera?.notice_displayed ?? false} />
          </div>
          <div className="bos-field" style={{ marginTop: 8 }}>
            <label><Tx>الأدوار المسموح لها بالمشاهدة (بدون اختيار = كل من لديه صلاحية المشاهدة)</Tx></label>
            <div className="bos-row" style={{ gap: 10, flexWrap: "wrap" }}>{roles.map((r) => <label key={r.value} className="bos-check"><input type="checkbox" name="allowed_role_ids[]" value={r.value} defaultChecked={camera?.allowed_role_ids.includes(r.value)} /> <Tx>{r.label}</Tx></label>)}</div>
          </div>
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function CheckButton({ id }: { id: string }) {
  return <ActionButton label="فحص الاتصال" className="admin-btn small ghost" action={() => checkCameraAction(id)} />;
}
