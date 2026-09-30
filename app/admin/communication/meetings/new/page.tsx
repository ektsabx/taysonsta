import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { listActiveStaff } from "@/services/bos/shared";
import { PageHeader } from "@/components/bos/ui";
import { MeetingFields } from "@/components/bos/MeetingScheduler";

export default async function NewMeetingPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("meetings.create");
  const sp = await readParams(searchParams);
  const staff = await listActiveStaff();
  return (
    <>
      <PageHeader title="جدولة اجتماع" breadcrumbs={[{ label: "الاجتماعات", href: "/admin/communication/meetings" }, { label: "جديد" }]} />
      <section className="bos-form-section">
        <MeetingFields
          related={{ lead_id: sp.leadId, deal_id: sp.dealId, client_id: sp.clientId, project_id: sp.projectId, contact_id: sp.contactId }}
          staff={staff.map((s) => ({ value: s.userId, label: s.name }))}
          redirectToMeeting
        />
      </section>
    </>
  );
}
