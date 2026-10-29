# 17 — النشر على Cloudflare (www.yolias.com و yol.yolias.com)

الملف ده خطوات رفع المنصة للإنتاج بالترتيب. كل حاجة متجهزة في الكود
(D-135)، والباقي حاجات محتاجة حسابك أنت (Cloudflare و Supabase).

| التطبيق | الدومين | الـ Worker | أمر النشر |
| --- | --- | --- | --- |
| يولياس (الموقع + التطبيق) | `www.yolias.com` (و `yolias.com` بيحوّل عليه) | `yolias` | `cd Yolias && npm run cf:deploy` |
| الأدمن | `yol.yolias.com` بس | `yolias-admin` | `npm run cf:deploy:admin` (من جذر المشروع) |

- `www.yolias.com/admin` بترجّع 404، والأدمن مش ظاهر في أي مكان في الموقع، ولا حتى في كود الودجت.
- على `yol.yolias.com`: الصفحة الرئيسية بتحوّل على تسجيل دخول الأدمن، وأي صفحة تانية عامة بترجّع 404، ومحركات البحث ممنوعة (`robots.txt` + `X-Robots-Tag: noindex`).
- إعداد `taysonsta.net` القديم في `wrangler.jsonc` زي ما هو ومتلمسش.

## 1) Cloudflare

1. الحساب لازم يكون على **Workers Paid** (‏5$ في الشهر). حجم يولياس حوالي 4 MB مضغوط والأدمن حوالي 6.7 MB، والخطة المجانية حدها 3 MB.
2. الدومين `yolias.com` يكون متضاف في نفس الحساب (أنت ضايفه).
3. على جهازك: `npx wrangler login` (مرة واحدة).
4. الدومينات بتتربط لوحدها أول ما تنشر (`custom_domain` في `wrangler.jsonc`)، ومحتاجش تعمل سجلات DNS بإيدك. لو فيه سجل قديم بنفس الاسم (`www` أو `yol`) امسحه الأول.

## 2) Supabase (مشروعين إنتاج)

اعمل مشروعين: **Yolias** و **Yolias Admin**، لأنهم داتابيز منفصلة (D-010).

```bash
# يولياس
cd Yolias && npx supabase link --project-ref <yolias-ref> && npx supabase db push
# الأدمن
cd .. && npx supabase link --project-ref <admin-ref> && npx supabase db push
```

في Supabase يولياس ← Authentication ← URL Configuration:
- Site URL: `https://www.yolias.com`
- Redirect URLs: `https://www.yolias.com/auth/confirm`
- Providers ← Google: نفس الـ Client اللي عندك (رابط الرجوع بيكون `https://<yolias-ref>.supabase.co/auth/v1/callback`).
- Email Templates: انسخ القوالب اللي في `Yolias/supabase/templates/`.

## 3) الإعدادات والمفاتيح

- انسخ `Yolias/.env.production.example` إلى `Yolias/.env.production.local`، وانسخ `.env.production.example` إلى `.env.production.local`، واملا القيم العامة. الملفين دول مش بيترفعوا على GitHub.
- المفاتيح السرية بتتحط بأوامر `wrangler secret put` المكتوبة جوه نفس الملفين. ⚠️ `BOS_SECRETS_KEY` لازم يكون **نفس المفتاح** اللي على جهازك، وإلا التكاملات المحفوظة مش هتتقري.
- مفاتيح Claude وGemini وOpenAI وGoogle OAuth وPaymob بتتحط في الأدمن ← الإعدادات ← مركز التكاملات بس، بعد النشر (D-132).

## 4) النشر

```bash
cd Yolias && npm run cf:deploy          # www.yolias.com
cd .. && npm run cf:deploy:admin         # yol.yolias.com
```

- مهام الخلفية: Cron كل دقيقة على يولياس (`/api/worker`)، وكل 5 دقايق على الأدمن (`/api/bos/cron`). اتعملوا في `custom-worker.ts` في كل تطبيق.

## 5) بعد النشر

1. افتح `https://yol.yolias.com/admin` واعمل أول حساب أدمن.
2. مركز التكاملات: أضف Gemini (وClaude/OpenAI لو عندك)، وGoogle OAuth — Yolias (Gmail)، وPaymob. كل واحد فيهم بيتنسخ لوحده ليولياس.
3. في Google Cloud ← نفس الـ OAuth Client، ضيف رابط الرجوع: `https://www.yolias.com/api/integrations/gmail/callback`.
4. في لوحة Paymob:
   - رابط الإشعارات: `https://www.yolias.com/api/payments/paymob`
   - رابط العودة: `https://www.yolias.com/api/payments/paymob/return`
   - رقم تكامل الدولار.
5. الأدمن ← الإعدادات ← التكاملات ← ويدجت الموقع:
   - النطاقات المسموح بها: `www.yolias.com` و `yolias.com`.
   - فعّل «اعرضه على موقع يولياس».
6. الأدمن ← المنصة ← النماذج اللغوية: راجع توزيع النماذج والأسعار. أسعار Gemini 3.8 Flash بتتضاعف في 2027-01-01.
7. جرّب: التسجيل، وبحث، ورسالة من الويدجت والرد عليها من صندوق الوارد في الأدمن.

## اتجرّب على الجهاز (2026-10-06)

