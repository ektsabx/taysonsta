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
