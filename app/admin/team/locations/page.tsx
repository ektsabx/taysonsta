import { Tx } from "@/components/bos/I18n";
import { can, requireBosUser } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getSetting } from "@/lib/bos/settings";
import { formatDateTime } from "@/lib/bos/format";
import { accessLog, locationStatus, viewLocations } from "@/services/bos/location";
import { googleMapsLink, osmEmbedUrl } from "@/lib/bos/location/geo";
import { PageHeader, Card, EmptyState, Tabs, StatusBadge } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { BranchGeoRow, ConsentCard, LocationSettings } from "./LocationControls";

const eventLabel: Record<string, string> = { clock_in: "تسجيل حضور", clock_out: "تسجيل انصراف", task_checkin: "وصول لمهمة" };

// Employee location (docs/bos/30 §28): consent and own history for every
// employee; map + timeline for authorised viewers (every view logged);
// settings, branch coordinates and the access log for location managers.
export default async function LocationsPage({ searchParams }: { searchParams: SearchParams }) {
  const bos = await requireBosUser();
  const sp = await readParams(searchParams);
  const viewer = can(bos, "location.read");
  const manager = can(bos, "location.manage");
  const tab = sp.tab === "team" && viewer ? "team" : sp.tab === "settings" && manager ? "settings" : sp.tab === "log" && manager ? "log" : "mine";
  const today = new Date().toISOString().slice(0, 10);
  const d = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = d(sp.from) ?? new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const to = d(sp.to) ?? today;
  const st = await locationStatus(bos);
  return (
    <>
      <PageHeader title="مشاركة الموقع" subtitle="تُسجّل فقط عند تسجيل الحضور/الانصراف وبموافقتك — لا تتبع مستمر" breadcrumbs={[{ label: "الفريق" }, { label: "مشاركة الموقع" }]} />
      <Tabs param="tab" active={tab} baseHref="/admin/team/locations" tabs={[{ key: "mine", label: "موقعي وموافقتي" }, { key: "team", label: "مواقع الفريق", hidden: !viewer }, { key: "settings", label: "الإعدادات", hidden: !manager }, { key: "log", label: "سجل الاطلاع", hidden: !manager }]} />
      {tab === "mine" ? <Mine bos={bos} st={st} from={from} to={to} /> : null}
      {tab === "team" ? <Team bos={bos} sp={sp} from={from} to={to} /> : null}
      {tab === "settings" ? <Settings /> : null}
      {tab === "log" ? <Log bos={bos} /> : null}
    </>
  );
}

type Bos = Awaited<ReturnType<typeof requireBosUser>>;

async function Mine({ bos, st, from, to }: { bos: Bos; st: Awaited<ReturnType<typeof locationStatus>>; from: string; to: string }) {
  const points = await viewLocations(bos, { employeeId: bos.employee.id, from, to });
  return (
    <>
      <Card title="الموافقة">
        {!st.enabled ? <p className="bos-hint" style={{ margin: 0 }}><Tx>ميزة الموقع غير مفعّلة في الشركة — لا يُسجّل أي موقع.</Tx></p> : (
          <>
            <p style={{ whiteSpace: "pre-wrap" }}>{st.purpose}</p>
            <p className="bos-faint" style={{ fontSize: 12 }}><Tx vars={{ n: String(st.retentionDays) }}>{"تُحذف السجلات تلقائياً بعد {n} يوماً. المتصفح سيطلب إذنك أيضاً، ويمكنك الرفض."}</Tx></p>
            <p><Tx>الحالة</Tx>: {st.consented ? <StatusBadge tone="success" label="موافق" /> : st.needsReconsent ? <StatusBadge tone="warning" label="تغيّر الغرض — مطلوب موافقة جديدة" /> : <StatusBadge tone="neutral" label="غير موافق" />}</p>
            <ConsentCard consented={st.consented} allowTasks={st.allowTasks} scope={st.consent?.scope ?? null} />
          </>
        )}
      </Card>
      <Card title="سجل مواقعي" flush>
        {points.length ? <PointsTable points={points} showEmployee={false} /> : <EmptyState title="لا توجد مواقع مسجلة" />}
      </Card>
    </>
  );
}