- `opennextjs-cloudflare build` للتطبيقين نجح.
- `wrangler deploy --dry-run` نجح (الربط والمتغيرات صح).
- تشغيل الـ Worker المبني محليًا على workerd:
  - صفحات يولياس، و`/api/worker`، وبروكسي الويدجت كلهم شغالين، و`yolias.com` بيحوّل على `www`.
  - الأدمن: `/` بيحوّل على `/admin`، والصفحات العامة 404، و`robots` و`noindex` شغالين.

## النشر على مشروع Taysonsta (D-148) — الطريقة الحالية

يولياس بيتنشر على مشروع Supabase الحالي `iudasrzqjnsutvanjrvn`، والأدمن بيفضل على جهازك.

```bash
cd ~/Desktop/taysonsta/Yolias
# 1) الداتابيز: كل migration مش موجودة في المشروع
for f in supabase/migrations/*.sql; do npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f "$f" || break; done
#    (قبل كده شوف اللي اتطبق: select version from supabase_migrations.schema_migrations)
# 2) المفاتيح العامة في Yolias/.env.production.local (من Supabase ← Settings ← API)
# 3) النشر
npm run cf:deploy
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx wrangler secret put WORKER_SECRET
```

4) الأدمن المحلي يدير يولياس المنشور: اعمل `.env.yolias-production.local` في جذر المشروع فيه
`YOLIAS_SUPABASE_URL` و `YOLIAS_SUPABASE_SERVICE_ROLE_KEY` و `YOLIAS_SITE_URL=https://www.yolias.com`،
وشغّل `npm run local`، وبعدين:
`node --import ./tests/integration/register.mjs scripts/integrations-to-yolias.ts` عشان مفاتيح Gemini وPaymob وGoogle تتنسخ للإنتاج.

5) Supabase: Redirect URL `https://www.yolias.com/auth/confirm`، و Exposed schemas: `intel`، و SMTP خاص.


## مشروع Supabase واحد ليولياس والأدمن (D-150) — اتنشر 2026-10-07

الأدمن بقى ينفع ينزل على نفس مشروع Taysonsta `iudasrzqjnsutvanjrvn` من غير مشروع تاني ومن غير Supabase Pro:
- الأربع جداول اللي كانت بنفس الاسم بقت في الأدمن `bos_conversations` و `bos_invoices` و `bos_notifications` و `bos_payments`. جداول يولياس ما اتغيرتش.
- أرقام migrations الأدمن اللي كانت زي أرقام يولياس اتزحزحت 50 ثانية (`…000050_…`)، فالاتنين يتسجلوا في نفس `schema_migrations` من غير تعارض.
- الحسابات مشتركة (`auth.users`): أي حساب دوره `staff` (موظف أدمن) أو `proposal_client` (عميل عروض الموقع) ما بيتعملوش مساحة عمل في يولياس (`20261107000000_shared_auth_admin_users.sql`). عملاء يولياس ما يقدروش يدخلوا الأدمن، لأن الأدمن بيطلب `app_metadata.role = staff`.
- اتجرّب: كل الـ 126 migration اتطبقت بنفس ترتيب الإنتاج (الموقع، ثم يولياس، ثم الأدمن) على داتابيز تجريبية من غير أي خطأ. واختبارات الأدمن 87/87 نجحت.

خطوات النشر (لما توافق):
1. Yolias: `20261107000000_shared_auth_admin_users.sql` و `20261107000100_company_profile.sql`.
2. الأدمن: كل migrations من `20260916000000` لحد `20261107000050`، بالترتيب، واحدة واحدة، بـ `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f <file>`، وبعد كل واحدة تتسجل في `supabase_migrations.schema_migrations`.
3. أول حساب أدمن: `admin@…` بدور `staff` (seed أو invite)، ومفاتيح مركز التكاملات تتدخل تاني في الأدمن المنشور.
4. `npm run cf:deploy:admin` على `yol.yolias.com`، وتضيف `https://yol.yolias.com/admin/auth/callback` في Redirect URLs.
5. `.env.local` في جذر المشروع يشاور على المشروع ده، فالأدمن المحلي والمنشور يبقوا نفس البيانات.

## Sentry و PostHog و Meta Pixel (D-152)

متغيرات البيئة. ولا واحد منهم في Git: المحلي في `Yolias/.env.local`، والإنتاج في `Yolias/.env.production.local` وقت البناء، والسيرفر في `wrangler secret`.

| المتغير | فين | ملاحظة |
|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | البناء | `production` أو `staging`. أي حاجة تانية تبقى `local`. |
| `NEXT_PUBLIC_SENTRY_DSN` | البناء | الـ DSN بتاع مشروع Sentry. ولو مش موجود، Sentry مقفول. |
| `SENTRY_AUTH_TOKEN` و `SENTRY_ORG` و `SENTRY_PROJECT` | البناء فقط | لرفع الـ source maps. بتتمسح من الملفات المنشورة بعد الرفع. |
| `NEXT_PUBLIC_POSTHOG_KEY` و `NEXT_PUBLIC_POSTHOG_HOST` | البناء | `https://us.i.posthog.com` أو `https://eu.i.posthog.com`. |
| `NEXT_PUBLIC_META_PIXEL_ID` | البناء | `1121444496996644`. |

