"use client";

import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { Tx } from "@/components/bos/I18n";
import { saveListingAction, saveOwnPixelAction } from "./actions";

export function ListingForm({ k, addon, shots, version, storeUrl, downloadUrl }: { k: string; addon: boolean; shots: string[]; version: string; storeUrl: string; downloadUrl: string }) {
  return (
    <ActionForm action={saveListingAction} successMessage="تم الحفظ" guardUnsaved={false} className="bos-form">
      <input type="hidden" name="key" value={k} />
      {shots.length > 0 && (
        <div className="bos-field">
          <label><Tx>الصور الحالية (حدد ما تريد حذفه)</Tx></label>
          <div className="app-shot-list">
            {shots.map((u) => (
              <label key={u} className="app-shot-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" />
                <span><input type="checkbox" name="remove" value={u} /> <Tx>حذف</Tx></span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="bos-field"><label htmlFor={`img-${k}`}><Tx>إضافة صور (PNG أو JPG أو WEBP حتى 8 ميجا)</Tx></label><input id={`img-${k}`} name="images" type="file" multiple accept="image/png,image/jpeg,image/webp" /></div>
      {addon && (
        <>
          <div className="bos-field"><label htmlFor={`v-${k}`}><Tx>رقم الإصدار</Tx></label><input id={`v-${k}`} name="version" defaultValue={version} dir="ltr" placeholder="1.0.1" /></div>
          <div className="bos-field"><label htmlFor={`s-${k}`}><Tx>رابط Chrome Web Store</Tx></label><input id={`s-${k}`} name="store_url" type="url" defaultValue={storeUrl} dir="ltr" placeholder="https://chromewebstore.google.com/detail/..." /></div>
          <div className="bos-field"><label htmlFor={`z-${k}`}><Tx>نسخة جديدة من الإضافة (ZIP حتى 25 ميجا)</Tx></label><input id={`z-${k}`} name="zip" type="file" accept=".zip" />{downloadUrl ? <a href={downloadUrl} dir="ltr" className="cell-sub"><Tx>النسخة الحالية</Tx></a> : null}</div>
        </>
      )}
      <SubmitButton label="حفظ" pendingLabel="..." className="admin-btn small app-save" />
    </ActionForm>
  );
}

export function OwnPixelForm({ value }: { value: string }) {
  return (
    <ActionForm action={saveOwnPixelAction} successMessage="تم الحفظ" guardUnsaved={false} className="bos-form">
      <div className="bos-field"><label htmlFor="own-pixel"><Tx>رقم البيكسل من مدير الأحداث في حسابك على يولياس</Tx></label><input id="own-pixel" name="public_id" defaultValue={value} dir="ltr" maxLength={16} /></div>
      <SubmitButton label="حفظ" pendingLabel="..." className="admin-btn small app-save" />
    </ActionForm>
  );
}
