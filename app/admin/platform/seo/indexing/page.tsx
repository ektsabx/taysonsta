import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, StatusBadge, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { ActionForm, FormSection, SelectField, SubmitButton, TextField } from "@/components/bos/Form";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { SeoNotReady } from "@/components/yolias/SeoUi";
import { seoAudit } from "@/services/yolias/modules";
import { inspections, lastCrawl, seoReady } from "@/services/yolias/seo/indexing";
import { listRedirects } from "@/services/yolias/seo/catalog";
import { listSeoPages } from "@/services/yolias/seo/pages";
import { seoPath } from "@/lib/yolias/seo-pages";
import { saveRedirectAction, syncNowAction, toggleRedirectAction } from "../actions";

const issueLabel: Record<string, string> = {
  no_title: "بلا عنوان", long_title: "العنوان طويل", no_description: "بلا وصف", long_description: "الوصف طويل",
  no_h1: "بلا H1", many_h1: "أكثر من H1", wrong_lang: "لغة الصفحة خاطئة", duplicate_description: "وصف مكرر",
  no_canonical: "بلا رابط Canonical", canonical_other_domain: "Canonical على نطاق آخر", no_og_image: "بلا صورة مشاركة", noindex_on_public_page: "صفحة عامة عليها noindex",
  short_title: "العنوان قصير", duplicate_title: "عنوان مكرر", short_description: "الوصف قصير", canonical_not_self: "Canonical يشير لصفحة أخرى",
  no_hreflang: "بلا hreflang كامل", invalid_jsonld: "بيانات منظمة غير صالحة", no_jsonld: "بلا بيانات منظمة", thin: "محتوى قليل",
  not_arabic: "صفحة عربية نصها غير عربي", near_duplicate: "شبه مكررة", brand_spelling: "«يولـياس» بالتطويل",
};