- الإصدار (release) هو رقم الـ commit تلقائيًا (`yolias@<sha>`)، والبيئة من `NEXT_PUBLIC_APP_ENV`.
- البناء على Cloudflare: `open-next.config.ts` بيشغّل `scripts/cf-build.mjs`، اللي بيكمّل ملفات `@opentelemetry/api` للـ proxy. ده إصلاح لمشكلة معروفة في OpenNext مع Sentry.
- حجم الـ Worker بعد Sentry: حوالي 6.7 MB مضغوط (الحد 10 MB).

## إيميلات الدخول على Supabase (D-153)

`npm run auth-emails:push` في `Yolias` بيرفع قوالب `supabase/templates` وعناوينها من `config.toml` على المشروع المنشور، ومعاهم SMTP بتاع Resend لو المفتاح موجود. محتاج `Yolias/.env.auth-emails.local` (مش في Git) وفيه:
- `SUPABASE_ACCESS_TOKEN` (من supabase.com/dashboard/account/tokens)
- `RESEND_API_KEY` (مفتاح دومين `yolias.com` فيه موثّق)
- `RESEND_FROM="Yolias <no-reply@yolias.com>"`

من غير `--apply` بيعرض بس اللي هيتغير.

### اتعمل في النشر (2026-10-07)
- يولياس: 6 migrations (`20261107000000` لحد `…000500`)، ونشر `yolias`. Sentry شغال بـ fetch transport، ومن غير الـ integrations اللي ما بتشتغلش على Workers.
- الأدمن: 70 migration، ومفاتيح مركز التكاملات اتنقلت متشفّرة بنفس `BOS_SECRETS_KEY`، و7 secrets على `yolias-admin` (منهم `CRON_SECRET` جديد)، ونشر `npm run cf:deploy:admin`. ملف البناء: `.env.production.local` في الجذر، وفيه المفاتيح العامة بس.
- الأدمن المحلي لسه شغال على الداتابيز المحلية. الأدمن المنشور هو اللي شغال على بيانات الإنتاج.

## تطبيق migrations يولياس على المشروع المشترك (مهم)
`npx supabase db push` **ما بيشتغلش** على مشروع Taysonsta، لأن migrations الأدمن متسجلة في نفس الجدول، فبيرفض بـ «Remote migration versions not found». ما تشغّلش `migration repair` (هيعلّم migrations الأدمن إنها اتلغت). كل migration جديدة بتتطبق لوحدها بـ `npx supabase db query --linked -f <file>`، وبعدها تتسجل في `supabase_migrations.schema_migrations` (مثال: `Yolias/supabase/remote/record-20261107000700-000800.sql`). وتتأكد بـ `npx supabase migration list --linked`.

## جولة 2026-10-12 (مستنية موافقة المالك، ما اتنفذش منها حاجة على الإنتاج)
**قبل أي خطوة:** نسخة احتياطية من قاعدة البيانات، وتأكيد إن مفيش ازدواج في منح الباقات (السكريبت تحت).

### بالترتيب على المشروع المشترك (`db query --linked -f` لكل ملف ثم تسجيله)
1. `Yolias/supabase/migrations/20261108000000_payment_reliability.sql` (أعمدة جديدة في `payments` + فهرس فريد لمنح الباقات). قبلها شغّل: `select reason, count(*) from usage_ledger where kind='grant' and reason like 'prospect_pack:%' and reason <> 'prospect_pack:test' group by 1 having count(*) > 1;` ولازم ترجع صفر صفوف، وإلا الفهرس الفريد هيفشل.
2. `…000100_daily_limits.sql` (جدول `daily_usage` ودوالّه).
3. `…000200_blocked_email_domains.sql` (قائمة النطاقات المؤقتة + trigger على `auth.users`). الـ trigger بيأثر على أي إنشاء مستخدم جديد في المشروع (الأدمن كمان) لو بريده من نطاق مؤقت فقط.
4. `…000300_support_messages.sql` (أعمدة الحالة والنوع للرسائل + bucket خاص `bug-screenshots`).
5. `…000400_user_phone.sql` (جدول `user_phones` برقم الهاتف الخاص).
6. `…000500_review_prompt.sql` (عمودين في `profiles`).
7. `…000600_careers.sql` (على المشروع المشترك بيضيف عمود `on_yolias` بس، لأن الجدول موجود).
8. `…000700_admin_db_size.sql` (دالة قراءة حجم قاعدة البيانات).
9. الأدمن: `supabase/migrations/20261108000050_career_jobs_on_yolias.sql` ثم `20261108000150_platform_alerts.sql`.

### بعد الـ migrations
- نشر يولياس (`npm run cf:deploy` في `Yolias`) ونشر الأدمن (`npm run cf:deploy:admin`).
- في الأدمن المنشور: مفاتيح Cloudflare Turnstile، وبريد إشعارات رسائل الدعم، ومراجعة حدود التنبيهات.
- صفحات الأدمن الجديدة (رسائل الموقع، المزودون، التنبيهات) بتقرأ أعمدة يولياس الجديدة، فلازم الـ migrations تتطبق قبل نشر الأدمن، وإلا الصفحات دي هتظهر خطأ.
- تنبيه: `.env.local` في الجذر بيوجّه الأدمن المحلي لقاعدة يولياس **الإنتاجية** (من `.env.yolias-production.local`). أي تجربة محلية للأدمن بعد الـ migrations دي بتقرا بيانات الإنتاج.

## الجولة الثانية 2026-10-12 (الأفلييت، SEO، الدعم، صفحة الحالة، الصور). مستنية موافقة المالك، وما اتنفذش منها حاجة على الإنتاج
**قبل أي خطوة:** نسخة احتياطية، ثم migrations الجولة الأولى (القسم اللي فوق) بالترتيب.

