-- D-277 (owner, 2026-11-03): GEO tracking. Every week the same questions
-- buyers ask go to ChatGPT (OpenAI), Gemini and Perplexity through their
-- APIs; each answer is stored with whether Yolias is mentioned, whether it is
-- the first recommendation, whether yolias.com is cited, and which
-- competitors (seo_competitors) appear. Yolias Admin → SEO → AI visibility.
-- Server only: RLS on, no policies.

create table public.geo_prompts (
  id uuid primary key default gen_random_uuid(),
  text text not null check (length(text) between 5 and 500),
  lang text not null default 'en' check (lang in ('en', 'ar')),
  topic text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.geo_prompts enable row level security;

create table public.geo_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'done')),
  engines text[] not null default '{}',
  total int not null default 0,
  trigger text not null default 'weekly' check (trigger in ('weekly', 'manual'))
);
alter table public.geo_runs enable row level security;
create index geo_runs_started on public.geo_runs (started_at desc);

create table public.geo_answers (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.geo_runs (id) on delete cascade,
  prompt_id uuid not null references public.geo_prompts (id) on delete cascade,
  engine text not null check (engine in ('openai', 'gemini', 'perplexity')),
  status text not null default 'pending' check (status in ('pending', 'working', 'done', 'failed')),
  attempts int not null default 0,
  claimed_at timestamptz,
  answer text,
  mentioned boolean,
  first_pick boolean,
  cited boolean,
  -- brands in the order they first appear: ["HubSpot", "Yolias", …]
  brands jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  error text,
  answered_at timestamptz,
  unique (run_id, prompt_id, engine)
);
alter table public.geo_answers enable row level security;
create index geo_answers_pending on public.geo_answers (run_id) where status in ('pending', 'working');

insert into public.geo_prompts (text, lang, topic) values
  ('What is the best AI tool to book B2B sales meetings?', 'en', 'meetings'),
  ('Best AI SDR software in 2026', 'en', 'ai-sdr'),
  ('Which platform finds decision makers at target companies and emails them automatically?', 'en', 'outbound'),
  ('Alternatives to Apollo.io for outbound sales', 'en', 'alternatives'),
  ('Alternatives to Outreach and Salesloft for small sales teams', 'en', 'alternatives'),
  ('How can a small B2B company get more sales meetings without hiring SDRs?', 'en', 'meetings'),
  ('Best cold email software that writes personalized emails with AI', 'en', 'cold-email'),
  ('AI tool that answers prospect replies and books meetings on my calendar', 'en', 'meetings'),
  ('Best lead generation tool for B2B companies in the Middle East', 'en', 'mena'),
  ('Best outbound sales platform for agencies', 'en', 'agencies'),
  ('Which AI sales agent works in Arabic and English?', 'en', 'arabic'),
  ('Pay as you go AI outbound tool for startups', 'en', 'pricing'),
  ('How do I reach CEOs of companies in Saudi Arabia by email?', 'en', 'mena'),
  ('Best tool to find B2B customers by industry, city and job title', 'en', 'targeting'),
  ('AI platform that runs outbound campaigns like an ads manager', 'en', 'outbound'),
  ('What is an AI SDR and which one should I use?', 'en', 'ai-sdr'),
  ('Best software to generate qualified B2B leads in Egypt', 'en', 'mena'),
  ('Which tools measure cost per meeting for outbound campaigns?', 'en', 'results'),
  ('ما أفضل أداة ذكاء اصطناعي لحجز اجتماعات مبيعات مع الشركات؟', 'ar', 'meetings'),
  ('أفضل منصة للحصول على عملاء B2B في السعودية', 'ar', 'mena'),
  ('أفضل برنامج تسويق بالبريد الإلكتروني للشركات بالذكاء الاصطناعي', 'ar', 'cold-email'),
  ('كيف أصل إلى مديري الشركات في الإمارات وأحجز معهم اجتماعات؟', 'ar', 'mena'),
  ('بديل Apollo يدعم اللغة العربية', 'ar', 'alternatives'),
  ('أفضل أداة لتوليد العملاء المحتملين للشركات في مصر', 'ar', 'mena'),
  ('ما هو موظف المبيعات الذكي AI SDR وما أفضل منصة له؟', 'ar', 'ai-sdr'),
  ('منصة ذكاء اصطناعي تكتب رسائل البيع وترد على العملاء بالعربية', 'ar', 'arabic'),
  ('كيف تحصل شركة ناشئة على عملاء من الشركات بدون فريق مبيعات؟', 'ar', 'meetings'),
  ('أفضل منصة إعلانات للشركات تدفع فيها مقابل النتائج', 'ar', 'results'),
  ('أداة تجد صنّاع القرار في الشركات حسب المجال والمدينة', 'ar', 'targeting'),
  ('أفضل برنامج لحجز مواعيد مبيعات تلقائيًا في التقويم', 'ar', 'meetings');
