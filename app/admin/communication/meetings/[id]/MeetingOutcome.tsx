"use client";

import { ActionForm, SubmitButton, TextAreaField } from "@/components/bos/Form";
import { ConfirmButton } from "@/components/bos/Dialog";
import { completeMeetingAction, cancelMeetingAction } from "../actions";

export function MeetingOutcomeForm({ meetingId, defaultNotes }: { meetingId: string; defaultNotes: string }) {
  return (
    <ActionForm action={completeMeetingAction.bind(null, meetingId)} successMessage="تم تسجيل النتيجة">
      <div className="bos-form-grid">
        <TextAreaField name="outcome" label="النتيجة" required placeholder="ما الذي تم الاتفاق عليه؟" />
        <TextAreaField name="next_action" label="الإجراء التالي" placeholder="سيُنشئ النظام مهمة متابعة تلقائياً" />
        <TextAreaField name="notes" label="ملاحظات الاجتماع" defaultValue={defaultNotes} />
      </div>
      <div className="bos-form-actions">
        <SubmitButton label="حفظ النتيجة وإنشاء المتابعة" />
      </div>
    </ActionForm>
  );
}

export function MeetingCancelButtons({ meetingId }: { meetingId: string }) {
  return (
    <>
      <ConfirmButton label="لم يحضر العميل" className="admin-btn small ghost" message="تسجيل الاجتماع كـ (لم يحضر)؟" requireReason reasonLabel="ملاحظة" action={(reason) => cancelMeetingAction(meetingId, "no_show", reason)} />
      <ConfirmButton label="إلغاء الاجتماع" className="admin-btn small danger" message="إلغاء هذا الاجتماع؟" requireReason action={(reason) => cancelMeetingAction(meetingId, "cancelled", reason)} />
    </>
  );
}