**بعدها، بالترتيب على المشروع المشترك:** كل ملف بأمر `db query --linked -f`، ثم تسجيله في `schema_migrations`.
1. `Yolias/supabase/migrations/20261109000000_affiliates.sql`
   - جداول الأفلييت ودوالّها.
   - trigger على `payments`: بعد تفعيل الدفع أو استرداده بيحسب العمولة. لو حصل فيه خطأ، الدفع نفسه ما بيقفش، والخطأ بيتسجّل في `affiliate_events`.
2. `Yolias/supabase/migrations/20261109000100_status_page.sql`: جداول صفحة الحالة والخدمات السبع.
3. `Yolias/supabase/migrations/20261109000200_image_uploads.sql`: حد 10MB وأنواع PNG وJPEG وWebP على bucketين.
   - ⚠️ لو فيه صور GIF قديمة في avatars بتفضل موجودة. الشرط بيمنع رفع GIF جديدة بس.
4. الأدمن: `supabase/migrations/20261109000050_affiliate_perms.sql`، ثم `20261109000150_support_messenger.sql`.

**بعد النشر:**
- **ويدجت الدعم:** افتح الأدمن ← مركز التكاملات ← ويدجت الموقع، واحفظ ويدجت يولياس مرة واحدة. الحفظ بيولّد مفتاح الهوية ويبعته لـ Vault يولياس. من غيره المحادثات بتشتغل، لكن مش بتتربط بحساب المستخدم.
- **Search Console:** رمز Google (واختياريًا Bing) من مركز التكاملات، ثم Verify، ثم إرسال `https://www.yolias.com/sitemap.xml`.
- **برنامج الأفلييت:** راجع إعدادات البرنامج ونص الشروط قبل الإعلان عنه (البنود 39 إلى 41 في docs/18).
- **صفحة الحالة:** بتبدأ تتملّى أول ما الـ worker يشتغل (كل 5 دقائق). أول ساعة ممكن تبيّن «لا توجد بيانات حديثة» لبعض الخدمات.

### اتعمل في النشر (2026-10-12)
- **نسخة احتياطية:** `~/Desktop/taysonsta-backups/prod-20261012-1837-{schema,data}.sql`.
- **فحص التكرار:** فحص منح الباقات المكررة رجع صفر.
- **الـ migrations:** اتطبقت الـ 15 بالترتيب واتسجلت: 8 للجولة الأولى ليولياس، و3 للجولة الثانية، و4 للأدمن.
- **النشر:** يولياس على الإصدار `40c9a6a9`، والأدمن على الإصدار `94d9ba8f`.
- **صفحة الحالة:** الفحوص بدأت تشتغل على الإنتاج.
- **باقي (يدوي، من المالك):** حفظ ويدجت يولياس مرة من الأدمن (مركز التكاملات ← ويدجت الموقع) عشان مفتاح الهوية يتنقل لـ Vault يولياس.

## المرحلة الأولى 2026-10-12 (الخطط والتجربة وPolar). مستنية موافقة المالك، وما اتنفذش منها حاجة على الإنتاج
1. نسخة احتياطية.
2. `Yolias/supabase/migrations/20261110000000_plans_trial_limits.sql` بأمر `db query --linked -f`، ثم تسجيله في `schema_migrations`. إضافي فقط: خطة scale، وأعمدة الحدود، وحالة trialing، والـ view، وجدول webhooks، ونسخة أفلييت جديدة 15%.
3. نشر يولياس (`npm run cf:deploy`) ثم الأدمن (`npm run cf:deploy:admin`). الأدمن فيه تكامل Polar وخط الويدجت.
4. في الأدمن المنشور ← التكاملات ← Polar: البيئة production، والـ Token، والمنتجات الست، ثم «اختبار الاتصال».
5. في لوحة Polar ← Webhooks: Endpoint واحد بس `https://www.yolias.com/api/webhook/polar` بالأحداث `order.paid` و `customer.state_changed`، وانسخ السر في الأدمن. (اتأكد إن مفيش Endpoint تاني بنفس الرابط.)
6. فعّل «Prevent trial abuse» في إعدادات Polar.
7. الربط اتوافق عليه (D-190). قبل فتح البيع: تجربة كاملة على Polar Sandbox، وحساب البنك في Polar متفعّل.

## جولة اكتساب العملاء 2026-10-13 (التواصل، صندوق الوارد، إدارة العملاء، مساحة الذكاء الاصطناعي). محلي فقط — ما اتنفذش منها حاجة على الإنتاج
1. نسخة احتياطية من الإنتاج.
2. `Yolias/supabase/migrations/20261111000000_acquisition_workspace.sql` بأمر `db query --linked -f` ثم تسجيله في `schema_migrations` (نفس الطريقة اللي فوق). كله إضافي: جداول جديدة، وأعمدة جديدة على `profiles` و`strategies` و`outreach_messages` و`agent_pending_actions`، وصف إعداد `yolias_welcome_video` (متوقف). مفيش حذف ولا تعديل لبيانات موجودة. الرسائل القديمة كلها بتفضل `outbound` بنفس حالتها.
3. نشر يولياس (`npm run cf:deploy`) ثم الأدمن (`npm run cf:deploy:admin`): صفحة «الترحيب ومصادر التسجيل» في الأدمن بتقرا دالة `acquisition_sources` الجديدة، فلازم الـ migration يتطبق الأول.
4. بعد النشر: من الأدمن ← المنصة ← الترحيب ومصادر التسجيل، حط رابط فيديو الترحيب وفعّله.
5. الـ worker (Cron) هو اللي بيعمل تذكيرات المتابعة والرسائل المجدولة والاجتماعات اللي محتاجة نتيجة. لو الـ Cron مش شغال، التذكيرات دي مش هتتعمل.

