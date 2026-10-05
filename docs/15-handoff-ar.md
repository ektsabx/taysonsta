# 15 — تسليم الشغل: كل التعديلات وإزاي تكمل من VS Code

الملف ده بيلخّص كل اللي اتعمل على الفرع `claude/amazing-lamport-haposg`
(30 commit فوق `main`)، وإزاي تنزّل المشروع على جهازك وتشغّله وتكمل شغل.
التفاصيل الكاملة في باقي ملفات `docs/` (ابدأ من `README.md`).

## 1. تنزيل المشروع على الديسكتوب

افتح Terminal (أو Terminal جوه VS Code) واكتب:

```bash
cd ~/Desktop
git clone https://github.com/ektsabx/taysonsta.git
cd taysonsta
git checkout claude/amazing-lamport-haposg
code .
```

لو المشروع متنزّل عندك قبل كده في فولدر على الديسكتوب:

```bash
cd ~/Desktop/taysonsta        # اسم الفولدر بتاعك
git status                    # اتأكد إن مفيش تعديلات عندك مش محفوظة
git fetch origin
git checkout claude/amazing-lamport-haposg
git pull origin claude/amazing-lamport-haposg
code .
```

> لو `git status` طلّع تعديلات عندك، احفظها الأول (`git stash` أو commit)
> قبل ما تعمل checkout، عشان متضيعش.

## 2. التشغيل

المطلوب على الجهاز: **Node.js 20+** و **Docker Desktop** (أو Colima على الماك) شغّال.

```bash
npm install
cd Yolias && npm install && cd ..
npm run local
```

- Yolias (تطبيق العميل): http://localhost:3200
- Yolias Admin: http://admin.localhost:3200
- دخول الأدمن (بيانات تجربة محلية بس): `admin@taysonsta.local` / `Taysonsta!2026`

### تحذير مهم عن الداتابيز المحلية

المرحلة 1 فيها migrations **بتحذف جداول** (المشاريع، المنتجات، البوابة،
الفروع، الـ IT …). لو عندك داتابيز محلية فيها بيانات مهمة، خد نسخة منها
الأول. لبناء داتابيز نضيفة ببيانات التجربة:

```bash
npx supabase db reset
npm run seed:bos
```

## 3. الفحوصات قبل أي push

```bash
npm run typecheck        # بطيء (ممكن ياخد أكتر من 15 دقيقة)
npm run lint
npm run test:unit
npm run test:db
npm run test:integration
cd Yolias && npm run typecheck && npm run lint && npm run test:unit
```

بعد أي migration جديدة: `npx supabase gen types typescript --local > types/supabase.ts`.

## 4. كل التعديلات (بالترتيب)

### Yolias — تطبيق العميل (`Yolias/`)
- تطبيق مستقل لاكتشاف العملاء بالـ AI: شعار، صفحة أسعار، تسجيل حسب الباقة، checkout.
- عربي/إنجليزي كامل (RTL/LTR) ورحلة تسجيل جديدة.
- موقع تسويقي، Help/Docs/Blog، تثبيت البحث، اشتراك سنوي.
- باقات Free/Pro/Growth، فواتير، إيميلات، تكاملات، ثيمات.
- تغيير الاسم من "Strategy" لـ "Search" في الواجهة، إعدادات بتتطبّق فعلاً.
- محادثة Yolias AI جوه صفحة البحث ومحفوظة لكل بحث (D-115).
- Yolias AI شغال على Anthropic و OpenAI و Gemini مع تحويل تلقائي لو واحد وقع (D-118).
- نظام إيميلات بالفئات ومربوط بأحداث حقيقية، وتفعيل التحقق بخطوتين (2FA) وتغيير الإيميل.
- البحث بالصوت **اتشال** حسب البرومت النهائي.

