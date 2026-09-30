import { requirePortalSection } from "@/lib/bos/portal-auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { portalProjects } from "@/services/bos/portal";
import { PTop } from "../../ui";
import { PortalForm } from "../../PortalControls";
import { portalCreateChangeRequestAction } from "../../actions";

export default async function NewPortalCRPage({ searchParams }: { searchParams: SearchParams }) {
  const p = await requirePortalSection("change_requests");
  const sp = await readParams(searchParams);
  const projects = (await portalProjects(p)).filter((x) => !["cancelled"].includes(x.status));
  return (
    <>
      <PTop title="طلب تغيير جديد" />
      <div className="portal-card" style={{ maxWidth: 700 }}>
        <PortalForm action={portalCreateChangeRequestAction} submit="إرسال الطلب">
          <div className="field"><label htmlFor="project_id">المشروع</label><select id="project_id" name="project_id" required defaultValue={sp.project ?? ""}><option value="" disabled>اختر...</option>{projects.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}</select></div>
          <div className="field"><label htmlFor="title">العنوان</label><input id="title" name="title" required maxLength={200} /></div>
          <div className="field"><label htmlFor="description">الوصف</label><textarea id="description" name="description" rows={5} required /></div>
          <div className="field"><label htmlFor="reason">السبب</label><textarea id="reason" name="reason" rows={2} /></div>
          <p className="portal-muted">سيقيّم مدير المشروع التكلفة والمدة الإضافية، ثم يُطلب منك الموافقة قبل التنفيذ.</p>
        </PortalForm>
      </div>
    </>
  );
}