## الجولة الثانية 2026-10-13 (D-200..D-207). محلي فقط، ما اتنفذش على الإنتاج
1. نسخة احتياطية.
2. يولياس: `Yolias/supabase/migrations/20261112000000_round2.sql` (بنفس الطريقة `db query --linked -f` + تسجيله). إضافي: دالة الحالة، وجدول التقييمات، وإيميلات الباقات (الباقات الحالية بتاخد إيميلات = عدد العملاء المحتملين)، وجهات الاتصال بلا حدود، وهدف الوكيل.
3. الأدمن: `supabase/migrations/20261112000050_support_email.sql` (نفس المشروع المشترك).
4. نشر يولياس ثم الأدمن.
5. `npm run content:seed:production` من مجلد Yolias (بيحدّث السياسات اللي ما اتعدّلتش من الأدمن). لو كنت عدّلت أي سياسة من الأدمن، النص الجديد مش هيكتب فوقها، فراجعها يدويًا.
6. في Supabase ← Authentication ← URL Configuration: مفيش رابط جديد مطلوب (صفحة الشركاء بتستخدم نفس `/auth/confirm`).
7. الأدمن: إيميلات الدعم بتتبعت من طابور الإشعارات (Resend من مركز التكاملات). اتأكد إن Resend متصل في الأدمن على الإنتاج.

## جولة 2026-10-13 (التحويلات، المستخدمون، مفاتيح التشغيل — D-212..D-216). اتنشرت
1. نسخة احتياطية.
2. يولياس: `Yolias/supabase/migrations/20261113000000_conversion_tracking.sql` بنفس طريقة `npx supabase db query --linked -f <الملف>` ثم تسجيله في `supabase_migrations.schema_migrations`. الأدمن مالوش migration جديد.
3. نشر يولياس (`npm run cf:deploy` من `Yolias`) ثم الأدمن (`npm run cf:deploy:admin` من الجذر).
4. في Polar ← Settings ← Webhooks: فعّل حدث `checkout.updated` على نفس الـ webhook (عشان فشل/انتهاء جلسات Polar يتسجل). مش إجباري، من غيره محاولات Polar الفاشلة بتظهر «انتقل للبوابة ولم تصل نتيجة».
5. بعد النشر: الأدمن ← منصة Yolias ← تشغيل وإيقاف الخدمات: اقفل Polar لحد ما حساب Polar يتراجع ويتفعل.

### اتعمل في النشر (2026-10-13 مساءً)
- نسخة احتياطية للـ schema: `~/Desktop/taysonsta-backups/prod-20261013-1657-schema.sql` (نسخة البيانات الكاملة من 11:23 نفس اليوم: `prod-20261013-data.sql`؛ نسخة بيانات جديدة اترفضت من نظام الصلاحيات).
- `20261113000000_conversion_tracking.sql` اتطبق واتسجل (6 جداول + view، 279 حساب ظاهرين).
- النشر: يولياس `1b3b9418`، والأدمن `b95de7ca`.
- لسه من المالك: حدث `checkout.updated` في Polar (اختياري)، وقفل Polar من «تشغيل وإيقاف الخدمات» لحد ما الحساب يتراجع.

## جولة 2026-10-19 (D-217..D-226). محلي فقط — ما اتنفذش منها حاجة على الإنتاج
1. نسخة احتياطية.
2. يولياس: `Yolias/supabase/migrations/20261114000000_partner_network.sql` بنفس طريقة `npx supabase db query --linked -f <الملف>` ثم تسجيله في `supabase_migrations.schema_migrations`. الأدمن مالوش migration.
3. نشر يولياس (`npm run cf:deploy` من `Yolias`) ثم الأدمن (`npm run cf:deploy:admin` من الجذر).
4. `npm run content:seed:production` من `Yolias`: لو صفحات المساعدة/التوثيق/القانونية متخزنة في قاعدة البيانات، النص القديم «خصم 20%» هيفضل ظاهر لحد ما يتعمل seed.
5. بعد النشر: الأدمن ← الدعم ← قاعدة المعرفة ← «مزامنة محتوى Yolias» (مرة، وبعد أي تحديث كبير في المحتوى).
6. Polar: أسعار الخطط السنوية هتتغير لوحدها أول checkout بعد النشر (10 × الشهري). المشتركين الحاليين بيفضلوا على سعرهم.

