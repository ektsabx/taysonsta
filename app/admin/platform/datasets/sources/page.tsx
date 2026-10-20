import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KeyValues } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { DatasetsNotReady, NotConnected, connected } from "@/components/yolias/PlatformUi";
import { datasetsReady } from "@/services/yolias/datasets";
import { resolveConnection } from "@/services/bos/integrations";
import { CommonCrawlForm, CompaniesHouseForm, OsmForm, SireneForm } from "./SourceForms";

// Open sources for the companies database (D-248). Each pull becomes a
// dataset with the source's licence filled in, then goes through the same
// cleaning, matching and report as a bought file.
export default async function OpenSourcesPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="المصادر المفتوحة" /><NotConnected /></>);
  if (!(await datasetsReady())) return (<><PageHeader title="المصادر المفتوحة" /><DatasetsNotReady /></>);
  const manage = can(bos, "platform.manage", "all");
  const ch = await resolveConnection("companies_house").catch(() => null);
  const licence = (name: string, use: string) => <KeyValues items={[{ label: "الترخيص", value: name }, { label: "الاستخدام", value: <Tx>{use}</Tx> }]} />;
  return (
    <>
      <PageHeader title="المصادر المفتوحة" subtitle="سحب شركات من مصادر مجانية ومفتوحة الترخيص إلى قاعدة البيانات المشتركة. كل سحبة تظهر في «البيانات المستوردة» بتقريرها، ويمكن حذفها بالمصدر." />

      <Card title="OpenStreetMap">
        <p className="bos-faint"><Tx>أنشطة ومكاتب ومتاجر على الخريطة بأسمائها ومواقعها وهواتفها، في أي دولة. أفضل مصدر مجاني للأنشطة المحلية في مصر والخليج.</Tx></p>
        {licence("ODbL 1.0 · © OpenStreetMap contributors", "مسموح للعملاء مع ذكر المصدر.")}
        {manage && <div style={{ marginTop: 12 }}><OsmForm /></div>}
      </Card>

      <Card title="فرنسا: Sirene (INSEE)">
        <p className="bos-faint"><Tx>السجل الرسمي لكل الشركات الفرنسية النشطة: الاسم القانوني ورقم SIREN والعنوان والنشاط وحجم الموظفين. بدون مفتاح. لا يحتوي مواقع أو بريد، فيفيد في المطابقة والتحقق، ولا يظهر للعملاء إلا لو اتعرف موقع الشركة من مصدر تاني.</Tx></p>
        {licence("Licence Ouverte 2.0 (Etalab)", "مسموح للعملاء مع ذكر المصدر.")}
        {manage && <div style={{ marginTop: 12 }}><SireneForm /></div>}
      </Card>

      <Card title="بريطانيا: Companies House">
        <p className="bos-faint"><Tx>السجل الرسمي للشركات البريطانية النشطة حسب النشاط (SIC) والمدينة. مجاني بمفتاح.</Tx></p>
        {licence("Open Government Licence v3.0", "مسموح للعملاء مع ذكر المصدر.")}
        {!ch && <p className="bos-hint"><Tx>المفتاح غير مضاف بعد.</Tx> <Link className="bos-link" href="/admin/settings/integrations?tab=connections&cat=data"><Tx>أضفه من مركز التكاملات</Tx></Link></p>}
        {manage && <div style={{ marginTop: 12 }}><CompaniesHouseForm /></div>}
      </Card>

      <Card title="Common Crawl + زاحف يولياس">
        <p className="bos-faint"><Tx>قائمة المواقع المنشورة تحت امتداد معين (مثل com.eg) من فهرس Common Crawl، ثم يقرأ زاحفنا كل موقع ويسجل الاسم والوصف والبريد والهاتف والحسابات المنشورة عليه.</Tx></p>
        {licence("Common Crawl Terms of Use", "حقائق منشورة على مواقع الشركات نفسها.")}
        {manage && <div style={{ marginTop: 12 }}><CommonCrawlForm /></div>}
        <p className="bos-hint"><Tx>عندك قائمة دومينات من أي مصدر؟ استوردها كملف من «استيراد بيانات» (عمود واحد للموقع) وفعّل الإثراء.</Tx></p>
      </Card>

      <Card title="Foursquare Open Source Places">
        <p className="bos-faint"><Tx>أكثر من 100 مليون مكان حول العالم بالاسم والتصنيف والعنوان والهاتف والموقع. يُنشر كملفات Parquet ضخمة، فيُستورد كملف:</Tx></p>
        <ol className="bos-faint" style={{ paddingInlineStart: 18, lineHeight: 1.9 }}>
          <li><Tx>سجّل في Hugging Face واقبل شروط مجموعة foursquare/fsq-os-places.</Tx></li>
          <li><Tx>صدّر دولة واحدة إلى CSV بـ DuckDB، مثال: select name, website, email, tel, locality, address, fsq_category_labels from read_parquet(…) where country = 'EG'.</Tx></li>
          <li><Tx>ارفع الملف من «استيراد بيانات» بنوع «بيانات مفتوحة» والترخيص Apache 2.0، وفعّل «مسموح عرضها للعملاء».</Tx></li>
        </ol>
        {licence("Apache 2.0 · Foursquare", "مسموح للعملاء مع ذكر المصدر.")}
      </Card>
    </>
  );
}
