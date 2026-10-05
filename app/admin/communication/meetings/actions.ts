"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/bos/auth";
import { assertCanAccess } from "@/lib/bos/access";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { db } from "@/lib/bos/db";
import { cancelMeeting, completeMeeting, scheduleMeeting } from "@/services/bos/meetings";
import { changeLeadStage } from "@/services/bos/leads";
import { getPipeline } from "@/services/bos/shared";

const list = z.preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(",") : []), z.array(z.string().trim()).default([]));

const meetingSchema = z.object({
  title: zf.required("العنوان", 300),
  lead_id: zf.optionalUuid(),
  deal_id: zf.optionalUuid(),
  client_id: zf.optionalUuid(),
  contact_id: zf.optionalUuid(),
  start_at: z.string().min(10, "الموعد مطلوب"),
  duration_minutes: zf.int(5, 600).default(30),
  meeting_link: zf.optionalUrl(),
  location: zf.optionalText(300),
  notes: zf.optionalText(10000),
  attendee_user_ids: list,
  attendee_contact_ids: list,
  attendee_emails: list,
  redirect_to_meeting: zf.checkbox().optional(),
});

export async function scheduleMeetingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let meetingId: string | null = null;
  let goToMeeting = false;
  const result = await handleAction("scheduleMeeting", async () => {
    const { bos } = await authorize("meetings.create");
    const v = parseForm(meetingSchema, formData);
    for (const [type, id] of [["lead", v.lead_id], ["deal", v.deal_id], ["client", v.client_id] ] as const) {
      if (id) await assertCanAccess(bos, type, id, "read");
    }
    const meeting = await scheduleMeeting(bos, {
      title: v.title,
      lead_id: v.lead_id,
      deal_id: v.deal_id,
      client_id: v.client_id,
      contact_id: v.contact_id,
      start_at: new Date(v.start_at).toISOString(),
      duration_minutes: v.duration_minutes,
      meeting_link: v.meeting_link ?? null,
      location: v.location ?? null,
      notes: v.notes ?? null,
      attendee_user_ids: v.attendee_user_ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)),
      attendee_contact_ids: v.attendee_contact_ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)),
      attendee_emails: v.attendee_emails,
    });
    // A discovery meeting on a qualified lead moves it to the Meeting stage.
    if (meeting.lead_id) {
      const { data: lead } = await db().from("leads").select("pipeline_stages!inner(key)").eq("id", meeting.lead_id).maybeSingle();
      const key = (lead?.pipeline_stages as unknown as { key: string } | undefined)?.key;
      if (key && ["new", "contacted", "replied", "qualified"].includes(key)) {
        const { stages } = await getPipeline("lead");
        const target = stages.find((s) => s.key === "meeting");
        if (target) await changeLeadStage(bos, meeting.lead_id, target.id, null);
      }
    }
    meetingId = meeting.id;
    goToMeeting = Boolean(v.redirect_to_meeting);
    revalidatePath("/admin/communication/meetings");
    if (v.lead_id) revalidatePath(`/admin/sales/leads/${v.lead_id}`);
    if (v.deal_id) revalidatePath(`/admin/sales/deals/${v.deal_id}`);
    return { ok: true, message: "تمت جدولة الاجتماع" };
  }, "تعذر جدولة الاجتماع.");
  if (result.ok && goToMeeting && meetingId) redirect(`/admin/communication/meetings/${meetingId}`);
  return result;
}

const outcomeSchema = z.object({
  outcome: zf.required("نتيجة الاجتماع", 5000),
  next_action: zf.optionalText(2000),
  notes: zf.optionalText(10000),
});

export async function completeMeetingAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("completeMeeting", async () => {
    const { bos } = await authorize("meetings.update");
    await assertCanAccess(bos, "meeting", id, "read");
    const v = parseForm(outcomeSchema, formData);
    await completeMeeting(bos, id, v.outcome, v.next_action ?? null, v.notes ?? null);
    revalidatePath(`/admin/communication/meetings/${id}`);
    return { ok: true, message: "تم تسجيل النتيجة وإنشاء مهمة المتابعة" };
  });
}

export async function cancelMeetingAction(id: string, status: "cancelled" | "no_show", reason?: string): Promise<ActionState> {
  return handleAction("cancelMeeting", async () => {
    const { bos } = await authorize("meetings.update");
    await assertCanAccess(bos, "meeting", id, "read");
    await cancelMeeting(bos, id, status, reason ?? null);
    revalidatePath(`/admin/communication/meetings/${id}`);
    return { ok: true };
  });
}