### المنصة والذكاء (Phases 1–11 من الخطة القديمة)
- طبقة Intelligence Layer: capabilities، registry للمزودين، routing، كاش للـ LLM وتسجيل التكلفة.
- schema `intel` للبيانات المشتركة: دمج الهويات، مصدر ووقت وثقة لكل حقل، TTL، كاش البحث، قائمة الحظر (suppression).
- discovery jobs في الخلفية، حالات الحملات، دفتر استهلاك (reserve/consume/release)، حدود باقات قابلة للتعديل.
- أدوات Yolias AI agent: typed، والصلاحيات متحققة في الكود، وكل استدعاء متسجّل.
- Analytics كـ SQL aggregates (للعميل وللأدمن).
- مجموعة تقييم للـ ICP بالعربي واللهجات والإنجليزي، واختبار E2E في المتصفح للتطبيقين.

### Yolias Admin (الـ BOS القديم في الـ root)
- شكل Yolias على كل الـ BOS.
- صفحات المنصة `/admin/platform`: Overview، Users، Workspaces، Searches.
- صفحة المزودين والتكاليف، صفحة Yolias AI (الاستخدام والتكلفة وسجل الأدوات).
- إيقاف مستخدمين، الشركات ومصادر البيانات، الربحية، صحة المنصة.
- إصلاح أخطاء lint والتستات القديمة، ومراجعة أمان (2FA متطبّق بـ RLS، rate limit للـ agent).

### التشغيل المحلي
- أمر واحد `npm run local` بيشغّل الداتابيزين والتطبيقين والبروكسي على :3200.
- `admin.localhost:3200` بيروح للأدمن دايماً.

### البرومت النهائي — المرحلة 1 (الحذف والتنضيف) ✅
- **اتحذف من السيستم كله** (داتابيز، دوال، صفحات، صلاحيات، إعدادات، تستات):
  بوابة العميل، المنتجات والخدمات، الفروع، الكاميرات، حسابات السوشيال،
  الأوتوميشن، المشاريع/التاسكات/تتبع الوقت، الـ IT والتطبيقات الخارجية،
  رسايل واتساب و SMS، البحث بالصوت، تخصيص الألوان والثيم (D-119).
- **الصفقة لما تتكسب** بتفعّل الحساب وتعمل جدول الدفع وأول فاتورة والعمولة وتجهيز العميل، من غير مشروع (D-121).
- **العملة EGP أو USD بس، مفيش تحويل** (D-120): التقارير بعملة واحدة في المرة، الدفعة بنفس عملة الفاتورة، حدود الموافقات لكل عملة.
- اتساب عن قصد: case studies في العروض، قنوات الدعم (Messenger / Instagram / Telegram / Email / Widget)، روابط السوشيال للشركة، الـ onboarding/offboarding في الـ HR (D-121).
- بيانات التجربة (`supabase/seed-bos.sql`) اتعدّلت على الشكل الجديد.
- migrations: `supabase/migrations/20261101000000_final_spec_removals.sql` و `20261101000100_final_spec_functions.sql`.

## 5. اللي فاضل

- **المراحل 2 لـ 10** من `14-final-spec-plan.md` لسه متعملتش.
- **قرارات مستنية منك** (التفاصيل في `12-decisions.md`):
  1. Resend: الـ API key ودومين الإرسال (مش متوصل دلوقتي).
  2. Paymob: بيانات الحساب وأسعار الباقات بالجنيه.
  3. تعريف Credits مقابل Prospects.
  4. حدود كل باقة وباكدجات "اشتري أكتر".
  5. Google OAuth client.
  6. مزودين البيانات ومفتاح Google Maps.
  7. موديلات الـ AI وأسعارها.
  8. Supabase الإنتاج والدومينات.
  9. زرار فاتح/غامق في الأدمن: يتشال ولا يفضل.

## 6. ملاحظات للشغل من VS Code

- اقرا `docs/01-rules.md` قبل أي تعديل، والقواعد دي إلزامية.
- Next.js في المشروع ده **v16** وفيها تغييرات كبيرة، فارجع لـ `node_modules/next/dist/docs/` قبل ما تكتب كود Next.
- أي نص بيظهر للمستخدم لازم يعدّي على القواميس (عربي/إنجليزي). الترجمات الإنجليزي للأدمن في `lib/bos/i18n/en.ts`.
- ملف `next-env.d.ts` بيتغيّر لوحده لما `next dev` يشتغل، فمتعملوش commit.
- المفاتيح السرية في `.env.local` بس، ومتترفعش على GitHub.