## جولة الوكيل الذاتي 2026-10-19 (D-228..D-234). اتنشرت 2026-10-19 (الخطوات 1–4 اتعملت؛ 5–6 لسه على المالك)
1. نسخة احتياطية.
2. يولياس: `Yolias/supabase/migrations/20261115000000_autonomous_agent.sql` بنفس طريقة `npx supabase db query --linked -f <الملف>` ثم تسجيله في `supabase_migrations.schema_migrations`. لازم قبل النشر (الكود بيقرأ الأعمدة الجديدة).
3. نشر يولياس ثم الأدمن.
4. `npm run content:seed:production` (صفحات المساعدة والتوثيق والقانونية اتغيرت).
5. Gmail: في Google Cloud ← مشروع OAuth: فعّل Gmail API، أضف الصلاحيات gmail.send و gmail.readonly، رابط الرجوع `https://www.yolias.com/api/integrations/gmail/callback`، وابدأ مراجعة Google (الصلاحيات دي «restricted» ومحتاجة تقييم أمني قبل ما أي حد بره قائمة المختبرين يربط). حط client id / secret في الأدمن ← الإعدادات ← التكاملات ← «Google OAuth — Yolias (Gmail)».
6. Outlook: في Microsoft Entra سجّل تطبيق (أي مؤسسة + حسابات شخصية)، صلاحيات Mail.Send و Mail.ReadWrite و User.Read و offline_access، رابط الرجوع `https://www.yolias.com/api/integrations/outlook/callback`، وحط المفاتيح في «Microsoft OAuth — Yolias (Outlook)».
7. ما تحطش `YOLIAS_TEST_MAILBOX` في Cloudflare أبدًا (صندوق الاختبار مرفوض في الإنتاج على أي حال).

## جولة كاشير 2026-10-19 (D-235). اتنشرت 2026-10-20 مع الجولة التالية (كاشير مقفول لحد تفعيل الحساب وربطه، D-236)
1. نسخة احتياطية.
2. يولياس: `Yolias/supabase/migrations/20261116000000_kashier.sql` (بنفس الطريقة) وتسجيله في `schema_migrations`. لازم قبل النشر.
3. نشر يولياس ثم الأدمن، ثم `npm run content:seed:production` (السياسات والمساعدة اتغيرت).
4. الأدمن ← الإعدادات ← مركز التكاملات ← Kashier: الوضع Test، و MID، و Payment API Key، و Secret Key، والعملة USD، وحفظ البطاقة «إجباري».
5. لوحة كاشير ← Webhook: `https://www.yolias.com/api/payments/kashier`.
6. تجربة كاملة ببطاقة كاشير التجريبية: اشتراك من صفحة الدفع، وتأكد إن الخطة اتفعلت، وإن البطاقة ظهرت في الأدمن ← المدفوعات (عدد البطاقات المحفوظة).
7. بعد نجاح التجربة: نفس الخطوة 4 بمفاتيح Live والوضع «حقيقي».

## جولة Outreach / Inbox / IMAP / الجنيه 2026-10-19 (D-236..D-242). اتنشرت 2026-10-20: commit 980ccfa، يولياس 26257182، الأدمن 7df8af3b، الـ migrations اتطبقت واتسجلت، والمحتوى اتحدّث. الباقي: الخطوات 5–6
1. نسخة احتياطية.
2. الـ migrations بالترتيب: `20261116000000_kashier.sql` ثم `20261117000000_paymob_egp_outreach.sql`، وتسجيلهم في `schema_migrations`. لازم قبل النشر.
3. نشر يولياس ثم الأدمن، ثم `npm run content:seed:production`.
4. الأدمن ← الخطط: راجع أسعار الجنيه (2,499 / 4,999 / 9,999).
5. Gmail وOutlook: مفاتيح OAuth في الأدمن (القسم السابق 5–6). وIMAP/SMTP مش محتاج أي حاجة من الأدمن.
6. جرّب على الإنتاج بصندوق IMAP حقيقي: اربطه، وابعت حملة لنفسك، وردّ عليها، واتأكد إن الرد وصل صندوق الوارد خلال 5 دقايق.

## جولة 2026-10-20 (D-243..D-245). اتنشرت 2026-10-20: commit 2bf5e6b، يولياس f491859c، الأدمن f40bfccb، الـ migration اتطبقت واتسجلت (نسخة احتياطية prod-20261020-1949)، والمحتوى اتحدّث. الباقي: الخطوات 4 إلى 6 على المالك
1. نسخة احتياطية.
2. migration واحدة: `Yolias/supabase/migrations/20261118000000_messaging.sql` (`npx supabase db query --linked -f …` ثم تسجيلها في `supabase_migrations.schema_migrations`). لازم قبل نشر يولياس والأدمن.
3. نشر يولياس (`npm run cf:deploy` من Yolias/) ثم الأدمن (`npm run cf:deploy:admin`)، ثم `npm run content:seed:production`.
4. Resend ← Webhooks: الرابط `https://www.yolias.com/api/webhook/resend` والأحداث email.sent, email.delivered, email.delivery_delayed, email.bounced, email.complained, email.opened, email.clicked, email.failed. انسخ سر التوقيع للأدمن ← الرسائل والأتمتة ← الإعدادات.
5. الأدمن ← الرسائل والأتمتة ← الإعدادات: ضيف بريدك في «عناوين الاختبار»، وابعت «إرسال اختباري» من قالب.
6. فعّل المسارات اللي عايزها بعد مراجعتها (في وضع الاختبار الأول).

