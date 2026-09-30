"use client";

import { Tx } from "@/components/bos/I18n";

import { ActionForm, SubmitButton, TextAreaField, TextField, SelectField } from "@/components/bos/Form";
import { ModalButton } from "@/components/bos/Dialog";
import { scheduleMeetingAction } from "@/app/admin/communication/meetings/actions";
import type { RelatedIds } from "@/components/bos/ActivityComposer";

export function MeetingFields({
  related,
  staff,
  contacts = [],
  defaultTitle,
  onDone,
  redirectToMeeting,
}: {
  related: RelatedIds;
  staff: { value: string; label: string }[];
  contacts?: { value: string; label: string }[];
  defaultTitle?: string;
  onDone?: () => void;
  redirectToMeeting?: boolean;
}) {
  return (
    <ActionForm action={scheduleMeetingAction} onSuccess={onDone} guardUnsaved={false}>
      {Object.entries(related).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {redirectToMeeting ? <input type="hidden" name="redirect_to_meeting" value="on" /> : null}
      <div className="bos-form-grid">
        <TextField name="title" label="عنوان الاجتماع" required defaultValue={defaultTitle ?? ""} span="all" />
        <TextField name="start_at" label="الموعد" type="datetime-local" required />
        <SelectField
          name="duration_minutes"
          label="المدة"
          options={[15, 30, 45, 60, 90, 120].map((m) => ({ value: String(m), label: `${m} دقيقة` }))}
          defaultValue="30"
        />
        <TextField name="meeting_link" label="رابط الاجتماع" placeholder="https://meet.google.com/..." />
        <TextField name="location" label="المكان (اختياري)" />
        <div className="bos-field span-2">
          <label htmlFor="f-attendee_user_ids"><Tx>حضور من الفريق</Tx></label>
          <select id="f-attendee_user_ids" name="attendee_user_ids[]" multiple size={Math.min(5, Math.max(2, staff.length))}>
            {staff.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="bos-hint"><Tx>اضغط Ctrl/⌘ لاختيار أكثر من شخص</Tx></span>
        </div>
        {contacts.length ? (
          <div className="bos-field span-2">
            <label htmlFor="f-attendee_contact_ids"><Tx>حضور من العميل</Tx></label>
            <select id="f-attendee_contact_ids" name="attendee_contact_ids[]" multiple size={Math.min(4, Math.max(2, contacts.length))}>
              {contacts.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <TextField name="attendee_emails" label="بريد حضور خارجيين (مفصول بفواصل)" span="all" />
        <TextAreaField name="notes" label="جدول الأعمال / ملاحظات" />
      </div>
      <div className="bos-form-actions">
        <SubmitButton label="جدولة الاجتماع" />
      </div>
    </ActionForm>
  );
}

export function MeetingScheduler(props: { related: RelatedIds; staff: { value: string; label: string }[]; contacts?: { value: string; label: string }[]; defaultTitle?: string; label?: string; className?: string }) {
  return (
    <ModalButton label={props.label ?? "جدولة اجتماع"} title="جدولة اجتماع" className={props.className ?? "admin-btn small secondary"} wide>
      {(close) => <MeetingFields {...props} onDone={close} />}
    </ModalButton>
  );
}