async function Team({ bos, sp, from, to }: { bos: Bos; sp: Record<string, string | undefined>; from: string; to: string }) {
  const [points, { data: emps }, { data: branches }] = await Promise.all([
    viewLocations(bos, { employeeId: sp.employee || null, branchId: sp.branch || null, from, to }),
    db().from("employees").select("id, full_name").is("archived_at", null).order("full_name"),
    db().from("branches").select("id, name").eq("status", "active").order("name"),
  ]);
  const map = osmEmbedUrl(points.map((p) => ({ lat: Number(p.latitude), lng: Number(p.longitude) })));
  return (
    <>
      <FilterBar filters={[
        { key: "employee", label: "الموظف", type: "select", options: (emps ?? []).map((e) => ({ value: e.id, label: e.full_name })) },
        { key: "branch", label: "الفرع", type: "select", options: (branches ?? []).map((b) => ({ value: b.id, label: b.name })) },
        { key: "from", label: "من", type: "date" }, { key: "to", label: "إلى", type: "date" },
      ]} />
      <Card><p className="bos-hint" style={{ margin: 0 }}><Tx>هذا الاطلاع مسجّل باسمك (من/متى/ماذا). المواقع موجودة فقط للموظفين الموافقين وعند أحداث العمل؛ عدم وجود نقطة يعني «غير متاح» وليس غياباً.</Tx></p></Card>
      {map ? <Card flush><iframe title="map" src={map} style={{ width: "100%", height: 360, border: 0 }} loading="lazy" referrerPolicy="no-referrer" /></Card> : null}
      <Card title="الخط الزمني" flush>{points.length ? <PointsTable points={points} showEmployee /> : <EmptyState title="غير متاح — لا توجد مواقع في هذه الفترة" />}</Card>
    </>
  );
}

function PointsTable({ points, showEmployee }: { points: Awaited<ReturnType<typeof viewLocations>>; showEmployee: boolean }) {
  return (
    <table className="bos-table" style={{ fontSize: 12.5 }}>
      <thead><tr><th><Tx>الوقت</Tx></th>{showEmployee ? <th><Tx>الموظف</Tx></th> : null}<th><Tx>الحدث</Tx></th><th><Tx>العنوان / الإحداثيات</Tx></th><th><Tx>الدقة</Tx></th><th><Tx>المسافة من الفرع</Tx></th></tr></thead>
      <tbody>{points.map((p) => (
        <tr key={p.id}>
          <td className="bos-nowrap">{formatDateTime(p.captured_at)}</td>
          {showEmployee ? <td>{(p.employees as unknown as { full_name: string } | null)?.full_name ?? "—"}</td> : null}
          <td><Tx>{eventLabel[p.event] ?? p.event}</Tx></td>
          <td>{p.address ? <span>{p.address} · </span> : null}<a href={googleMapsLink(Number(p.latitude), Number(p.longitude))} target="_blank" rel="noreferrer noopener" dir="ltr">{Number(p.latitude).toFixed(5)}, {Number(p.longitude).toFixed(5)}</a></td>
          <td className="bos-num">{p.accuracy_m != null ? `±${p.accuracy_m} m` : "—"}</td>
          <td className="bos-num">{p.distance_to_branch_m != null ? `${p.distance_to_branch_m} m` : <span className="bos-faint"><Tx>غير متاح</Tx></span>}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

async function Settings() {
  const [cfg, { data: branches }] = await Promise.all([getSetting("location"), db().from("branches").select("id, name, latitude, longitude, geofence_m").eq("status", "active").order("name")]);
  return (
    <>
      <Card title="إعدادات الموقع"><LocationSettings initial={{ enabled: cfg.enabled, purpose_text: cfg.purpose_text, retention_days: cfg.retention_days, allow_task_checkins: cfg.allow_task_checkins }} /><p className="bos-hint"><Tx>تغيير نص الغرض يطلب موافقة جديدة من كل موظف. تأكد من توافق الاستخدام مع قوانين العمل وحماية البيانات في بلدك.</Tx></p></Card>
      <Card title="إحداثيات الفروع (لحساب المسافة)" flush>
        <table className="bos-table"><thead><tr><th><Tx>الفرع</Tx></th><th><Tx>خط العرض</Tx></th><th><Tx>خط الطول</Tx></th><th><Tx>النطاق (متر)</Tx></th><th /></tr></thead>
          <tbody>{(branches ?? []).map((b) => <BranchGeoRow key={b.id} id={b.id} name={b.name} lat={b.latitude != null ? Number(b.latitude) : null} lng={b.longitude != null ? Number(b.longitude) : null} fence={b.geofence_m} />)}</tbody>
        </table>
      </Card>
    </>
  );
}

async function Log({ bos }: { bos: Bos }) {
  const rows = await accessLog(bos);
  const { data: viewers } = await db().from("employees").select("user_id, full_name").in("user_id", [...new Set(rows.map((r) => r.viewer_user_id))].concat(["00000000-0000-0000-0000-000000000000"]));
  const name = new Map((viewers ?? []).map((v) => [v.user_id, v.full_name]));
  return (
    <Card title="من اطّلع على مواقع الموظفين" flush>
      {rows.length ? <table className="bos-table" style={{ fontSize: 12.5 }}><thead><tr><th><Tx>الوقت</Tx></th><th><Tx>المطّلع</Tx></th><th><Tx>الموظف</Tx></th><th><Tx>الفترة</Tx></th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td className="bos-nowrap">{formatDateTime(r.viewed_at)}</td><td>{name.get(r.viewer_user_id) ?? "—"}</td><td>{(r.employees as { full_name: string } | null)?.full_name ?? <Tx>الكل</Tx>}</td><td dir="ltr">{r.period}</td></tr>)}</tbody></table> : <EmptyState title="لا يوجد اطلاع مسجل" />}
    </Card>
  );
}
