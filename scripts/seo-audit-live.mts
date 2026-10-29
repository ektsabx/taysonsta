// Read-only: audits every page of a site's sitemap with the Admin's page audit (D-265).
//   npx tsx scripts/seo-audit-live.mts https://www.yolias.com [out.json]
import { writeFileSync } from "node:fs";
import { auditPage, crossPageIssues, type PageAudit } from "../services/yolias/seo/page-audit";

const base = (process.argv[2] ?? "https://www.yolias.com").replace(/\/$/, "");
const xml = await (await fetch(`${base}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith(base));
const out: PageAudit[] = [];
let i = 0;
await Promise.all(Array.from({ length: 5 }, async () => {
  while (i < urls.length) {
    const u = urls[i++];
    const res = await fetch(u, { redirect: "manual", headers: { "user-agent": "YoliasAdminCrawler/1" } }).catch(() => null);
    if (res?.status === 200) out.push(auditPage(new URL(u).pathname, await res.text(), base));
  }
}));
const pages = crossPageIssues(out);
const count = new Map<string, number>();
for (const p of pages) for (const x of p.issues) count.set(x, (count.get(x) ?? 0) + 1);
console.log(`${urls.length} in sitemap, ${pages.length} audited, ${pages.filter((p) => !p.issues.length).length} without issues`);
console.log([...count.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join("\n"));
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(pages, null, 1));
