import { requirePortalSection } from "@/lib/bos/portal-auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { portalProjects } from "@/services/bos/portal";
import { PTop } from "../../ui";
import { PortalForm } from "../../PortalControls";
import { portalCreateTicketAction } from "../../actions";

export default async function PortalNewTicketPage({ searchParams }: { searchParams: SearchParams }) {
  const p = await requirePortalSection("support");
  const sp = await readParams(searchParams);
  const projects = await portalProjects(p);
  return (
    <>
      <PTop title="تذكرة دعم جديدة" />
      <div className="portal-card" style={{ maxWidth: 700 }}>
        <PortalForm action={portalCreateTicketAction} submit="إرسال التذكرة">
          <div className="field"><label htmlFor="subject">الموضوع</label><input id="subject" name="subject" required maxLength={300} /></div>
          <div className="field"><label htmlFor="project_id">المشروع</label><select id="project_id" name="project_id" defaultValue={sp.project ?? ""}><option value="">— عام —</option>{projects.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}</select></div>
          <div className="field"><label htmlFor="category">التصنيف</label><select id="category" name="category" defaultValue="general"><option value="general">عام</option><option value="technical">تقني</option><option value="billing">مالي</option><option value="access">وصول / حساب</option><option value="content">محتوى</option></select></div>
          <div className="field"><label htmlFor="priority">الأولوية</label><select id="priority" name="priority" defaultValue="medium"><option value="low">منخفضة</option><option value="medium">متوسطة</option><option value="high">عالية</option><option value="urgent">عاجلة</option></select></div>
          <div className="field"><label htmlFor="description">الوصف</label><textarea id="description" name="description" rows={6} required /></div>
        </PortalForm>
      </div>
    </>
  );
}