// Crawling and indexing (D-257): a live check of each public page (title,
// description, H1, language, canonical, structured data), robots.txt and the
// sitemap, a crawl for broken internal links, redirects, and what Google's
// URL Inspection says. Nothing here promises indexing or a ranking.
export default async function SeoIndexingPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الفهرسة وخريطة الموقع" /><NotConnected /></>);
  if (!(await seoReady())) return (<><PageHeader title="الفهرسة وخريطة الموقع" /><SeoNotReady /></>);
  const manage = can(bos, "platform.manage", "all");
  const pages = await listSeoPages();
  const live = pages.filter((p) => p.status === "published" && p.seo?.robots !== "noindex").map((p) => seoPath(p.kind, p.slug));
  const [a, crawl, insp, redirects] = await Promise.all([seoAudit(live, { pages: false }), lastCrawl(), inspections(), listRedirects()]);
  if (!a.base) return (<><PageHeader title="الفهرسة وخريطة الموقع" /><EmptyState title="رابط موقع Yolias غير مضبوط" description="YOLIAS_SITE_URL" /></>);
  const audit = crawl?.audit ?? null;
  const withIssues = audit ? audit.filter((p) => p.issues.length).length : 0;
  const issueCounts = new Map<string, number>();
  for (const p of audit ?? []) for (const i of p.issues) issueCounts.set(i, (issueCounts.get(i) ?? 0) + 1);
  const unpublished = pages.filter((p) => p.status !== "published").length;
  return (
    <>
      <PageHeader title="الفهرسة وخريطة الموقع" subtitle={`فحص مباشر لموقع ${a.base}`} />
      <div className="bos-kpis">
        <KpiCard label="صفحات بلا مشاكل" value={audit ? `${num(audit.length - withIssues)} / ${num(audit.length)}` : "—"} sub={audit ? undefined : <Tx>شغّل فحص الموقع</Tx>} />
        <KpiCard label="robots.txt" value={a.robots ? <StatusBadge tone={a.robots.sitemap && a.robots.disallowsApp ? "success" : "warning"} label={a.robots.sitemap ? "سليم" : "بلا خريطة"} /> : <StatusBadge tone="danger" label="غير موجود" />} />
        <KpiCard label="خريطة الموقع" value={a.sitemapUrls == null ? <StatusBadge tone="danger" label="غير موجودة" /> : <Tx vars={{ n: num(a.sitemapUrls) }}>{"{n} رابط"}</Tx>} sub={a.sitemapOtherHosts ? <Tx vars={{ n: a.sitemapOtherHosts }}>{"{n} رابط على نطاق آخر"}</Tx> : undefined} />
        <KpiCard label="llms.txt" value={<StatusBadge tone={a.llms ? "success" : "warning"} label={a.llms ? "موجود" : "غير موجود"} />} />
        <KpiCard label="صفحات خاصة خارج الفهرسة" value={<StatusBadge tone={a.privateChecks.every((c) => c.noindex) ? "success" : "danger"} label={a.privateChecks.every((c) => c.noindex) ? "noindex سليم" : "تحتاج noindex"} />} />
        <KpiCard label="صفحات SEO منشورة" value={num(live.length)} sub={<Tx vars={{ n: num(unpublished) }}>{"{n} غير منشورة"}</Tx>} />
      </div>

      {/* Every page of the sitemap, from the last crawl (D-265): what each page says to search engines. */}
      <Card title="فحص محتوى الصفحات">
        {audit ? (
          <>
            <p className="bos-faint" style={{ fontSize: 12 }}><Tx vars={{ at: formatDateTime(crawl!.checkedAt), n: num(audit.length) }}>{"من آخر فحص للموقع ({at}): {n} صفحة."}</Tx></p>
            {issueCounts.size > 0 && <p style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{[...issueCounts.entries()].sort((x, y) => y[1] - x[1]).map(([i, n]) => <StatusBadge key={i} tone="warning" label={`${issueLabel[i] ?? i} · ${num(n)}`} />)}</p>}
            <div className="bos-table-scroll"><BosTable className="bos-table">
              <thead><tr><th><Tx>الصفحة</Tx></th><th><Tx>العنوان</Tx></th><th><Tx>الكلمات</Tx></th><th><Tx>المشاكل</Tx></th></tr></thead>
              <tbody>{audit.filter((p) => p.issues.length).slice(0, 200).map((p) => (
                <tr key={p.path}>
                  <td dir="ltr">{p.path}</td>
                  <td dir="auto" style={{ maxWidth: 280 }}>{p.title ?? "—"}{p.title && <span className="cell-sub">{p.title.length}</span>}</td>
                  <td className="bos-num">{num(p.words)}</td>
                  <td>{p.issues.map((i) => <StatusBadge key={i} tone="warning" label={i === "near_duplicate" && p.similar ? `${issueLabel[i]} (${p.similar.score}% ${p.similar.path})` : issueLabel[i] ?? i} />)}</td>
                </tr>
              ))}</tbody>
            </BosTable></div>
            <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>العنوان من 15 إلى 65 حرفًا، والوصف من 50 إلى 170، وعنوان H1 واحد، وCanonical يشير للصفحة نفسها، وhreflang للعربي والإنجليزي. «محتوى قليل»: أقل من 250 كلمة في الصفحات التجارية والمقالات فقط. «شبه مكررة»: 80% أو أكثر من النص مشترك مع صفحة أخرى بنفس اللغة.</Tx></p>
          </>
        ) : <EmptyState title="لم يُفحص الموقع بعد" description="اضغط «افحص الموقع الآن» في فحص الروابط الداخلية." />}
      </Card>

      <Card title="فحص الروابط الداخلية" actions={manage ? <ActionForm action={syncNowAction} successMessage="انتهى الفحص"><input type="hidden" name="source" value="crawl" /><SubmitButton label="افحص الموقع الآن" pendingLabel="جارٍ الفحص..." /></ActionForm> : undefined}>
        {crawl ? (
          <>
            <p className="bos-faint" style={{ fontSize: 12 }}><Tx vars={{ at: formatDateTime(crawl.checkedAt), n: num(crawl.pages.length), s: num(crawl.sitemap) }}>{"آخر فحص {at}: {n} صفحة من {s} في خريطة الموقع."}</Tx></p>
            {crawl.pages.filter((p) => p.status !== 200 || p.noindex).length > 0 && (
              <div className="bos-table-scroll"><BosTable className="bos-table"><thead><tr><th><Tx>صفحة في خريطة الموقع</Tx></th><th><Tx>الرد</Tx></th><th><Tx>noindex</Tx></th></tr></thead>
                <tbody>{crawl.pages.filter((p) => p.status !== 200 || p.noindex).map((p) => <tr key={p.path}><td dir="ltr">{p.path}</td><td>{p.status || "—"}</td><td>{p.noindex ? <StatusBadge tone="danger" label="noindex" /> : "—"}</td></tr>)}</tbody></BosTable></div>
            )}
            {crawl.broken.length ? (
              <div className="bos-table-scroll"><BosTable className="bos-table"><thead><tr><th><Tx>رابط معطل</Tx></th><th><Tx>في الصفحة</Tx></th><th><Tx>الرد</Tx></th></tr></thead>
                <tbody>{crawl.broken.map((b) => <tr key={`${b.from}>${b.to}`}><td dir="ltr">{b.to}</td><td dir="ltr">{b.from}</td><td>{b.status || "—"}</td></tr>)}</tbody></BosTable></div>
            ) : <p style={{ fontSize: 13 }}><StatusBadge tone="success" label="لا روابط معطلة" /></p>}
            {crawl.redirects.length > 0 && <p className="bos-faint" style={{ fontSize: 12 }}><Tx vars={{ n: num(crawl.redirects.length) }}>{"{n} رابط داخلي يمر بتحويل: الأفضل أن يشير مباشرة إلى الصفحة النهائية."}</Tx></p>}
          </>
        ) : <EmptyState title="لم يُفحص الموقع بعد" description="الفحص يفتح كل صفحات خريطة الموقع وكل رابط داخلي فيها (حتى 400 رابط)." />}
      </Card>

      <Card title="التحويلات (Redirects)">
        <p className="bos-faint" style={{ fontSize: 12 }}><Tx>للصفحات المدموجة أو التي تغيّر رابطها. تغيير رابط صفحة SEO منشورة يضيف تحويلًا تلقائيًا. تحويلات الكود الثابتة في next.config.ts.</Tx></p>
        {manage && (
          <ActionForm action={saveRedirectAction} successMessage="أُضيف التحويل" resetOnSuccess>
            <FormSection>
              <TextField name="from_path" label="من" dir="ltr" required placeholder="/compare/old-page" />
              <TextField name="to_path" label="إلى" dir="ltr" required placeholder="/compare/new-page" />
              <SelectField name="status_code" label="النوع" defaultValue="308" options={[{ value: "308", label: "دائم (308)" }, { value: "301", label: "دائم (301)" }, { value: "307", label: "مؤقت (307)" }]} />
              <TextField name="note" label="السبب" />
            </FormSection>
            <SubmitButton label="إضافة تحويل" />
          </ActionForm>
        )}
        {redirects.length ? (
          <div className="bos-table-scroll"><BosTable className="bos-table"><thead><tr><th><Tx>من</Tx></th><th><Tx>إلى</Tx></th><th><Tx>النوع</Tx></th><th><Tx>السبب</Tx></th><th><Tx>الحالة</Tx></th><th /></tr></thead>
            <tbody>{redirects.map((r) => (
              <tr key={r.id}>
                <td dir="ltr">{r.from_path}</td><td dir="ltr">{r.to_path}</td><td>{r.status_code}</td><td dir="auto">{r.note ?? "—"}</td>
                <td>{r.active ? <StatusBadge tone="success" label="يعمل" /> : <StatusBadge tone="neutral" label="موقوف" />}</td>
                <td>{manage && <ActionForm action={toggleRedirectAction} successMessage="تم"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="active" value={r.active ? "0" : "1"} /><SubmitButton label={r.active ? "إيقاف" : "تشغيل"} className="admin-btn secondary" /></ActionForm>}</td>
              </tr>
            ))}</tbody></BosTable></div>
        ) : <EmptyState title="لا توجد تحويلات" />}
      </Card>

      <Card title="حالة الفهرسة في Google">
        {insp.length ? (
          <div className="bos-table-scroll"><BosTable className="bos-table"><thead><tr><th><Tx>الرابط</Tx></th><th><Tx>النتيجة</Tx></th><th><Tx>التغطية</Tx></th><th><Tx>Canonical عند Google</Tx></th><th><Tx>آخر زحف</Tx></th><th><Tx>فُحص</Tx></th></tr></thead>
            <tbody>{insp.map((i) => (
              <tr key={i.url}>
                <td dir="ltr">{new URL(i.url).pathname}</td>
                <td><StatusBadge tone={i.verdict === "PASS" ? "success" : i.verdict === "FAIL" ? "danger" : "neutral"} label={i.verdict ?? "—"} /></td>
                <td dir="ltr" style={{ fontSize: 12 }}>{i.coverage_state ?? "—"}</td>
                <td dir="ltr" style={{ fontSize: 12 }}>{i.google_canonical && i.user_canonical && i.google_canonical !== i.user_canonical ? <StatusBadge tone="warning" label={new URL(i.google_canonical).pathname} /> : i.google_canonical ? new URL(i.google_canonical).pathname : "—"}</td>
                <td>{i.last_crawl_at ? formatDateTime(i.last_crawl_at) : "—"}</td>
                <td>{formatDateTime(i.checked_at)}</td>
              </tr>
            ))}</tbody></BosTable></div>
        ) : <EmptyState title="لا توجد نتائج" description="تأتي من URL Inspection في Search Console بعد ربطه (أسبوعيًا لصفحات SEO المنشورة، أو يدويًا من تكاملات SEO)." />}
      </Card>
    </>
  );
}
