// The first keyword plan (D-257). Intent and the page that serves each
// keyword come from what the searcher wants and what Yolias does today.
// No search volume or difficulty: no keyword data provider is connected, and
// a number without a source would be a guess shown as data.

type K = { keyword: string; locale?: "en" | "ar"; intent: "informational" | "commercial" | "comparison" | "transactional" | "navigational"; cluster: string; page_type: "compare" | "alternatives" | "solution" | "template" | "use_case" | "blog" | "core"; priority: 1 | 2 | 3; stage: "idea" | "planned" | "writing" | "review" | "published"; target_path?: string; notes?: string; related?: string[] };

const vs = (name: string, slug: string, related: string[] = []): K => ({ keyword: `yolias vs ${name.toLowerCase()}`, intent: "comparison", cluster: slug, page_type: "compare", priority: 2, stage: "review", target_path: `/compare/${slug}`, related: [`${name.toLowerCase()} vs yolias`, ...related], notes: "Branded comparison: low volume until Yolias is known, high intent when searched." });

export const keywords: K[] = [
  // Comparisons and alternatives
  { keyword: "apollo alternatives", intent: "comparison", cluster: "apollo", page_type: "alternatives", priority: 1, stage: "review", target_path: "/alternatives/apollo", related: ["apollo.io alternatives", "alternatives to apollo io", "apollo io competitors", "cheaper apollo alternative"] },
  { keyword: "clay alternatives", intent: "comparison", cluster: "clay", page_type: "alternatives", priority: 1, stage: "review", target_path: "/alternatives/clay", related: ["clay.com alternatives", "clay competitors", "clay alternative for agencies"] },
  { keyword: "zoominfo alternatives", intent: "comparison", cluster: "zoominfo", page_type: "alternatives", priority: 2, stage: "review", target_path: "/alternatives/zoominfo", related: ["zoominfo competitors", "cheaper zoominfo alternative", "zoominfo alternative for small business"] },
  { keyword: "instantly alternatives", intent: "comparison", cluster: "instantly", page_type: "alternatives", priority: 3, stage: "idea", notes: "Searchers want another cold email sender; Yolias is a fit only for those who also need to find the companies. Write only if Search Console shows demand." },
  { keyword: "lusha alternatives", intent: "comparison", cluster: "lusha", page_type: "alternatives", priority: 3, stage: "idea", notes: "Searchers want contact data (phones, emails). Yolias doesn't promise personal contacts: a page would mostly list other data tools. Hold." },
  vs("Apollo", "apollo", ["apollo io vs yolias"]),
  vs("Clay", "clay"),
  vs("ZoomInfo", "zoominfo"),
  vs("Lusha", "lusha"),
  vs("Cognism", "cognism"),
  vs("Instantly", "instantly"),
  vs("Smartlead", "smartlead"),
  vs("Hunter", "hunter", ["hunter io vs yolias"]),
  { keyword: "best lead generation tools", intent: "commercial", cluster: "lists", page_type: "compare", priority: 1, stage: "review", target_path: "/compare/best-lead-generation-tools", related: ["lead generation software", "best b2b lead generation tools", "best b2b prospecting tools", "lead generation tools for agencies"], notes: "Also serves 'best b2b prospecting tools' (same intent): one page, no second page for it." },
  { keyword: "best ai sales agents", intent: "commercial", cluster: "lists", page_type: "compare", priority: 2, stage: "planned", related: ["ai sdr tools", "ai sales agent software", "ai sdr"], notes: "Needs the AI SDR tools (11x, Artisan, AiSDR…) reviewed in Competitors first; with only the eight reviewed tools the list would be thin." },
  { keyword: "best b2b prospecting tools", intent: "commercial", cluster: "lists", page_type: "compare", priority: 2, stage: "planned", target_path: "/compare/best-lead-generation-tools", notes: "Same intent as best lead generation tools: secondary keyword of that page." },

  // Agencies and service businesses (audience pages under /solutions)
  { keyword: "lead generation for marketing agencies", intent: "commercial", cluster: "agencies", page_type: "solution", priority: 1, stage: "published", target_path: "/solutions/marketing-agencies", notes: "Served by the existing marketing agencies solution page (code). Don't create a second page." , related: ["how to get clients for marketing agency", "prospecting software for marketing agencies", "ai sales tools for marketing agencies"] },
  { keyword: "lead generation for web design agencies", intent: "commercial", cluster: "agencies", page_type: "solution", priority: 1, stage: "review", target_path: "/solutions/web-design-agencies", related: ["how to get web design clients", "find web design clients", "web design leads"] },
  { keyword: "lead generation for web development agencies", intent: "commercial", cluster: "agencies", page_type: "solution", priority: 2, stage: "published", target_path: "/solutions/software-agencies", notes: "Served by the software agencies solution page (code)." },
  { keyword: "prospecting tools for seo agencies", intent: "commercial", cluster: "agencies", page_type: "solution", priority: 1, stage: "review", target_path: "/solutions/seo-agencies", related: ["how to get seo clients", "seo client acquisition", "find seo clients"] },
  { keyword: "client acquisition for digital agencies", intent: "commercial", cluster: "agencies", page_type: "solution", priority: 2, stage: "planned", target_path: "/solutions/marketing-agencies", notes: "Close to marketing agencies; use as a secondary keyword there rather than a new page." },
  { keyword: "lead generation for consulting firms", intent: "commercial", cluster: "agencies", page_type: "solution", priority: 2, stage: "published", target_path: "/solutions/consultants", notes: "Served by the consultants solution page (code)." },
  { keyword: "lead generation for it service providers", intent: "commercial", cluster: "agencies", page_type: "solution", priority: 1, stage: "review", target_path: "/solutions/it-services", related: ["msp lead generation", "it services lead generation", "how to get clients for it company"] },
  { keyword: "client acquisition tools for freelancers", intent: "commercial", cluster: "agencies", page_type: "solution", priority: 2, stage: "published", target_path: "/solutions/freelancers", notes: "Served by the freelancers solution page (code)." },
  { keyword: "lead generation for saas companies", intent: "commercial", cluster: "industries", page_type: "solution", priority: 2, stage: "review", target_path: "/solutions/saas", related: ["b2b saas lead generation", "saas outbound"] },
  { keyword: "ai sales agent for service businesses", intent: "commercial", cluster: "agencies", page_type: "solution", priority: 3, stage: "idea", notes: "Overlaps the home page and best AI sales agents. Wait for Search Console data." },
  { keyword: "lead generation for real estate companies", intent: "commercial", cluster: "industries", page_type: "solution", priority: 3, stage: "published", target_path: "/solutions/real-estate" },

  // Templates
  { keyword: "b2b prospecting templates", intent: "commercial", cluster: "templates", page_type: "template", priority: 2, stage: "planned", target_path: "/templates", notes: "The templates index page." },
  { keyword: "find companies by industry", intent: "informational", cluster: "templates", page_type: "template", priority: 2, stage: "review", target_path: "/templates/companies-by-industry", related: ["list of companies by industry", "how to find companies in a specific industry"] },
  { keyword: "find companies by location", intent: "informational", cluster: "templates", page_type: "template", priority: 2, stage: "review", target_path: "/templates/companies-by-location", related: ["find businesses in a city", "list of companies in my area"] },
  { keyword: "find companies by size", intent: "informational", cluster: "templates", page_type: "template", priority: 3, stage: "review", target_path: "/templates/companies-by-size", related: ["find companies by number of employees", "find small businesses", "find mid-size companies"] },
  { keyword: "find leads by job title", intent: "informational", cluster: "templates", page_type: "template", priority: 2, stage: "review", target_path: "/templates/leads-by-job-title", related: ["find people by job title", "find marketing managers at companies"], notes: "Close to /use-cases/find-decision-makers: the template is the hands-on version (titles by department), the use case explains the approach. Link both ways." },
  { keyword: "find companies matching your ideal customer profile", intent: "informational", cluster: "templates", page_type: "use_case", priority: 2, stage: "published", target_path: "/use-cases/icp-company-search", notes: "Served by the use case page (code). No template page for the same intent." },
  { keyword: "decision maker search", intent: "informational", cluster: "templates", page_type: "use_case", priority: 2, stage: "published", target_path: "/use-cases/find-decision-makers" },
  { keyword: "find potential customers for your business", intent: "informational", cluster: "templates", page_type: "use_case", priority: 2, stage: "published", target_path: "/use-cases/find-clients" },

  // Markets
  { keyword: "find companies in saudi arabia", intent: "informational", cluster: "markets", page_type: "template", priority: 1, stage: "review", target_path: "/templates/companies-in-saudi-arabia", related: ["b2b leads saudi arabia", "list of companies in riyadh", "saudi companies database"] },
  { keyword: "find companies in the uae", intent: "informational", cluster: "markets", page_type: "template", priority: 1, stage: "review", target_path: "/templates/companies-in-uae", related: ["b2b leads uae", "list of companies in dubai", "uae companies list"] },
  { keyword: "find businesses in egypt", intent: "informational", cluster: "markets", page_type: "template", priority: 1, stage: "review", target_path: "/templates/businesses-in-egypt", related: ["list of companies in egypt", "b2b leads egypt", "companies in cairo"] },
  { keyword: "find companies in the united kingdom", intent: "informational", cluster: "markets", page_type: "template", priority: 3, stage: "idea", notes: "Companies House is integrated as an open source; write when the owner wants the UK market." },
  { keyword: "find b2b leads in the united states", intent: "informational", cluster: "markets", page_type: "template", priority: 3, stage: "idea", notes: "Very competitive and not Yolias's first market. Hold." },

  // Arabic
  { keyword: "أداة للبحث عن عملاء", locale: "ar", intent: "commercial", cluster: "arabic", page_type: "core", priority: 2, stage: "idea", notes: "The site serves Arabic at the same URL by cookie, so search engines index the English version. Arabic keywords need Arabic URLs first (architecture decision, docs/20)." },
  { keyword: "كيف أجد عملاء لشركتي", locale: "ar", intent: "informational", cluster: "arabic", page_type: "use_case", priority: 2, stage: "idea", notes: "Same as above: needs indexable Arabic pages." },
];