## جولة الأسعار 2026-10-20 (D-247). اتنشرت 2026-10-20: نسخة احتياطية prod-20261020-2206، الـ migrations 20261119000000 و20261119000100 اتطبقت واتسجلت، يولياس 5042d489، الأدمن c6fba106، والمحتوى اتحدّث. الباقي: الخطوة 5 على المالك
1. نسخة احتياطية (schema + data).
2. migration واحدة: `Yolias/supabase/migrations/20261119000000_payg_pricing.sql` (`npx supabase db query --linked -f …`) وتسجيلها في `schema_migrations`. لازم قبل نشر يولياس والأدمن.
3. نشر يولياس ثم الأدمن، ثم `npm run content:seed:production` (الأسعار والمساعدة والتوثيق والشروط اتغيرت).
4. الأدمن ← المنصة ← مفاتيح التشغيل: «شراء عملاء محتملين إضافيين» لازم يكون شغال، وإلا خيار الدفع حسب الاستخدام مش هيظهر.
5. جرّب شحن 5 دولار ببطاقة حقيقية واتأكد إن الرصيد ظهر في الإعدادات ← الاستخدام وفي الأدمن ← ملف المستخدم ← الاشتراكات والمدفوعات.

## جولة استيراد البيانات والمصادر المفتوحة والمحادثات 2026-10-21 (D-248, D-249). اتنشرت: نسخة احتياطية prod-20261021-0125، الـ migrations 20261120000000 و20261120000100 اتطبقت واتسجلت، يولياس 733d8525، الأدمن e180aa23، والمحتوى اتحدّث. الباقي على المالك: 1 إلى 3
1. مفتاح Companies House (مجاني): developer.company-information.service.gov.uk ← Create an application (Live) ← REST key، وبعدين الأدمن ← الإعدادات ← التكاملات ← UK Companies House.
2. MillionVerifier (لو هتستخدمه): المفتاح في الأدمن ← التكاملات ← MillionVerifier، وسعر الفحص في الأدمن ← المزودون.
3. أول بيانات مشتراة: الأدمن ← استيراد البيانات ← استيراد بيانات، وعلّم «مسموح عرضها للعملاء» بس لو العقد بيسمح.

## جولة التدقيق 2026-10-21 (D-251). اتنشرت: نسخة احتياطية prod-20261021-0628، الـ migrations 20261121000000 و20261121000100 اتطبقت واتسجلت، يولياس 7eb61e09، الأدمن 8901999b، والمحتوى اتحدّث. الباقي على المالك: 1 إلى 3
1. الأدمن على الإنتاج (yol.yolias.com) ← الإعدادات ← التكاملات ← Resend ← «حفظ» (وحط «عنوان المرسل في يولياس» على دومين موثّق في Resend). ده اللي ينقل المفتاح ليولياس.
2. نفس المكان ← ويدجت الموقع «Yolias Support» ← «حفظ» مرة واحدة، عشان مفتاح هوية المستخدمين يرجع صح.
3. بعد 1: أنا أبعت الإيميلات التجريبية وأفعّل المسارات الثلاثة (scripts/ops-messaging-live.mts … --activate).

## جولة صفحات AgentSDR 2026-10-26 (D-255, D-256). اتنشرت 2026-10-26: commit d530635 + 3dc42ea، نسخة احتياطية prod-20261026-0719، الـ migration 20261122000000 اتطبقت واتسجلت (المالك)، يولياس 15a03883، والمحتوى اتحدّث
1. نسخة احتياطية (schema + data).
2. migration واحدة: `Yolias/supabase/migrations/20261122000000_email_sending_rules.sql` (`npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/migrations/20261122000000_email_sending_rules.sql`) وتسجيلها في `supabase_migrations.schema_migrations`. لازم قبل نشر يولياس: العامل بيقرأ `mailboxes.send_days` و`outreach_campaigns.dispatched_at`.
3. بعد التطبيق: صناديق البريد الحالية هتاخد ساعات الإرسال الافتراضية (الاتنين للجمعة، 9 لـ 6، بالمنطقة الزمنية بتاعة صاحب البريد) وفاصل 18 لـ 24 دقيقة. غيّرها من الإعدادات ← التكاملات ← قواعد الإرسال لو محتاج.
4. نشر يولياس، ثم `npm run content:seed:production` (نصوص المساعدة اتغيرت).

## جولة SEO 2026-10-27 (D-257). اتنشرت 2026-10-27: commit 8ca0062، نسخة احتياطية prod-20261027-0304، الـ migration 20261123000000 اتطبقت واتسجلت (المالك)، يولياس 827da1c6، الأدمن e08773eb، والـ 23 صفحة منشورة والمحتوى اتحدّث. الباقي: الخطوة 5 على المالك
1. نسخة احتياطية (schema + data).
2. migration واحدة: `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/migrations/20261123000000_seo_control_center.sql` ثم `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/remote/record-20261123000000.sql`. لازم قبل نشر يولياس والأدمن (البوابة بتقرأ `seo_redirects`، والتسجيل بيكتب `signup_attribution`).
3. نشر يولياس (`npm run cf:deploy` من Yolias/) ثم الأدمن (`npm run cf:deploy:admin`)، ثم `npm run content:seed:production` (سياسة الكوكيز والخصوصية اتغيرت)، ثم `npm run seo:seed:production` من Yolias/ (الصفحات الـ 23 منشورة بموافقة المالك).
4. المالك (اختياري): الأدمن ← SEO ← المنافسون: راجع المعلومات كل 90 يومًا، وضيف أسعار Apollo وInstantly لو ظهرت واضحة في صفحاتهم.
5. المالك: Search Console وGA4: حساب خدمة من Google Cloud وربطه في مركز التكاملات (الخطوات في الأدمن ← SEO ← تكاملات SEO). لـ GA4: معرّف القياس في `NEXT_PUBLIC_GA_MEASUREMENT_ID` لـ يولياس ثم نشر.
6. بعد النشر: أرسل `/sitemap.xml` في Search Console.

## الروابط العربية 2026-10-27 (D-258). اتنشرت 2026-10-27: commit 46b516d، يولياس 5f754ddb، الأدمن 065f8939. مفيش migration
1. نشر يولياس ثم الأدمن.
2. بعد ربط Search Console: أرسل `/sitemap.xml` (فيه النسختين).

## ردود المالك 2026-10-28 (D-259)
1. migration واحدة (المالك، من مجلد taysonsta): `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/migrations/20261124000000_lead_unsubscribe.sql` ثم `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/remote/record-20261124000000.sql`. إضافية بس (عمودين وفهرس). النشر قبلها آمن: الإيميلات بتطلع من غير سطر الإلغاء لحد ما تتطبق.
2. نشر يولياس (`npm run cf:deploy` من Yolias/). الأدمن ما اتغيرش.
3. المالك: مفاتيح Turnstile في الأدمن ← الإعدادات ← التكاملات ← Cloudflare Turnstile.
4. المالك: خطوة 1 من D-251 (حفظ Resend)، وبعدها من Yolias/: `set -a && . ./.env.production.local && set +a && npx tsx --conditions=react-server --tsconfig tsconfig.json scripts/ops-messaging-live.mts <بريدك>`، تأكد إن الإيميلات التجريبية وصلت، وبعدها نفس الأمر وفي آخره `--activate`.

## جولة 2026-10-28 (D-260)
1. migration واحدة (من مجلد taysonsta): `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/migrations/20261125000000_referral_program.sql` ثم `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/remote/record-20261125000000.sql`. لازم قبل نشر يولياس (التسجيل والإعدادات بيقروا `referrals` و`workspaces.referral_code`).
2. نشر يولياس (`npm run cf:deploy` من Yolias/) ثم الأدمن (`npm run cf:deploy:admin` من taysonsta/).
3. `npm run content:seed:production` من Yolias/ (المقالين الجداد وصفحة المجتمع في مساعد الدعم).

## جولة 2026-10-28 الجزء التاني (D-261). مفيش migration جديدة
1. migration الإحالة 20261125000000 (الجولة اللي فاتت) لازم تكون اتطبقت قبل النشر.
2. نشر يولياس ثم الأدمن.
3. من Yolias/: `npm run content:seed:production` (مقالات المساعدة الجديدة وسياسة الكوكيز) ثم `npm run seo:seed:production` (صفحات المقارنة الجديدة).
4. DNS: سجل TXT باسم `_dmarc` على yolias.com قيمته `v=DMARC1; p=none;`.

## جولة 2026-10-29 (D-262, D-263). اتنشرت: الـ migration 20261126000000 اتطبقت واتسجلت، يولياس bd254783، الأدمن 5c624e34
1. migration: `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/migrations/20261126000000_deals_and_meetings.sql` ثم `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/remote/record-20261126000000.sql`. قبل النشر.
2. نشر يولياس ثم الأدمن.

## جولة 2026-10-29 الثانية (D-264). اتنشرت: الـ migration 20261127000000 اتطبقت واتسجلت، يولياس 5eb50c3b، الأدمن b146e103، والمقال اتضاف
1. migration: `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/migrations/20261127000000_sales_emails.sql` ثم `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/remote/record-20261127000000.sql`. قبل النشر (الإيميلات بتقرأ `notify_sales`).
2. نشر يولياس ثم الأدمن.
3. من Yolias/: `npm run content:seed:production` (مقال «الصفقات والاجتماعات وعروض الأسعار»).

## جولة 2026-10-29 الثالثة (D-265). اتنشرت: الـ migration 20261128000000 اتطبقت واتسجلت، يولياس 53995969، الأدمن 6c3cf9d6، المحتوى اتحدّث. الفحص: 48 من 178 صفحة سليمة قبل، 154 بعد
1. migration: `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/migrations/20261128000000_brand_spelling.sql` ثم `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/remote/record-20261128000000.sql`.
2. نشر يولياس ثم الأدمن.
3. من Yolias/: `npm run content:seed:production` ثم `npm run seo:seed:production`.

## جولة 2026-10-29 الرابعة (D-266). اتنشرت: الـ migration 20261129000000 اتطبقت واتسجلت، يولياس e602d11c، الأدمن 29c2a583. الفحص: 175 من 176 صفحة سليمة
1. migration: `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/migrations/20261129000000_retire_discovery_post.sql` ثم `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/remote/record-20261129000000.sql`.
2. نشر يولياس ثم الأدمن.
3. من Yolias/: `npm run content:seed:production` ثم `npm run seo:seed:production`.

## جولة 2026-10-30 (D-267)
1. migration: `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/migrations/20261130000000_meetings.sql` ثم `npx supabase db query --linked --project-ref iudasrzqjnsutvanjrvn -f Yolias/supabase/remote/record-20261130000000.sql`.
2. نشر يولياس ثم الأدمن، ثم من Yolias/: `npm run content:seed:production`.
3. Google Cloud (المالك): تفعيل Google Calendar API، وإضافة الصلاحية `calendar.app.created` في شاشة الموافقة، وإضافة `https://www.yolias.com/api/calendar/google/callback` في Authorized redirect URIs لنفس عميل OAuth بتاع Gmail.
