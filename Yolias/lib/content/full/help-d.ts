import type { Doc, Localized } from "../types";

// Full-length Help Center articles: meetings, Google Calendar, plans, team and account.
export const helpD: Record<string, Localized<Doc>> = {
  "deals-and-meetings": {
    en: {
      title: "Meetings and your booking page",
      summary: "How a reply becomes a booked meeting, how to set up your booking page, what the Meetings page shows, and how to record what came of each meeting.",
      updated: "2026-11-05",
      blocks: [
        { p: "Meetings are booked inside Yolias. Each member has a booking page, Yolias offers it to interested leads in the conversation, and every booking lands in **Meetings** with the lead, the campaign it came from and its result. This article covers the whole path, from setting up the page to recording the outcome." },

        { h2: "What is the booking page?" },
        { p: "Your booking page is a public page at yolias.com/meet/your-address where anyone with the link picks a day and a time and books a meeting with you. Yolias creates it the first time you open **Meetings**, with an address made from your name (or from your email if your name can't be used), a meeting named **Meeting**, a length of 30 minutes and weekday hours. You change all of it in the **Booking page** tab." },
        { p: "The page offers one meeting: the one you name and describe in the settings. Guests see your name and company, the meeting name, its length, the place, and the free times in their own time zone. They enter their name and email, can add a note, and press **Book the meeting**." },

        { h2: "How does a reply become a meeting?" },
        { p: "When a lead replies to a campaign with interest or asks for a meeting, Yolias answers in the same thread. What it does next depends on the reply:" },
        { ul: [
          "**The lead names a time.** If that time is inside your weekly hours, respects your shortest notice and your booking window, and doesn't overlap a busy time or its break, Yolias books it and confirms in the thread. The time doesn't need to match the page's time grid.",
          "**The lead shows interest without a time.** Yolias replies with two free times, one on each of the next two days that have free times, and the link to your booking page.",
          "**Your booking page is off.** Yolias sends the campaign's own link if the campaign has one. Without a link, the conversation is handed to you.",
        ] },
        { p: "Meetings booked from a reply are booked on the page of the member whose mailbox holds the conversation. In a qualified leads campaign, an interested person is the result: Yolias answers and hands the lead to you instead of offering times, and a time the lead names in the reply is still booked." },
        { p: "Every booking, from the page or from a reply, creates or updates the lead in your workspace, moves it to the meeting stage, sends you an email and a notification, and sends the guest a confirmation email with a link to cancel." },

        { h2: "Set up your booking page" },
        { ol: [
          "In the sidebar, open **Meetings**, then the **Booking page** tab.",
          "Check **Taking bookings**. When it is off, the page tells visitors it isn't taking bookings and Yolias stops offering times.",
          "In **Address**, enter the end of your link: lowercase English letters, numbers and dashes, 3 to 40 characters, starting and ending with a letter or number.",
          "In **Meeting name**, enter what guests see as the title, for example Intro call.",
          "In **Place**, enter a meeting link, a phone number or an address. Yolias doesn't create video links: this field is the only place or link your guest receives.",
          "In **A line for visitors**, describe the meeting in one sentence (up to 500 characters).",
          "Choose **Length**, **Time zone**, **Break between meetings**, **Shortest notice** and **Open for booking** (the values are listed below).",
          "Under **Weekly hours**, set the hours for each day. Press **Add hours** (the plus icon) to add a range, up to three per day, and the bin icon to remove one. A day with no range shows **Unavailable**.",
          "Press **Save**.",
        ] },
        { p: "**How to know it worked:** a **Saved.** message appears. Press **Open the page** under **Your link**, or **Open your booking page** at the top of Meetings, and check that the free times match your hours. Opening your own page doesn't count as a visit." },
        { p: "**If it doesn't save:** an address with other characters shows The address uses lowercase letters, numbers and dashes (3 to 40). An address used by someone else shows This address is taken. Try another. A range that ends before it starts, or an empty meeting name, shows Check the fields and try again." },
        { note: "Changing the address changes your link. Links you already shared, and links in emails Yolias already sent, stop working." },

        { h2: "What do the page settings do?" },
        { table: { head: ["Setting", "Choices", "Effect"], rows: [
          ["Length", "15, 20, 30, 45, 60 or 90 minutes", "The length of each meeting and of each time offered"],
          ["Break between meetings", "0, 5, 10, 15 or 30 minutes", "Kept free after each meeting, and around every busy time"],
          ["Shortest notice", "0, 1, 2, 4, 12, 24 or 48 hours", "No time earlier than this from now is offered"],
          ["Open for booking", "7, 14, 21, 30 or 60 days", "How far ahead guests can book"],
          ["Time zone", "Any time zone", "The zone your weekly hours are written in"],
        ] } },
        { p: "Free times start at the beginning of each range and repeat every length plus break. With 30 minutes and a 10-minute break from 10:00 to 12:00, the page offers 10:00, 10:40 and 11:20. A time is removed when it overlaps one of your scheduled meetings in Yolias or, with [Google Calendar](/help-center/google-calendar) connected, a busy event in your main Google calendar." },

        { h2: "What does the Meetings page show?" },
        { p: "Meetings has three tabs. The button **Open your booking page** at the top opens your public page." },
        { h3: "Link visits" },
        { p: "The top row shows **Meetings booked, last 30 days**, **Spend, last 30 days** across all your campaigns, and **Cost per meeting** (spend divided by meetings). Below it: **Visits**, **Booked**, **Started, didn't book** and **Visit-to-booking**, then a table of every visit in the last 30 days with **Visitor**, **From** (the campaign, or **Direct link**), **State** and **When**." },
        { p: "A visit counts once per visitor per day, and only when the page loads in a browser. A visitor who typed a name or email and left for 30 minutes shows **Started, didn't book**, with what they typed. Press **Write to them** to open the conversation, or your mail app if they aren't a lead yet. While someone is still on the form, the state is **Filling in now**." },
        { h3: "Bookings" },
        { p: "Upcoming meetings first, then past meetings from the last 60 days. Each card shows the time, the guest, their company and email, their note, where it came from (**Booking page**, **Yolias** or **Added by hand**), its status, the campaign and the place. Use **Show** to filter: **All**, **Upcoming**, **Held**, **No-show**, **Canceled**, **Qualified**, **Not qualified**. The guest's name opens the conversation." },
        { h3: "Booking page" },
        { p: "Your link with **Copy** and **Open the page**, whether Google Calendar is connected, and the settings described above." },

        { h2: "Before the meeting" },
        { ul: [
          "**Join** appears on an upcoming meeting when **Place** is a web link (starting with https://).",
          "**Prepare** asks Yolias for a brief: who the person is, the conversation so far, and what to ask. Yolias also prepares it by itself about three hours before. It appears under **Brief** on the card and in your one-hour reminder email.",
          "The guest receives a reminder a day before (when the meeting was booked more than a day ahead) and another an hour before, each with the place or link and a cancel link.",
          "To cancel, press the X on the card and confirm. The guest is told, the time is free again on your page, and the event is removed from Google Calendar if it was added there.",
        ] },
        { p: "The guest cancels with the link in the confirmation or reminder email. It opens **Cancel this meeting?** with an optional reason; opening the link alone changes nothing. Once they press **Cancel the meeting**, you get an email and a notification with the reason, the card shows **Canceled**, and the time is free again." },
        { p: "There is no reschedule button. To move a meeting, cancel it; the guest can book a new time from your page." },

        { h2: "Record what came of it" },
        { ol: [
          "Open **Meetings**, then **Bookings**. A meeting whose end time has passed moves under **Past**.",
          "Under **Did it happen?**, press **It happened** or **No-show**.",
          "For a meeting that happened, answer **Was it qualified?** with **Yes** or **No**: was it with the right person, about a real need.",
          "Then press **Became a customer**, optionally after entering the **Deal value**, or open **Didn't buy** and choose the reason: **Price**, **Timing**, **No need**, **Chose a competitor**, **Stopped replying** or **Other**.",
        ] },
        { p: "**How to know it worked:** a **Saved.** message appears and the card shows the new tags. The lead's stage changes to won or lost, qualified meetings count toward the campaign's target, and the deal value feeds the campaign's return. Won and lost deals also guide the next searches." },
        { p: "Marking **No-show** sends the guest your booking page to pick another time, once per meeting, when your page is taking bookings and the lead hasn't asked not to be contacted." },

        { h2: "Example" },
        { p: "A clinic owner replies to your campaign: Sounds interesting, can we talk Thursday at 11? Thursday 11:00 is inside your hours and free, so Yolias books it, confirms in the thread, and the guest receives a confirmation with your Place, a Zoom link you entered. Wednesday morning the guest gets the day reminder. Around 08:00 Thursday, the brief appears on the card. After the call you press **It happened**, **Yes**, enter 1,200 as the deal value and press **Became a customer**. **Cost per meeting** on Link visits now reflects the booking." },

        { h2: "Permissions and requirements" },
        { ul: [
          "Every member has their own booking page and their own hours.",
          "Admins and Advertisers change their page and record results. Analysts see Meetings but can't save the page, cancel, prepare a brief or record an outcome.",
          "Meetings, bookings and reminders are never charged.",
          "One email address can book at most three meetings in 24 hours. A fourth attempt asks the guest to reply to the confirmation email instead.",
        ] },

        { h2: "Important notes" },
        { ul: [
          "Without **Place**, a meeting has no place or link. Yolias doesn't create video links.",
          "The booking page opens in the visitor's language. Add ?l=ar or ?l=en to the link to choose Arabic or English.",
          "Confirmation, reminder, rebooking and cancellation emails reach the guest in the language they booked in: the language of your booking page when they booked there, or the language of the campaign email they replied to when Yolias booked the time in the conversation.",
          "Times on the cards use the time zone in your profile; the public page shows each guest their own time zone.",
          "Booking pages aren't shown in search engines.",
        ] },

        { h2: "Troubleshooting" },
        { h3: "The page says it isn't taking bookings" },
        { p: "**Taking bookings** is off. Turn it on and press **Save**." },
        { h3: "The page says there are no free times" },
        { p: "Check **Weekly hours**, then **Shortest notice** and **Open for booking**. A 48-hour notice with only two open days a week can leave nothing to offer." },
        { h3: "A busy time is offered" },
        { p: "Only Yolias meetings block times until you connect [Google Calendar](/help-center/google-calendar). After connecting, only busy events in your main Google calendar are skipped." },
        { h3: "A guest sees That time was just taken" },
        { p: "Someone booked it first. The guest picks another time." },
        { h3: "Yolias offered no times in a reply" },
        { p: "Your page was off or had no free times in the window, so the reply carried only the link or the conversation was handed to you." },

        { h2: "Related articles" },
        { ul: ["[Connecting Google Calendar](/help-center/google-calendar)", "[Conversations](/help-center/conversations)", "[Yolias AI](/help-center/yolias-ai)", "[Reading campaign results](/help-center/campaign-results)"] },
      ],
    },
    ar: {
      title: "الاجتماعات وصفحة الحجز",
      summary: "كيف يتحول رد العميل إلى اجتماع محجوز، وكيف تضبط صفحة الحجز، وماذا تعرض صفحة الاجتماعات، وكيف تسجل نتيجة كل اجتماع.",
      updated: "2026-11-05",
      blocks: [
        { p: "تُحجز الاجتماعات داخل يولياس. لكل عضو صفحة حجز خاصة به، ويعرضها يولياس على العملاء المهتمين داخل المحادثة، ويصل كل حجز إلى **الاجتماعات** ومعه العميل والحملة التي جاء منها ونتيجته. يشرح هذا المقال المسار كاملًا، من ضبط الصفحة حتى تسجيل النتيجة." },

        { h2: "ما صفحة الحجز؟" },
        { p: "صفحة الحجز صفحة عامة على العنوان yolias.com/meet/عنوانك، يختار فيها أي شخص معه الرابط يومًا وموعدًا ويحجز اجتماعًا معك. ينشئها يولياس أول مرة تفتح فيها **الاجتماعات**، بعنوان مأخوذ من اسمك (أو من بريدك إذا تعذر استخدام الاسم)، واجتماع باسم **اجتماع** مدته 30 دقيقة، وساعات عمل في أيام الأسبوع. وتغيّر كل ذلك من تبويب **صفحة الحجز**." },
        { p: "تعرض الصفحة اجتماعًا واحدًا هو الذي تسميه وتصفه في الإعدادات. ويرى الضيف اسمك وشركتك واسم الاجتماع ومدته ومكانه والمواعيد المتاحة بتوقيته هو. يكتب اسمه وبريده، ويمكنه إضافة ملاحظة، ثم يضغط **احجز الاجتماع**." },

        { h2: "كيف يتحول الرد إلى اجتماع؟" },
        { p: "عندما يرد عميل على حملة باهتمام أو يطلب اجتماعًا، يجيبه يولياس في المحادثة نفسها. وما يفعله بعد ذلك يعتمد على الرد:" },
        { ul: [
          "**ذكر العميل موعدًا.** إذا كان الموعد داخل ساعاتك الأسبوعية، ويحترم أقل مهلة ومدة الحجز المتاحة، ولا يتداخل مع وقت مشغول أو الاستراحة حوله، يحجزه يولياس ويؤكده في المحادثة. ولا يلزم أن يطابق الموعد مواعيد الصفحة نفسها.",
          "**أبدى العميل اهتمامًا دون موعد.** يرد يولياس بموعدين متاحين، كل منهما في يوم من أقرب يومين فيهما مواعيد، ومعهما رابط صفحة الحجز.",
          "**صفحة الحجز مغلقة.** يرسل يولياس رابط الحملة نفسها إن كان لها رابط. ومن دون رابط تنتقل المحادثة إليك.",
        ] },
        { p: "يُحجز الاجتماع الناتج عن رد على صفحة العضو الذي تجري المحادثة من بريده. وفي حملة العملاء المؤهلين يكون الشخص المهتم هو النتيجة: يجيبه يولياس ويسلمه إليك بدل عرض المواعيد، ومع ذلك يُحجز الموعد الذي يذكره العميل في رده." },
        { p: "كل حجز، من الصفحة أو من رد، ينشئ العميل في مساحة عملك أو يحدّثه، وينقله إلى مرحلة الاجتماع، ويرسل إليك بريدًا وإشعارًا، ويرسل إلى الضيف بريد تأكيد فيه رابط للإلغاء." },

        { h2: "اضبط صفحة الحجز" },
        { ol: [
          "من الشريط الجانبي افتح **الاجتماعات** ثم تبويب **صفحة الحجز**.",
          "فعّل **مفتوحة للحجز**. عند إيقافها تخبر الصفحة زوارها أنها لا تستقبل حجوزات، ويتوقف يولياس عن عرض المواعيد.",
          "في **العنوان** اكتب آخر الرابط: حروف إنجليزية صغيرة وأرقام وشرطات، من 3 إلى 40 حرفًا، يبدأ وينتهي بحرف أو رقم.",
          "في **اسم الاجتماع** اكتب العنوان الذي يراه الضيف، مثل: مكالمة تعارف.",
          "في **المكان** اكتب رابط اجتماع أو رقم هاتف أو عنوانًا. لا ينشئ يولياس روابط فيديو، وهذا الحقل هو المكان أو الرابط الوحيد الذي يصل ضيفك.",
          "في **سطر للزوار** صف الاجتماع في جملة واحدة (حتى 500 حرف).",
          "اختر **المدة** و**المنطقة الزمنية** و**استراحة بين الاجتماعات** و**أقل مهلة قبل الاجتماع** و**الحجز متاح لمدة** (القيم في الجدول أدناه).",
          "في **ساعات الأسبوع** حدد ساعات كل يوم. اضغط **أضف ساعات** (علامة +) لإضافة فترة، حتى ثلاث فترات في اليوم، وأيقونة سلة المهملات لحذف فترة. واليوم الذي بلا فترات يظهر **غير متاح**.",
          "اضغط **حفظ**.",
        ] },
        { p: "**كيف تعرف أن الحفظ تم:** تظهر رسالة **تم الحفظ.**. اضغط **افتح الصفحة** تحت **رابطك**، أو **افتح صفحة الحجز** أعلى صفحة الاجتماعات، وتأكد أن المواعيد تطابق ساعاتك. ولا يُحسب فتحك لصفحتك زيارة." },
        { p: "**إذا لم يتم الحفظ:** العنوان الذي فيه حروف أخرى يعرض: العنوان بحروف إنجليزية صغيرة وأرقام وشرطات (من 3 إلى 40). والعنوان الذي يستخدمه غيرك يعرض: هذا العنوان مستخدم. جرّب عنوانًا آخر. والفترة التي تنتهي قبل أن تبدأ، أو اسم الاجتماع الفارغ، يعرضان: راجع الحقول وحاول مرة أخرى." },
        { note: "تغيير العنوان يغيّر رابطك. فتتوقف الروابط التي شاركتها، والروابط الموجودة في رسائل أرسلها يولياس من قبل." },

        { h2: "ماذا تفعل إعدادات الصفحة؟" },
        { table: { head: ["الإعداد", "الاختيارات", "أثره"], rows: [
          ["المدة", "15 أو 20 أو 30 أو 45 أو 60 أو 90 دقيقة", "مدة كل اجتماع وكل موعد معروض"],
          ["استراحة بين الاجتماعات", "0 أو 5 أو 10 أو 15 أو 30 دقيقة", "وقت يبقى فارغًا بعد كل اجتماع وحول كل وقت مشغول"],
          ["أقل مهلة قبل الاجتماع", "0 أو 1 أو 2 أو 4 أو 12 أو 24 أو 48 ساعة", "لا يُعرض موعد أقرب من هذه المهلة"],
          ["الحجز متاح لمدة", "7 أو 14 أو 21 أو 30 أو 60 يومًا", "إلى أي مدى في المستقبل يستطيع الضيف الحجز"],
          ["المنطقة الزمنية", "أي منطقة زمنية", "التوقيت الذي تُكتب به ساعاتك الأسبوعية"],
        ] } },
        { p: "تبدأ المواعيد المتاحة من أول كل فترة وتتكرر كل مدة مضافًا إليها الاستراحة. فمع اجتماع 30 دقيقة واستراحة 10 دقائق من 10:00 إلى 12:00 تعرض الصفحة 10:00 و10:40 و11:20. ويُحذف الموعد إذا تداخل مع اجتماع مجدول لك في يولياس، أو مع حدث مشغول في تقويمك الرئيسي على Google إذا ربطت [تقويم Google](/help-center/google-calendar)." },

        { h2: "ماذا تعرض صفحة الاجتماعات؟" },
        { p: "في الاجتماعات ثلاثة تبويبات، وزر **افتح صفحة الحجز** في الأعلى يفتح صفحتك العامة." },
        { h3: "زيارات الرابط" },
        { p: "يعرض الصف الأول **اجتماعات محجوزة، آخر 30 يومًا** و**الإنفاق، آخر 30 يومًا** على كل حملاتك و**تكلفة الاجتماع** (الإنفاق مقسومًا على الاجتماعات). وتحته: **الزيارات** و**حجزوا** و**بدأوا ولم يكملوا** و**نسبة الحجز من الزيارات**، ثم جدول بكل زيارة في آخر 30 يومًا فيه **الزائر** و**من** (الحملة أو **رابط مباشر**) و**الحالة** و**متى**." },
        { p: "تُحسب الزيارة مرة واحدة لكل زائر في اليوم، وفقط عندما تُفتح الصفحة في متصفح. والزائر الذي كتب اسمًا أو بريدًا ثم غاب 30 دقيقة يظهر بحالة **بدأ ولم يكمل** ومعه ما كتبه. اضغط **راسله** لفتح المحادثة معه، أو برنامج البريد إن لم يكن عميلًا بعد. وما دام الشخص يملأ النموذج تظهر الحالة **يملأ البيانات الآن**." },
        { h3: "الحجوزات" },
        { p: "الاجتماعات القادمة أولًا، ثم السابقة من آخر 60 يومًا. يعرض كل كارت الموعد والضيف وشركته وبريده وملاحظته، ومصدر الحجز (**صفحة الحجز** أو **يولياس** أو **أضيف يدويًا**)، وحالته، والحملة، والمكان. واستخدم **عرض** للتصفية: **الكل** و**القادمة** و**تمت** و**لم يحضر** و**ملغاة** و**مؤهلة** و**غير مؤهلة**. واسم الضيف يفتح المحادثة." },
        { h3: "صفحة الحجز" },
        { p: "رابطك مع **نسخ** و**افتح الصفحة**، وحالة ربط تقويم Google، والإعدادات الموضحة أعلاه." },

        { h2: "قبل الاجتماع" },
        { ul: [
          "يظهر زر **انضم** في الاجتماع القادم عندما يكون **المكان** رابط ويب يبدأ بـ https://.",
          "زر **جهّز الاجتماع** يطلب من يولياس ملخصًا: من الشخص، وما دار في المحادثة، وماذا تسأله. ويجهزه يولياس وحده أيضًا قبل الموعد بنحو ثلاث ساعات، ويظهر تحت **الملخص التحضيري** في الكارت وفي بريد التذكير الذي يصلك قبل الاجتماع بساعة.",
          "يصل الضيف تذكير قبل الموعد بيوم (إذا حُجز الاجتماع قبل موعده بأكثر من يوم) وتذكير آخر قبله بساعة، وفي كل منهما المكان أو الرابط ورابط الإلغاء.",
          "للإلغاء اضغط X في الكارت وأكّد. يُبلَّغ الضيف، ويعود الموعد متاحًا في صفحتك، ويُحذف الحدث من تقويم Google إذا كان قد أُضيف إليه.",
        ] },
        { p: "يلغي الضيف بالرابط الموجود في بريد التأكيد أو التذكير. يفتح الرابط صفحة **إلغاء هذا الاجتماع؟** مع خانة اختيارية للسبب، ومجرد فتح الرابط لا يغيّر شيئًا. وعندما يضغط **إلغاء الاجتماع** يصلك بريد وإشعار فيهما السبب، ويظهر الكارت بحالة **أُلغي**، ويعود الموعد متاحًا." },
        { p: "لا يوجد زر لتغيير الموعد. لتغييره ألغِ الاجتماع، ويستطيع الضيف حجز موعد جديد من صفحتك." },

        { h2: "سجّل نتيجة الاجتماع" },
        { ol: [
          "افتح **الاجتماعات** ثم **الحجوزات**. ينتقل الاجتماع الذي مر وقت انتهائه إلى **السابقة**.",
          "عند **هل تم الاجتماع؟** اضغط **تم** أو **لم يحضر**.",
          "للاجتماع الذي تم، أجب عن **هل كان مؤهلًا؟** بـ**نعم** أو **لا**: هل كان مع الشخص المناسب وحول حاجة حقيقية.",
          "ثم اضغط **صار عميلًا**، ويمكنك قبلها كتابة **قيمة الصفقة**، أو افتح **لم يشترِ** واختر السبب: **السعر** أو **التوقيت** أو **لا يحتاجه** أو **اختار منافسًا** أو **توقف عن الرد** أو **سبب آخر**.",
        ] },
        { p: "**كيف تعرف أن التسجيل تم:** تظهر رسالة **تم الحفظ.** وتظهر الوسوم الجديدة على الكارت. تتغير مرحلة العميل إلى ربح أو خسارة، وتُحسب الاجتماعات المؤهلة ضمن هدف الحملة، وتدخل قيمة الصفقة في عائد الحملة. كما توجّه الصفقات الرابحة والخاسرة عمليات البحث التالية." },
        { p: "تحديد **لم يحضر** يرسل إلى الضيف صفحة حجزك ليختار موعدًا آخر، مرة واحدة لكل اجتماع، إذا كانت صفحتك مفتوحة للحجز ولم يطلب العميل عدم التواصل معه." },

        { h2: "مثال" },
        { p: "يرد صاحب عيادة على حملتك: الفكرة تهمني، هل نتكلم الخميس الساعة 11؟ الخميس 11:00 داخل ساعاتك وغير مشغول، فيحجزه يولياس ويؤكده في المحادثة، ويستلم الضيف تأكيدًا فيه **المكان** الذي كتبته، وهو رابط Zoom. صباح الأربعاء يصله تذكير اليوم السابق، وفي نحو الثامنة صباح الخميس يظهر الملخص التحضيري في الكارت. بعد المكالمة تضغط **تم** ثم **نعم**، وتكتب 1,200 قيمةً للصفقة وتضغط **صار عميلًا**. وتعكس **تكلفة الاجتماع** في زيارات الرابط هذا الحجز." },

        { h2: "الصلاحيات والمتطلبات" },
        { ul: [
          "لكل عضو صفحة حجز وساعات خاصة به.",
          "يعدّل المسؤول والمعلن صفحتهما ويسجلان النتائج. ويرى المحلل الاجتماعات، لكنه لا يستطيع حفظ الصفحة أو الإلغاء أو تجهيز الملخص أو تسجيل النتيجة.",
          "لا تُحسب الاجتماعات والحجوزات والتذكيرات من رصيدك.",
          "يستطيع البريد الواحد حجز ثلاثة اجتماعات على الأكثر خلال 24 ساعة، وتطلب المحاولة الرابعة من الضيف الرد على بريد التأكيد بدلًا من ذلك.",
        ] },

        { h2: "ملاحظات مهمة" },
        { ul: [
          "من دون **المكان** لا يكون للاجتماع مكان أو رابط، ولا ينشئ يولياس روابط فيديو.",
          "تُفتح صفحة الحجز بلغة الزائر. أضف ?l=ar أو ?l=en إلى الرابط لتحديد العربية أو الإنجليزية.",
          "تصل رسائل التأكيد والتذكير وإعادة الحجز والإلغاء إلى الضيف باللغة التي حجز بها: لغة صفحة الحجز إذا حجز منها، أو لغة رسالة الحملة التي ردّ عليها إذا حجز يولياس الموعد في المحادثة.",
          "المواعيد في الكروت بالمنطقة الزمنية المحددة في ملفك، والصفحة العامة تعرض لكل ضيف مواعيده بتوقيته.",
          "لا تظهر صفحات الحجز في محركات البحث.",
        ] },

        { h2: "حل المشكلات" },
        { h3: "الصفحة تقول إنها لا تستقبل حجوزات" },
        { p: "**مفتوحة للحجز** متوقفة. فعّلها واضغط **حفظ**." },
        { h3: "الصفحة تقول إنه لا توجد مواعيد متاحة" },
        { p: "راجع **ساعات الأسبوع** ثم **أقل مهلة قبل الاجتماع** و**الحجز متاح لمدة**. فمهلة 48 ساعة مع يومين مفتوحين فقط في الأسبوع قد لا تترك موعدًا." },
        { h3: "يُعرض وقت أنا مشغول فيه" },
        { p: "قبل ربط [تقويم Google](/help-center/google-calendar) لا يحجب المواعيد إلا اجتماعاتك في يولياس. وبعد الربط تُتخطى الأحداث المشغولة في تقويمك الرئيسي على Google فقط." },
        { h3: "يرى الضيف: حُجز هذا الموعد للتو" },
        { p: "سبقه شخص آخر إلى الموعد، فيختار موعدًا غيره." },
        { h3: "لم يعرض يولياس مواعيد في رده" },
        { p: "كانت صفحتك مغلقة أو بلا مواعيد متاحة خلال المدة، فحمل الرد الرابط وحده أو انتقلت المحادثة إليك." },

        { h2: "مقالات ذات صلة" },
        { ul: ["[ربط تقويم Google](/help-center/google-calendar)", "[المحادثات](/help-center/conversations)", "[يولياس AI](/help-center/yolias-ai)", "[قراءة نتائج الحملة](/help-center/campaign-results)"] },
      ],
    },
  },

  "google-calendar": {
    en: {
      title: "Connecting Google Calendar",
      summary: "Connect Google Calendar so every meeting booked in Yolias lands on a calendar in your Google account, your guest gets Google's invitation, and your busy times are skipped on your booking page.",
      updated: "2026-11-05",
      blocks: [
        { p: "Meetings are booked inside Yolias, from your booking page or by Yolias in a conversation. Google Calendar is optional: it copies those meetings into your Google account and reads your busy times so they aren't offered. This article covers what the connection does, what Yolias can and can't see, how to connect and disconnect, and how to fix a connection that fails." },

        { h2: "What does Google Calendar add?" },
        { p: "Without Google Calendar, meetings work fully: they appear in **Meetings**, you and the guest receive emails, and the guest's confirmation carries an Add it to Google Calendar link. With Google Calendar connected:" },
        { ul: [
          "Every new booking becomes an event in your Google account, with the guest invited. Google emails the invitation to the guest.",
          "Your booking page, and the times Yolias offers in replies, skip times that are busy in your main Google calendar.",
          "When a meeting is canceled in Yolias, by you or by the guest, the event is removed and Google tells the guest. If Google can't remove it (the calendar was disconnected or the event is gone), Yolias emails the guest the cancellation itself.",
        ] },
        { p: "Yolias doesn't create video links, Google Meet included. The event carries the **Place** you set on your [booking page](/help-center/deals-and-meetings)." },

        { h2: "How does it work?" },
        { p: "When you connect, Yolias creates a separate calendar named **Yolias meetings** in your Google account. Every booking becomes an event on that calendar, titled with the meeting name and the guest's name. The event holds the meeting description, the guest's note, the place, and the line Booked with Yolias. Its time zone is the one set on your booking page." },
        { p: "Busy times come from Google's free and busy information for your main calendar: Yolias learns only that a time is busy, never the title, guests or details of the event. Events you mark as **Free** in Google Calendar don't block a time. Other calendars you added to your Google account are not read." },

        { h2: "What can Yolias access?" },
        { table: { head: ["Permission Google asks for", "What Yolias does with it"], rows: [
          ["Your email address", "Shows which Google account is connected"],
          ["Make secondary calendars and manage their events", "Creates Yolias meetings and adds, edits and removes events on that calendar only"],
          ["See your free and busy times", "Skips busy times in your main calendar on your booking page"],
        ] } },
        { p: "Yolias can't read, change or delete events on your other calendars." },

        { h2: "When are busy times checked?" },
        { p: "Every time someone opens your booking page, Yolias asks Google for your busy times from the day before until two days past the end of your booking window, and removes those times. It asks again at the moment of booking: if a time became busy after the guest opened the page, the booking is refused with That time was just taken. Pick another one. Yolias also checks your busy times before it offers two times in a reply, and before it books a time a lead named. A named time that is busy in Google isn't booked; Yolias offers two free times instead." },
        { p: "The **Break between meetings** on your booking page applies around Google busy times too. With a 10-minute break and a busy event from 14:00 to 15:00, a 30-minute meeting can't start before 15:10 or end after 13:50." },

        { h2: "What does the guest receive?" },
        { table: { head: ["Moment", "With Google Calendar", "Without Google Calendar"], rows: [
          ["Booking", "Yolias's confirmation, saying an invitation is on its way, and Google's invitation", "Yolias's confirmation with an Add it to Google Calendar link"],
          ["A day and an hour before", "Yolias's reminders with the place and a cancel link", "The same reminders"],
          ["You cancel in Meetings", "Google's cancellation notice", "Yolias's Meeting canceled email"],
          ["The guest cancels from the link", "The event is removed and Google updates the guest", "The meeting is canceled in Yolias"],
        ] } },
        { p: "Marking a meeting **No-show** or recording its outcome doesn't change the Google event." },

        { h2: "Before you connect" },
        { ul: [
          "Pick the Google account whose main calendar holds your real schedule. It doesn't need to be the account you send campaigns from.",
          "Set the **Time zone** on your booking page first. The Yolias meetings calendar is created in that time zone.",
          "In Google Calendar, make sure personal events you want protected are marked **Busy**.",
          "Each teammate who takes meetings connects their own account from their own login. Meetings Yolias books from a reply go to the calendar of the member whose mailbox holds the conversation.",
        ] },

        { h2: "Connect your calendar" },
        { ol: [
          "In the sidebar, open **Integrations**. You can filter the list with **Calendar**.",
          "On the **Google Calendar** card, press **Connect**. Google's sign-in page opens directly. You can also open **Details** first and press **Connect** there.",
          "Choose the Google account you want meetings to land in.",
          "Read the permissions. If Google shows them as separate boxes, check both calendar permissions, then continue.",
          "Google returns you to the Google Calendar page in Yolias.",
        ] },
        { p: "**How to know it worked:** the page shows Google Calendar is connected. and **Connected as** with your Google address, and the card in Integrations shows **1 connected**. In Google Calendar, **Yolias meetings** appears in your calendar list. On the **Booking page** tab in Meetings, the line under your link also shows **Connected as** with your address." },
        { p: "**If it didn't work:** the page shows one of the messages in Troubleshooting below. Nothing changes on your booking page; it keeps working without Google Calendar." },

        { h2: "Can I change the events in Google Calendar?" },
        { p: "Changes go one way, from Yolias to Google. If you move, edit or delete an event on **Yolias meetings** in Google Calendar, the meeting in Yolias keeps its original time, the guest's reminders keep that time, and your booking page keeps treating it as booked. To change a meeting, cancel it in **Meetings**. You can still change the calendar's color, hide it, or share it with a colleague in Google Calendar; keep the calendar itself, because deleting it makes new events fail." },

        { h2: "Disconnect" },
        { ol: [
          "Open **Integrations** and press **Details** on the **Google Calendar** card.",
          "Press **Disconnect**.",
        ] },
        { p: "Yolias deletes its access to your Google account. New bookings no longer reach Google, busy times are no longer read, and guests of new bookings get the Add it to Google Calendar link instead of an invitation. The **Yolias meetings** calendar and the events already on it stay in your Google account; delete the calendar in Google Calendar if you no longer want it." },
        { p: "Disconnecting deletes the access key Yolias kept. Yolias still appears in the list of connected apps in your Google account until you remove it there, from your Google account's security settings. If you remove it there first, a red message can appear on the Google Calendar page in Yolias after the next visit to your booking page or the next booking, and stays until you press **Disconnect**." },

        { h2: "Example" },
        { p: "You connect your work Google account. On Wednesday at 15:00 you have a client visit marked Busy in your main calendar, and on Thursday morning a Free reminder to call the bank. A lead opens your booking page: Wednesday 15:00 isn't offered, Thursday morning is. The lead books Thursday at 10:00. The meeting appears in **Meetings**, an event appears on **Yolias meetings** with the lead invited, and the lead accepts from Google's invitation email. Two days later the lead cancels from the link in Yolias's confirmation: the event disappears from your calendar and the time is free again." },
        { p: "In another case, a lead replies to your campaign: Does Wednesday at 15:00 work? That time is busy with the client visit in your main calendar, so Yolias doesn't book it and replies in the same thread with two free times and your booking page. The lead picks one, and the booking reaches your calendar as in the first example." },

        { h2: "Permissions and requirements" },
        { ul: [
          "Each member connects their own Google account; it applies to their own booking page only. Connecting doesn't affect teammates.",
          "One Google account per member. To change account, disconnect and connect the other one.",
          "Admins and Advertisers can connect. An Analyst who presses **Connect** returns with Google Calendar couldn't be connected. Try again.",
          "Any Google account works, a personal Gmail address or Google Workspace.",
          "Connecting Google Calendar is free and doesn't use credit.",
        ] },

        { h2: "Important notes" },
        { ul: [
          "Google is still reviewing the Yolias app. Until the review is complete, Google can show a warning on the permission screen or limit which accounts can connect.",
          "Connecting the same Google account again keeps the same **Yolias meetings** calendar, so meetings stay in one place. Connecting a different Google account creates a new calendar there; meetings booked before stay on the calendar of the first account.",
          "If you cancel a meeting whose event was created under an earlier connection, or while Google Calendar is disconnected, the event stays in Google and the guest isn't sent a cancellation. Tell the guest yourself and delete the event in Google Calendar.",
          "Meetings booked before you connected aren't copied to Google.",
          "If Google doesn't answer when a meeting is booked, the meeting is still saved in Yolias and both emails are sent; only the Google event is missing.",
        ] },

        { h2: "Troubleshooting" },
        { h3: "The button shows Not available" },
        { p: "Google sign-in isn't set up in Yolias at this time. Your booking page keeps working; guests get the Add it to Google Calendar link." },
        { h3: "Google Calendar wasn't connected: permission was declined." },
        { p: "You pressed Cancel on Google's screen, or didn't allow the calendar permission. Connect again and allow it." },
        { h3: "Google Calendar couldn't be connected. Try again." },
        { p: "The connection took too long, was started in another browser, or your role is Analyst. Start again from **Integrations** in the same browser. If Google blocks the account while its review is in progress, contact [support](/contact?topic=support)." },
        { h3: "Reconnect Google Calendar appears in red" },
        { p: "Google no longer accepts Yolias's access: the permission was removed in your Google account or expired. Press **Disconnect**, then **Connect**." },
        { h3: "Google Calendar didn't answer appears in red" },
        { p: "Google refused or didn't answer a request, for example after you deleted the Yolias meetings calendar. The message clears by itself on the next successful request. If it stays, disconnect and connect again." },
        { h3: "A busy time is still offered" },
        { p: "Check that the event is on your main calendar and marked **Busy**, not **Free**. If you connected before busy times were read, or didn't allow the free and busy permission, the Google Calendar page in Integrations says Yolias can't see when you're busy. Disconnect and connect again, and allow it." },
        { h3: "I see two Yolias meetings calendars" },
        { p: "Connections made before Yolias kept the calendar on reconnect created a new one each time. New bookings go to the newest one. Keep the older calendar until its meetings have passed, then delete it in Google Calendar." },
        { h3: "Meetings are offered at the wrong hour" },
        { p: "Your weekly hours are read in the **Time zone** of your booking page, not in your Google Calendar's time zone. Correct the time zone on the **Booking page** tab and press **Save**." },
        { h3: "The guest didn't get Google's invitation" },
        { p: "Ask the guest to check spam. The invitation comes from Google, separately from Yolias's confirmation." },

        { h2: "Related articles" },
        { ul: ["[Meetings and your booking page](/help-center/deals-and-meetings)", "[Connecting Gmail](/help-center/connect-gmail)", "[Adding people](/help-center/inviting-teammates)"] },
      ],
    },
    ar: {
      title: "ربط تقويم Google",
      summary: "اربط تقويم Google ليصل كل اجتماع يُحجز في يولياس إلى تقويم في حسابك على Google، ويستلم ضيفك دعوة Google، وتُتخطى أوقات انشغالك في صفحة الحجز.",
      updated: "2026-11-05",
      blocks: [
        { p: "تُحجز الاجتماعات داخل يولياس، من صفحة الحجز أو يحجزها يولياس في المحادثة. وربط تقويم Google اختياري: ينسخ هذه الاجتماعات إلى حسابك على Google، ويقرأ أوقات انشغالك حتى لا تُعرض. يشرح هذا المقال ما يفعله الربط، وما يراه يولياس وما لا يراه، وطريقة الربط والفصل، وحل مشكلات الربط." },

        { h2: "ماذا يضيف تقويم Google؟" },
        { p: "من دون تقويم Google تعمل الاجتماعات كاملة: تظهر في **الاجتماعات**، وتستلم أنت والضيف رسائل البريد، ويحمل تأكيد الضيف رابطًا لإضافة الاجتماع إلى تقويم Google. ومع ربط التقويم:" },
        { ul: [
          "يصبح كل حجز جديد حدثًا في حسابك على Google والضيف مدعو إليه، وترسل Google الدعوة إلى بريد الضيف.",
          "تتخطى صفحة حجزك، والمواعيد التي يعرضها يولياس في ردوده، الأوقات المشغولة في تقويمك الرئيسي على Google.",
          "عند إلغاء اجتماع في يولياس، منك أو من الضيف، يُحذف الحدث وتُبلغ Google الضيف. وإذا تعذّر على Google حذفه (فُصل التقويم أو لم يعد الحدث موجودًا) يرسل يولياس إلى الضيف رسالة الإلغاء بنفسه.",
        ] },
        { p: "لا ينشئ يولياس روابط فيديو، ولا روابط Google Meet. ويحمل الحدث **المكان** الذي حددته في [صفحة الحجز](/help-center/deals-and-meetings)." },

        { h2: "كيف يعمل؟" },
        { p: "عند الربط ينشئ يولياس تقويمًا منفصلًا باسم **Yolias meetings** في حسابك على Google، ويصبح كل حجز حدثًا فيه، عنوانه اسم الاجتماع واسم الضيف. ويحتوي الحدث على وصف الاجتماع وملاحظة الضيف والمكان وسطر Booked with Yolias، وتوقيته هو المنطقة الزمنية المحددة في صفحة الحجز." },
        { p: "تأتي أوقات الانشغال من معلومات الفراغ والانشغال التي توفرها Google لتقويمك الرئيسي: يعرف يولياس فقط أن الوقت مشغول، ولا يرى عنوان الحدث أو ضيوفه أو تفاصيله. والأحداث التي تحددها **متاح** في تقويم Google لا تحجب الموعد. ولا تُقرأ التقاويم الأخرى المضافة إلى حسابك." },

        { h2: "إلى ماذا يصل يولياس؟" },
        { table: { head: ["الإذن الذي تطلبه Google", "ما يفعله يولياس به"], rows: [
          ["عنوان بريدك", "يعرض حساب Google المرتبط"],
          ["إنشاء تقاويم ثانوية وإدارة أحداثها", "ينشئ Yolias meetings ويضيف الأحداث ويعدّلها ويحذفها في هذا التقويم وحده"],
          ["رؤية أوقات فراغك وانشغالك", "يتخطى الأوقات المشغولة في تقويمك الرئيسي داخل صفحة الحجز"],
        ] } },
        { p: "لا يستطيع يولياس قراءة أحداث تقاويمك الأخرى أو تعديلها أو حذفها." },

        { h2: "متى تُراجع أوقات الانشغال؟" },
        { p: "في كل مرة يفتح فيها شخص صفحة حجزك، يطلب يولياس من Google أوقات انشغالك من اليوم السابق حتى يومين بعد نهاية مدة الحجز المتاحة، ويحذف هذه الأوقات من الصفحة. ثم يطلبها مرة أخرى لحظة الحجز: فإذا انشغل الموعد بعد أن فتح الضيف الصفحة يُرفض الحجز برسالة: حُجز هذا الموعد للتو. اختر موعدًا آخر. ويراجع يولياس أوقات انشغالك أيضًا قبل أن يعرض موعدين في رده، وقبل أن يحجز موعدًا ذكره العميل. فالموعد الذي يذكره العميل وهو مشغول في Google لا يُحجز، ويعرض يولياس بدلًا منه موعدين متاحين." },
        { p: "تنطبق **استراحة بين الاجتماعات** المحددة في صفحة حجزك على أوقات الانشغال في Google أيضًا. فمع استراحة 10 دقائق وحدث مشغول من 14:00 إلى 15:00، لا يمكن أن يبدأ اجتماع مدته 30 دقيقة قبل 15:10، ولا أن ينتهي بعد 13:50." },

        { h2: "ماذا يصل الضيف؟" },
        { table: { head: ["اللحظة", "مع تقويم Google", "من دون تقويم Google"], rows: [
          ["الحجز", "تأكيد من يولياس يذكر أن الدعوة في الطريق، ثم دعوة Google", "تأكيد من يولياس فيه رابط لإضافة الاجتماع إلى تقويم Google"],
          ["قبل الموعد بيوم وبساعة", "تذكيرات يولياس ومعها المكان ورابط الإلغاء", "التذكيرات نفسها"],
          ["تلغي أنت من الاجتماعات", "إشعار الإلغاء من Google", "بريد إلغاء من يولياس"],
          ["يلغي الضيف من الرابط", "يُحذف الحدث وتُبلغ Google الضيف بالتحديث", "يُلغى الاجتماع في يولياس"],
        ] } },
        { p: "تحديد الاجتماع **لم يحضر** أو تسجيل نتيجته لا يغيّر حدث Google." },

        { h2: "قبل أن تربط" },
        { ul: [
          "اختر حساب Google الذي يحمل تقويمه الرئيسي مواعيدك الفعلية. ولا يلزم أن يكون هو الحساب الذي ترسل منه حملاتك.",
          "اضبط **المنطقة الزمنية** في صفحة الحجز أولًا، لأن تقويم Yolias meetings يُنشأ بهذه المنطقة الزمنية.",
          "تأكد في تقويم Google أن الأحداث الشخصية التي تريد حمايتها بحالة **مشغول**.",
          "كل زميل يستقبل اجتماعات يربط حسابه بنفسه من حسابه في يولياس. والاجتماعات التي يحجزها يولياس من رد تذهب إلى تقويم العضو الذي تجري المحادثة من بريده.",
        ] },

        { h2: "اربط تقويمك" },
        { ol: [
          "من الشريط الجانبي افتح **التكاملات**. ويمكنك تصفية القائمة بالتقويم.",
          "في كارت **تقويم Google** اضغط **اربط**. تفتح صفحة الدخول من Google مباشرة. ويمكنك أيضًا فتح **التفاصيل** أولًا والضغط على **اربط** هناك.",
          "اختر حساب Google الذي تريد أن تصل إليه الاجتماعات.",
          "اقرأ الأذونات. وإذا عرضتها Google في مربعات منفصلة فحدد إذني التقويم كليهما، ثم تابع.",
          "تعيدك Google إلى صفحة تقويم Google داخل يولياس.",
        ] },
        { p: "**كيف تعرف أن الربط نجح:** تعرض الصفحة رسالة **تم ربط تقويم Google.** ومعها **مرتبط بـ** وعنوانك على Google، ويعرض الكارت في التكاملات **1 متصل**. وفي تقويم Google يظهر **Yolias meetings** في قائمة تقاويمك. كما يعرض السطر تحت رابطك في تبويب **صفحة الحجز** عبارة **مرتبط بـ** مع عنوانك." },
        { p: "**إذا لم ينجح:** تعرض الصفحة إحدى الرسائل الواردة في حل المشكلات أدناه. ولا يتغير شيء في صفحة الحجز، فهي تعمل من دون تقويم Google." },

        { h2: "هل أستطيع تعديل الأحداث في تقويم Google؟" },
        { p: "تسير التغييرات في اتجاه واحد، من يولياس إلى Google. فإذا نقلت حدثًا في **Yolias meetings** أو عدّلته أو حذفته من تقويم Google، يبقى الاجتماع في يولياس على موعده الأصلي، وتصل تذكيرات الضيف على هذا الموعد، وتظل صفحة حجزك تعامله على أنه محجوز. لتغيير اجتماع ألغِه من **الاجتماعات**. ويمكنك مع ذلك تغيير لون التقويم أو إخفاؤه أو مشاركته مع زميل من تقويم Google، لكن أبقِ التقويم نفسه، لأن حذفه يجعل إضافة الأحداث الجديدة تفشل." },

        { h2: "فصل التقويم" },
        { ol: [
          "افتح **التكاملات** واضغط **التفاصيل** في كارت **تقويم Google**.",
          "اضغط **فصل**.",
        ] },
        { p: "يحذف يولياس وصوله إلى حسابك على Google. فلا تصل الحجوزات الجديدة إلى Google، ولا تُقرأ أوقات الانشغال، ويستلم ضيوف الحجوزات الجديدة رابط الإضافة إلى تقويم Google بدل الدعوة. ويبقى تقويم **Yolias meetings** والأحداث التي فيه داخل حسابك على Google، فاحذفه من تقويم Google إذا لم تعد تحتاجه." },
        { p: "يحذف الفصل مفتاح الوصول الذي كان يحتفظ به يولياس، لكن يولياس يظل ظاهرًا في قائمة التطبيقات المتصلة بحسابك على Google حتى تزيله بنفسك. ولإزالته افتح إعدادات الأمان في حسابك على Google، ثم قائمة التطبيقات والخدمات المتصلة، واختر يولياس وأزل وصوله. وإذا أزلته من هناك قبل الفصل في يولياس، فقد تظهر رسالة حمراء في صفحة التقويم بعد أول زيارة لصفحة حجزك أو أول حجز جديد، وتبقى ظاهرة حتى تضغط **فصل** في صفحة تقويم Google داخل يولياس." },

        { h2: "مثال" },
        { p: "تربط حساب Google الخاص بعملك. يوم الأربعاء الساعة 15:00 لديك زيارة عميل بحالة مشغول في تقويمك الرئيسي، وصباح الخميس تذكير بحالة متاح للاتصال بالبنك. يفتح عميل صفحة حجزك: موعد الأربعاء 15:00 لا يظهر، وصباح الخميس يظهر. يحجز العميل الخميس الساعة 10:00. يظهر الاجتماع في **الاجتماعات**، ويظهر حدث في **Yolias meetings** والعميل مدعو إليه، فيقبل الدعوة من بريد Google. وبعد يومين يلغي العميل من الرابط الموجود في تأكيد يولياس، فيختفي الحدث من تقويمك ويعود الموعد متاحًا." },
        { p: "وفي حالة أخرى يرد عميل على حملتك قائلًا: هل يناسبك الأربعاء الساعة 15:00؟ هذا الوقت مشغول بزيارة العميل في تقويمك الرئيسي، فلا يحجزه يولياس، ويرد في المحادثة نفسها بموعدين متاحين ورابط صفحة حجزك. ويختار العميل أحدهما، فيصل الحجز إلى تقويمك كما في المثال الأول." },

        { h2: "الصلاحيات والمتطلبات" },
        { ul: [
          "يربط كل عضو حسابه على Google، ويخص الربط صفحة حجزه وحده ولا يؤثر في زملائه.",
          "حساب Google واحد لكل عضو. لتغيير الحساب افصل الحالي ثم اربط الآخر.",
          "يستطيع المسؤول والمعلن الربط. أما المحلل فإذا ضغط **اربط** يعود برسالة: تعذر ربط تقويم Google. حاول مرة أخرى.",
          "يعمل أي حساب Google، سواء بريد Gmail شخصي أو Google Workspace.",
          "ربط تقويم Google مجاني ولا يُخصم من رصيدك.",
        ] },

        { h2: "ملاحظات مهمة" },
        { ul: [
          "ما زالت Google تراجع تطبيق يولياس. وحتى تكتمل المراجعة قد تعرض Google تحذيرًا في شاشة الأذونات، أو تحدد الحسابات التي تستطيع الربط.",
          "إعادة ربط حساب Google نفسه تُبقي تقويم **Yolias meetings** نفسه، فتبقى الاجتماعات في مكان واحد. أما ربط حساب Google آخر فينشئ تقويمًا جديدًا فيه، وتبقى الاجتماعات السابقة في تقويم الحساب الأول.",
          "إذا ألغيت اجتماعًا أُنشئ حدثه في ربط سابق، أو ألغيته والتقويم مفصول، يبقى الحدث في Google ولا يُرسل إلى الضيف إشعار بالإلغاء. أبلغ الضيف بنفسك واحذف الحدث من تقويم Google.",
          "لا تُنسخ إلى Google الاجتماعات المحجوزة قبل الربط.",
          "إذا لم تستجب Google وقت الحجز يُحفظ الاجتماع في يولياس وتُرسل الرسالتان، ولا يغيب إلا حدث Google.",
        ] },

        { h2: "حل المشكلات" },
        { h3: "الزر يعرض غير متاح" },
        { p: "تسجيل الدخول بـGoogle غير مفعّل في يولياس حاليًا. وتظل صفحة الحجز تعمل، ويستلم الضيوف رابط الإضافة إلى تقويم Google." },
        { h3: "لم يتم ربط تقويم Google: رُفض الإذن." },
        { p: "ضغطت إلغاء في شاشة Google، أو لم تسمح بإذن التقويم. اربط مجددًا واسمح به." },
        { h3: "تعذر ربط تقويم Google. حاول مرة أخرى." },
        { p: "استغرق الربط وقتًا طويلًا، أو بدأ في متصفح آخر، أو دورك محلل. ابدأ من جديد من **التكاملات** في المتصفح نفسه. وإذا حظرت Google الحساب أثناء مراجعتها فتواصل مع [الدعم](/contact?topic=support)." },
        { h3: "تظهر رسالة حمراء: Reconnect Google Calendar" },
        { p: "لم تعد Google تقبل وصول يولياس، لأن الإذن أُزيل من حسابك أو انتهت صلاحيته. اضغط **فصل** ثم **اربط**." },
        { h3: "تظهر رسالة حمراء: Google Calendar didn't answer" },
        { p: "رفضت Google طلبًا أو لم تستجب له، مثلًا بعد حذفك تقويم Yolias meetings. وتختفي الرسالة وحدها عند أول طلب ناجح، فإن بقيت فافصل التقويم واربطه مجددًا." },
        { h3: "ما زال وقت مشغول يُعرض" },
        { p: "تأكد أن الحدث في تقويمك الرئيسي وبحالة **مشغول** وليس **متاح**. وإذا ربطت قبل أن يبدأ يولياس في قراءة أوقات الانشغال، أو لم تسمح بإذن الفراغ والانشغال، تعرض صفحة تقويم Google في التكاملات أن يولياس لا يرى أوقات انشغالك. افصل التقويم واربطه مجددًا واسمح بالإذن." },
        { h3: "أرى تقويمين باسم Yolias meetings" },
        { p: "الربط المتكرر قبل أن يحتفظ يولياس بالتقويم عند إعادة الربط كان ينشئ تقويمًا جديدًا كل مرة، والحجوزات الجديدة تذهب إلى أحدثهما. احتفظ بالتقويم الأقدم حتى تمر اجتماعاته، ثم احذفه من تقويم Google." },
        { h3: "تُعرض المواعيد في ساعة خاطئة" },
        { p: "تُقرأ ساعاتك الأسبوعية بحسب **المنطقة الزمنية** المحددة في صفحة الحجز، وليس بحسب المنطقة الزمنية لتقويم Google. صحح المنطقة الزمنية في تبويب **صفحة الحجز** ثم اضغط **حفظ**." },
        { h3: "لم تصل الضيف دعوة Google" },
        { p: "اطلب منه مراجعة الرسائل غير المرغوب فيها. فالدعوة تأتي من Google منفصلة عن تأكيد يولياس." },

        { h2: "مقالات ذات صلة" },
        { ul: ["[الاجتماعات وصفحة الحجز](/help-center/deals-and-meetings)", "[ربط Gmail](/help-center/connect-gmail)", "[إضافة الأشخاص](/help-center/inviting-teammates)"] },
      ],
    },
  },

  "choosing-a-plan": {
    en: {
      title: "Pay As You Go or a monthly plan",
      summary: "Signing up is free and you pay when you launch a campaign. How leads are counted, what each option costs, how to pay, and how to choose between credit and a plan.",
      updated: "2026-11-05",
      blocks: [
        { p: "Signing up to Yolias is free. You can set up your company, build a campaign and its audiences without paying. Payment comes when you launch a campaign: you top up credit from $5, or choose a monthly plan. This article explains what you pay for, the three options, how to pay, and how to pick the one that fits." },

        { h2: "What do you pay for?" },
        { p: "You pay for **leads**. A lead is a person Yolias finds and reaches for your campaigns. It is the only unit:" },
        { ul: [
          "Writing emails, sending them, replies, conversations, meetings and reminders are never charged.",
          "The same lead is never counted twice, even when several campaigns reach them.",
          "Every option includes every Yolias feature and unlimited users.",
        ] },

        { h2: "What are the options?" },
        { table: { head: ["Option", "Price", "Leads", "Cost per lead"], rows: [
          ["Pay As You Go", "Free to sign up, top up $5, $20, $50 or $100", "50, 200, 500 or 1,000", "10 cents"],
          ["Yolias Growth", "$100 a month, or $80 a month billed $960 yearly", "2,000 a month", "5 cents, 4 cents on annual"],
          ["Yolias Scale", "$200 a month, or $160 a month billed $1,920 yearly", "4,000 a month", "5 cents, 4 cents on annual"],
        ] } },
        { p: "Prices are in US dollars and don't include applicable tax." },

        { h2: "How does paying from Egypt work?" },
        { p: "In Egypt the card is charged in Egyptian pounds. Checkout shows the dollar price and, under the total, **You’ll pay in Egyptian pounds** with the amount. Growth and Scale have a set price in pounds; credit packs are converted from dollars at the day's exchange rate. Your balance and usage in Yolias stay in dollars." },

        { h2: "How does Pay As You Go work?" },
        { p: "Pay As You Go is prepaid credit. You buy a pack, the leads are added once the payment is confirmed, and they stay until you use them: no subscription, no renewal and no expiry date. You top up again whenever you need more. Credit belongs to the workspace, not to one campaign: every campaign draws from it, and every member sees it in **Settings → Usage**." },

        { h2: "How does a plan work?" },
        { p: "Growth and Scale give a set number of leads each month. The leads reset on the first day of every calendar month, and leads you didn't use don't carry over. Annual billing is 20% off: you pay once a year and still receive the monthly leads every month." },
        { p: "The count follows the calendar month, not your payment date. If you subscribe to Growth on the 20th, you have the full 2,000 leads until the end of that month, and a new 2,000 on the 1st." },
        { p: "Monthly plans renew every month and annual plans every year, from the card you paid with, until you cancel. You receive a reminder email seven days before each renewal." },
        { p: "On a plan you can still buy credit. The plan's monthly leads are used first, then the credit." },

        { h2: "How do I pay when I launch?" },
        { ol: [
          "Build your campaign and press launch. If your workspace has no credit and no plan, the campaign is saved as a draft, the message Top up or choose a plan to launch a campaign. appears, and Yolias opens **Settings → Usage**.",
          "Under **Top up**, find **Credit packs** and press **Buy** next to the amount you want. To choose a plan instead, press **Upgrade** at the top of the page.",
          "You are taken to the secure payment page. Pay by card: Visa, Mastercard or Meeza.",
          "You return to Yolias. Open your campaign draft and launch it again.",
        ] },
        { p: "**How to know it worked:** **Your available balance** at the top of **Settings → Usage** rises, and the payment appears under **Invoices** in **Settings → Billing**. If the balance hasn't changed, the payment wasn't confirmed: nothing was added, and you can try again." },

        { h2: "How do I choose on the checkout page?" },
        { p: "**Upgrade** in **Settings → Usage**, or **Upgrade** (**Adjust plan** when you already have a plan) in **Settings → Billing**, opens the checkout page. It lists **Pay As You Go**, **Yolias Growth** (marked **Recommended**) and **Yolias Scale**." },
        { ol: [
          "For a plan, choose **Monthly** or **Annual** (**Save 20%**) at the top, then press the plan. **Order summary** shows the amount, **Tax** (**Not included**) and **Total due today**.",
          "For credit, press **Pay As You Go**, then pick an amount under **Choose your top-up**. Each amount shows the leads it gives.",
          "Press **Continue to payment** for a plan, or **Pay** with the amount for credit, and complete the card payment.",
        ] },
        { p: "**How to know it worked:** for a plan, **Settings → Billing** shows the plan's name, price and the line Your subscription will auto-renew on, with the date. For credit, the balance rises." },

        { h2: "Where do I see my balance and usage?" },
        { p: "Open your name at the bottom of the sidebar, then **Settings → Usage**. The page is titled **Credit and billing** and shows:" },
        { ul: [
          "**Your available balance**: the leads you have left, shown in dollars at your current rate (10 cents a lead on Pay As You Go, 5 cents on Growth or Scale). Under it, **Renews on** with the date the monthly leads reset, or **Prepaid credit · Never expires** without a plan.",
          "**Top up**: the credit packs with **Buy**.",
          "**Your usage**: what your balance went on, in four lines: **Search and audience discovery**, **Customer data lookup**, **Message creation and outreach** and **Running ad campaigns**. A line with nothing spent shows a dash.",
          "**Account spending limit**: an optional cap on spend.",
        ] },
        { p: "For example, a $20 pack adds 200 leads and shows as $20.00 on Pay As You Go. If you then choose Growth, the same 200 leads show as $10.00 next to the plan's own leads." },

        { h2: "Set a spending limit" },
        { ol: [
          "In **Settings → Usage**, find **Account spending limit**. It shows **No limit** until you set one.",
          "Enter an amount in dollars (at least 1) and press **Save limit**.",
          "A bar shows how much is spent of the limit since the date the count started.",
        ] },
        { p: "When the limit is reached, Yolias stops finding new people until you raise it or press **Reset** to start counting from now. Conversations already running continue. **Remove** deletes the limit." },

        { h2: "What happens at each renewal?" },
        { p: "At the end of each period Yolias issues a renewal invoice and charges the card saved at your first payment, when one is saved. When the charge succeeds, the plan continues and the payer receives a receipt. When it fails or no card is saved, the invoice shows **Due**, owners and Admins receive it by email, and Yolias tries the card again once a day. You can also open the invoice and press **Pay now**. The plan keeps working for seven days after the period ends; if the invoice is still unpaid then, the plan ends." },

        { h2: "What happens to your leads when a campaign runs?" },
        { p: "When a campaign starts, Yolias sets aside the leads it plans to reach, so two campaigns launched at the same moment can't spend the same leads. Leads are counted, and leave **Your available balance**, as Yolias delivers people to the campaign. Leads set aside but not used become free again." },

        { h2: "Where are my receipts and invoices?" },
        { p: "After each payment the person who paid receives a receipt by email. Every invoice, for a plan or for credit, is listed under **Invoices** in **Settings → Billing** with its **Date**, **Total** and **Status** (**Paid**, **Due** or **Void**). Press **View** to open it, then **Download PDF** to save or print it. Only the workspace owner and Admins see this section." },

        { h2: "Which option fits?" },
        { table: { head: ["If you", "Choose"], rows: [
          ["Want to test one campaign first", "Pay As You Go, from $5"],
          ["Reach fewer than about 1,000 people a month, or irregularly", "Pay As You Go"],
          ["Reach 1,000 to 2,000 people every month", "Growth"],
          ["Reach more than 2,000 people a month", "Scale, and top up credit above 4,000"],
          ["Know you will run campaigns all year", "Annual billing on Growth or Scale"],
        ] } },

        { h2: "Can I switch later?" },
        { p: "Yes. From Pay As You Go, press **Upgrade** and choose a plan at any time; credit you already bought stays and is used after the plan's leads. From a plan, choose another plan with **Adjust plan**, or cancel it and keep using credit. The details are in [Changing or canceling your plan](/help-center/changing-plan)." },

        { h2: "Examples" },
        { ul: [
          "A bakery tests one campaign with $5: 50 leads. Three of them reply and one books a tasting. The replies and the meeting cost nothing extra. It tops up $20 for 200 more leads.",
          "An agency reaches about 1,500 people a month. On credit that costs $150 a month; on Growth, $100 for up to 2,000.",
          "A software company on Scale uses its 4,000 leads by the 25th. It buys a $50 pack: 500 more leads keep its campaigns running until the leads reset on the 1st.",
        ] },

        { h2: "Permissions and requirements" },
        { ul: [
          "Only the workspace owner and Admins can pay, choose a plan, buy credit or set the spending limit. Others see Only the workspace owner or an admin can buy leads.",
          "Advertisers and Analysts see the balance, the usage lines and the spending limit, without changing them.",
          "Payments go through Paymob's secure page, by card.",
          "Every option has unlimited users, so adding people never changes the price.",
        ] },

        { h2: "Important notes" },
        { ul: [
          "When your leads run out, campaigns pause finding new people. After you top up or subscribe, paused campaigns continue by themselves.",
          "Credit doesn't expire, and it stays when a plan ends.",
          "There is no free trial: the first payment is the one at launch, and you can build and review your whole campaign before it.",
          "Refunds follow the [Refund Policy](/legal/refunds).",
        ] },

        { h2: "Troubleshooting" },
        { h3: "Buy or Upgrade isn't shown" },
        { p: "Your role isn't Admin, or payments are switched off at the moment. **Upgrade** is also hidden on Scale, the largest plan." },
        { h3: "Payment isn’t available right now appears at checkout" },
        { p: "Card payments are unavailable at this time. Your campaign stays saved as a draft; try again later." },
        { h3: "Launch says the balance is empty, but Usage shows a balance" },
        { p: "Campaigns already running hold the leads they set aside, and Usage counts only leads already delivered. Top up, or wait for a running campaign to finish." },
        { h3: "I paid but the campaign didn't launch" },
        { p: "Payment doesn't launch a campaign by itself. Open the draft and launch it again." },
        { h3: "The balance in dollars changed when I moved to a plan" },
        { p: "Your leads didn't change; the balance is shown at the plan's rate of 5 cents a lead instead of 10." },

        { h2: "Related articles" },
        { ul: ["[Changing or canceling your plan](/help-center/changing-plan)", "[Budget and optimization](/help-center/budget-and-optimization)", "[Creating a campaign](/help-center/creating-a-campaign)", "[Pricing](/pricing)"] },
      ],
    },
    ar: {
      title: "الدفع حسب الاستخدام أو الخطة الشهرية",
      summary: "التسجيل مجاني وتدفع عند تشغيل الحملة. كيف تُحسب العملاء، وكم يكلف كل خيار، وكيف تدفع، وكيف تختار بين الرصيد والخطة.",
      updated: "2026-11-05",
      blocks: [
        { p: "التسجيل في يولياس مجاني. تستطيع إعداد بيانات شركتك وبناء حملة وجماهيرها دون أن تدفع شيئًا. ويأتي الدفع عند تشغيل الحملة: تشحن رصيدًا يبدأ من 5 دولارات، أو تختار خطة شهرية. يشرح هذا المقال مقابل ماذا تدفع، والخيارات الثلاثة، وطريقة الدفع، وكيف تختار ما يناسبك." },

        { h2: "مقابل ماذا تدفع؟" },
        { p: "تدفع مقابل **العملاء**. العميل شخص يجده يولياس ويصل إليه لحملاتك، وهو الوحدة الوحيدة للحساب:" },
        { ul: [
          "كتابة الرسائل وإرسالها والردود والمحادثات والاجتماعات والتذكيرات لا تُحسب أبدًا.",
          "لا يُحسب العميل نفسه مرتين، حتى لو وصلت إليه أكثر من حملة.",
          "كل خيار يشمل كل ميزات يولياس وعددًا غير محدود من المستخدمين.",
        ] },

        { h2: "ما الخيارات المتاحة؟" },
        { table: { head: ["الخيار", "السعر", "العملاء", "تكلفة العميل"], rows: [
          ["الدفع حسب الاستخدام", "تسجيل مجاني، وشحن بـ5 أو 20 أو 50 أو 100 دولار", "50 أو 200 أو 500 أو 1,000", "10 سنتات"],
          ["يولياس للنمو", "100 دولار شهريًا، أو 80 دولارًا شهريًا تُدفع 960 دولارًا سنويًا", "2,000 شهريًا", "5 سنتات، و4 سنتات في الدفع السنوي"],
          ["يولياس للتوسع", "200 دولار شهريًا، أو 160 دولارًا شهريًا تُدفع 1,920 دولارًا سنويًا", "4,000 شهريًا", "5 سنتات، و4 سنتات في الدفع السنوي"],
        ] } },
        { p: "الأسعار بالدولار الأمريكي ولا تشمل الضرائب المطبقة." },

        { h2: "كيف يتم الدفع من مصر؟" },
        { p: "في مصر تُخصم المبالغ من البطاقة بالجنيه المصري. تعرض صفحة الدفع السعر بالدولار، وتحت الإجمالي سطر **ستدفع بالجنيه المصري** ومعه المبلغ. ولخطتي النمو والتوسع سعر ثابت بالجنيه، أما باقات الرصيد فتُحوَّل من الدولار بسعر الصرف في يوم الدفع. ويبقى رصيدك واستهلاكك داخل يولياس معروضين بالدولار." },

        { h2: "كيف يعمل الدفع حسب الاستخدام؟" },
        { p: "الدفع حسب الاستخدام رصيد مسبق الدفع. تشتري باقة، فيُضاف عملاؤها بعد تأكيد الدفع، ويبقون حتى تستخدمهم: بلا اشتراك ولا تجديد ولا تاريخ انتهاء. وتشحن من جديد متى احتجت المزيد. والرصيد ملك لمساحة العمل كلها وليس لحملة واحدة: تسحب منه كل الحملات، ويراه كل الأعضاء في **الإعدادات ← الاستخدام**، لكن الشحن نفسه يقتصر على المالك والمسؤول." },

        { h2: "كيف تعمل الخطة؟" },
        { p: "تمنحك خطتا النمو والتوسع عددًا ثابتًا من العملاء كل شهر. يتجدد العدد في أول يوم من كل شهر ميلادي، ولا يُرحَّل ما لم تستخدمه إلى الشهر التالي. والدفع السنوي بخصم 20%: تدفع مرة في السنة، وتحصل على عملاء الخطة كل شهر كالمعتاد." },
        { p: "يتبع العد الشهر الميلادي وليس تاريخ دفعتك. فإذا اشتركت في النمو يوم 20 من الشهر، يكون لديك 2,000 عميل كاملة حتى نهاية ذلك الشهر، ثم 2,000 جديدة في أول الشهر التالي." },
        { p: "تتجدد الخطة الشهرية كل شهر والسنوية كل سنة من البطاقة التي دفعت بها، حتى تلغيها. ويصلك بريد تذكير قبل كل تجديد بسبعة أيام." },
        { p: "ويمكنك شراء رصيد وأنت على خطة. فتُستخدم عملاء الخطة الشهريون أولًا، ثم الرصيد." },

        { h2: "كيف أدفع عند تشغيل الحملة؟" },
        { ol: [
          "ابنِ حملتك واضغط تشغيل. إذا لم يكن في مساحة عملك رصيد ولا خطة، تُحفظ الحملة مسودة، وتظهر رسالة: اشحن رصيدك أو اختر باقة لتشغيل حملة. ثم يفتح يولياس **الإعدادات ← الاستخدام**.",
          "في **شحن الرصيد** ستجد **باقات شحن الرصيد**، فاضغط **شراء** بجوار المبلغ الذي تريده. ولاختيار خطة بدلًا من ذلك اضغط **ترقية** أعلى الصفحة.",
          "تنتقل إلى صفحة الدفع الآمنة، وتدفع بالبطاقة: فيزا أو ماستركارد أو ميزة.",
          "تعود إلى يولياس. افتح مسودة الحملة وشغّلها من جديد.",
        ] },
        { p: "**كيف تعرف أن الدفع تم:** يرتفع **رصيدك المتاح** أعلى **الإعدادات ← الاستخدام**، وتظهر الدفعة في **الفواتير** داخل **الإعدادات ← الفوترة**. وإذا لم يتغير الرصيد فالدفع لم يتأكد ولم يُضف شيء، ويمكنك المحاولة مرة أخرى." },

        { h2: "كيف أختار في صفحة الدفع؟" },
        { p: "زر **ترقية** في **الإعدادات ← الاستخدام**، أو **ترقية** (أو **تعديل الخطة** إذا كانت لديك خطة) في **الإعدادات ← الفوترة**، يفتح صفحة الدفع. وفيها **الدفع حسب الاستخدام** و**يولياس للنمو** (وعليها **موصى بها**) و**يولياس للتوسع**." },
        { ol: [
          "للخطة اختر **شهري** أو **سنوي** (**وفّر 20%**) في الأعلى، ثم اضغط الخطة. يعرض **ملخص الطلب** المبلغ و**الضريبة** (**غير مشمولة**) و**المستحق اليوم**.",
          "للرصيد اضغط **الدفع حسب الاستخدام**، ثم اختر مبلغًا من **اختر مبلغ الشحن**، ويعرض كل مبلغ عدد العملاء الذي يعطيه.",
          "اضغط **المتابعة إلى الدفع** للخطة، أو **ادفع** مع المبلغ للرصيد، وأكمل الدفع بالبطاقة.",
        ] },
        { p: "**كيف تعرف أن الاشتراك تم:** في الخطة تعرض **الإعدادات ← الفوترة** اسم الخطة وسعرها وسطر: يتجدد اشتراكك تلقائيًا في، ومعه التاريخ. وفي الرصيد يرتفع رصيدك." },

        { h2: "أين أرى رصيدي واستهلاكي؟" },
        { p: "افتح اسمك في أسفل الشريط الجانبي ثم **الإعدادات ← الاستخدام**. عنوان الصفحة **الرصيد والفوترة**، وتعرض:" },
        { ul: [
          "**رصيدك المتاح**: العملاء المتبقون لك معروضين بالدولار حسب سعرك الحالي (10 سنتات للعميل في الدفع حسب الاستخدام، و5 سنتات في النمو أو التوسع). وتحته **يتجدد في** مع تاريخ تجدد عملاء الخطة، أو **رصيد مسبق الدفع · لا تنتهي صلاحيته** إذا لم تكن على خطة.",
          "**شحن الرصيد**: باقات الرصيد وزر **شراء**.",
          "**استهلاكك**: أين ذهب رصيدك، في أربعة أسطر: **البحث واكتشاف الجمهور** و**البحث عن بيانات العملاء** و**إنشاء الرسائل والتواصل** و**تشغيل الحملات الإعلانية**. والسطر الذي لم يُصرف فيه شيء يظهر بشرطة.",
          "**حد الإنفاق للحساب**: سقف اختياري للإنفاق.",
        ] },
        { p: "مثال ذلك: باقة 20 دولارًا تضيف 200 عميل وتظهر 20.00 دولارًا في الدفع حسب الاستخدام. فإذا اخترت النمو بعدها، تظهر العملاء المئتان أنفسهم 10.00 دولارات إلى جانب عملاء الخطة." },

        { h2: "اضبط حد الإنفاق" },
        { ol: [
          "في **الإعدادات ← الاستخدام** ابحث عن **حد الإنفاق للحساب**، ويظهر **بلا حد** حتى تضبطه.",
          "اكتب مبلغًا بالدولار (1 على الأقل) واضغط **حفظ الحد**.",
          "يعرض شريط ما صُرف من الحد منذ تاريخ بدء العد.",
        ] },
        { p: "عند الوصول للحد يتوقف يولياس عن إيجاد أشخاص جدد حتى ترفعه، أو تضغط **إعادة التعيين** ليبدأ العد من الآن. والمحادثات الجارية تستمر. وزر **إزالة** يحذف الحد." },

        { h2: "ماذا يحدث عند كل تجديد؟" },
        { p: "في نهاية كل فترة يصدر يولياس فاتورة التجديد ويخصمها من البطاقة المحفوظة عند دفعتك الأولى، إن كانت هناك بطاقة محفوظة. فإذا نجح الخصم استمرت الخطة ووصل إيصال إلى من دفع. وإذا فشل الخصم أو لم تكن هناك بطاقة محفوظة تظهر الفاتورة بحالة **مستحقة**، وتصل بالبريد إلى المالك والمسؤولين، ويعيد يولياس محاولة الخصم من البطاقة مرة كل يوم. ويمكنك أيضًا فتح الفاتورة والضغط على **ادفع الآن**. وتظل الخطة تعمل سبعة أيام بعد نهاية الفترة، فإذا بقيت الفاتورة غير مدفوعة بعدها تنتهي الخطة، وتتوقف الحملات عن إيجاد أشخاص جدد حتى تشترك من جديد، ويبقى كل شيء محفوظًا." },

        { h2: "ماذا يحدث لعملائك عندما تعمل الحملة؟" },
        { p: "عندما تبدأ الحملة يحجز يولياس لها عدد العملاء الذي يخطط للوصول إليه، حتى لا تصرف حملتان تُشغَّلان في اللحظة نفسها العملاء أنفسهم. ثم يُحسب العميل، ويُخصم من **رصيدك المتاح**، عندما يسلّمه يولياس إلى الحملة. وما حُجز ولم يُستخدم يعود متاحًا." },

        { h2: "أين أجد الإيصالات والفواتير؟" },
        { p: "بعد كل دفعة يصل إيصال إلى بريد من دفع. وتظهر كل فاتورة، لخطة أو لرصيد، في **الفواتير** داخل **الإعدادات ← الفوترة** ومعها **التاريخ** و**الإجمالي** و**الحالة** (**مدفوعة** أو **مستحقة** أو **ملغاة**). اضغط **عرض** لفتحها، ثم **تنزيل PDF** لحفظها أو طباعتها. ولا يرى هذا القسم إلا مالك مساحة العمل والمسؤول." },

        { h2: "أي خيار يناسبك؟" },
        { table: { head: ["إذا كنت", "اختر"], rows: [
          ["تريد تجربة حملة واحدة أولًا", "الدفع حسب الاستخدام، من 5 دولارات"],
          ["تصل إلى أقل من نحو 1,000 شخص شهريًا، أو بشكل غير منتظم", "الدفع حسب الاستخدام"],
          ["تصل إلى 1,000 حتى 2,000 شخص كل شهر", "النمو"],
          ["تصل إلى أكثر من 2,000 شخص شهريًا", "التوسع، مع شحن رصيد لما يزيد على 4,000"],
          ["تعرف أنك ستشغل حملات طوال السنة", "الدفع السنوي على النمو أو التوسع"],
        ] } },

        { h2: "هل أستطيع التغيير لاحقًا؟" },
        { p: "نعم. من الدفع حسب الاستخدام اضغط **ترقية** واختر خطة في أي وقت، ويبقى الرصيد الذي اشتريته ويُستخدم بعد عملاء الخطة. ومن الخطة تستطيع اختيار خطة أخرى من **تعديل الخطة**، أو إلغاءها ومواصلة العمل بالرصيد. والتفاصيل في [تغيير خطتك أو إلغاؤها](/help-center/changing-plan)." },

        { h2: "أمثلة" },
        { ul: [
          "مخبز يجرب حملة واحدة بـ5 دولارات: 50 عميلًا. يرد ثلاثة منهم ويحجز أحدهم جلسة تذوق، ولا تُحسب الردود ولا الاجتماع من رصيده، فيشحن 20 دولارًا لـ200 عميل آخرين.",
          "وكالة تصل إلى نحو 1,500 شخص شهريًا. يكلفها ذلك 150 دولارًا شهريًا بالرصيد بسعر 10 سنتات للعميل، بينما تدفع 100 دولار فقط في النمو وتحصل على ما يصل إلى 2,000 عميل. وإذا اختارت الدفع السنوي تدفع 960 دولارًا مرة واحدة، أي 80 دولارًا للشهر.",
          "شركة برمجيات على التوسع تستهلك عملاءها الـ4,000 بحلول يوم 25 من الشهر، فتشتري باقة 50 دولارًا: 500 عميل إضافي يُبقون حملاتها تعمل حتى يتجدد العدد في أول الشهر.",
        ] },

        { h2: "الصلاحيات والمتطلبات" },
        { ul: [
          "يستطيع مالك مساحة العمل والمسؤول فقط الدفع واختيار الخطة وشراء الرصيد وضبط حد الإنفاق. ويرى غيرهما: يمكن لمالك مساحة العمل أو المسؤول فقط شراء عملاء.",
          "يرى المعلن والمحلل الرصيد وأسطر الاستهلاك وحد الإنفاق، لكنهما لا يستطيعان تغيير أي منها أو شراء رصيد جديد.",
          "يتم الدفع بالبطاقة في صفحة Paymob الآمنة.",
          "كل الخيارات بمستخدمين بلا حد، فإضافة أشخاص لا تغيّر السعر أبدًا.",
        ] },

        { h2: "ملاحظات مهمة" },
        { ul: [
          "عندما ينفد عملاؤك تتوقف الحملات عن إيجاد أشخاص جدد. وبعد الشحن أو الاشتراك تستأنف الحملات المتوقفة عملها وحدها.",
          "لا تنتهي صلاحية الرصيد، ويبقى إذا انتهت الخطة.",
          "لا توجد فترة تجريبية مجانية: أول دفعة هي دفعة التشغيل، ويمكنك قبلها بناء حملتك كاملة ومراجعتها دون أن تدفع شيئًا.",
          "تخضع المبالغ المستردة لـ[سياسة الاسترداد](/legal/refunds).",
        ] },

        { h2: "حل المشكلات" },
        { h3: "زر شراء أو ترقية لا يظهر" },
        { p: "دورك ليس مسؤولًا، أو الدفع متوقف حاليًا. ويختفي **ترقية** أيضًا في خطة التوسع لأنها الأكبر." },
        { h3: "تظهر رسالة: الدفع غير متاح الآن" },
        { p: "الدفع بالبطاقة غير متاح في الوقت الحالي، وتبقى حملتك محفوظة مسودة. حاول مرة أخرى لاحقًا." },
        { h3: "التشغيل يقول إن الرصيد فارغ، لكن صفحة الاستخدام تعرض رصيدًا" },
        { p: "الحملات التي تعمل الآن تحتفظ بالعملاء الذين حجزتهم، بينما لا تخصم صفحة الاستخدام إلا العملاء الذين سُلّموا فعلًا. اشحن رصيدك، أو انتظر حتى تنتهي إحدى الحملات الجارية." },
        { h3: "دفعت لكن الحملة لم تبدأ" },
        { p: "الدفع لا يشغّل الحملة وحده. افتح المسودة وشغّلها من جديد." },
        { h3: "تغيّر الرصيد بالدولار عندما انتقلت إلى خطة" },
        { p: "عدد عملائك لم يتغير، لكن الرصيد يُعرض بسعر الخطة: 5 سنتات للعميل بدل 10." },

        { h2: "مقالات ذات صلة" },
        { ul: ["[تغيير خطتك أو إلغاؤها](/help-center/changing-plan)", "[الميزانية والتحسين](/help-center/budget-and-optimization)", "[إنشاء حملة](/help-center/creating-a-campaign)", "[الأسعار](/pricing)"] },
      ],
    },
  },

  "changing-plan": {
    en: {
      title: "Changing or canceling your plan",
      summary: "Move between Growth and Scale, switch between monthly and annual billing, cancel or resume a plan, and what happens to your campaigns, leads and credit in each case.",
      updated: "2026-11-05",
      blocks: [
        { p: "Your plan is managed in **Settings → Billing**. This article covers changing plan or billing period, canceling, resuming, what happens when a plan ends, and what happens when a renewal isn't paid. For the options themselves and their prices, see [Pay As You Go or a monthly plan](/help-center/choosing-a-plan)." },

        { h2: "What does the Billing tab show?" },
        { p: "Open your name at the bottom of the sidebar, then **Settings → Billing**. The tab shows:" },
        { ul: [
          "**Your plan**: its name (**Pay As You Go**, **Yolias Growth** or **Yolias Scale**), **Monthly** or **Annual** with the price, and a line with the date: Your subscription will auto-renew on, or Your plan ends on after canceling. Without a plan it reads Prepaid credit · no subscription.",
          "A button: **Upgrade** without a plan, **Adjust plan** with one. Both open the checkout page.",
          "**Payment**: how payments are made.",
          "**Invoices**: every payment with **Date**, **Total**, **Status** and **View**.",
          "**Cancellation**: shown only when you have a plan.",
        ] },

        { h2: "Change plan or billing period" },
        { ol: [
          "In **Settings → Billing**, press **Adjust plan**. The checkout page opens, with your current plan marked **Current plan**.",
          "Choose **Monthly** or **Annual** at the top.",
          "Press **Yolias Growth** or **Yolias Scale**. If you pick the plan and period you already have, the button reads You’re on this plan · Continue and nothing changes.",
          "Check **Order summary**: it shows the new plan's price, **Unused time on (current plan)** taken off it, and the total due today. Then press **Continue to payment** and pay on the secure page.",
        ] },
        { p: "**How to know it worked:** you return to Yolias, **Settings → Billing** shows the new plan and its renewal date, the payment appears under **Invoices**, and the payer receives a receipt by email." },
        { p: "**If it didn't work:** the plan stays as it was and nothing is charged. Try again, or see Troubleshooting below." },

        { h2: "What happens when you change plan?" },
        { ul: [
          "The unused part of the period you already paid for, by days left, is deducted from the new plan's price, and you pay the rest at once. A new period starts on the day you pay. For example, moving from Growth ($100) to Scale ($200) with 20 of 30 days left deducts $66.66, so you pay $133.34.",
          "If the unused time is worth more than the new plan (for example Scale to Growth early in the month), checkout says **The unused time of your current plan covers this one.** Switch when your current period ends: cancel the plan, then choose the new one after it ends.",
          "The new plan's monthly leads apply right away. Leads already used this calendar month count against them.",
          "Moving from monthly to annual, or back, works the same way: the unused time is deducted and the new period starts that day.",
          "If you had canceled your plan, choosing a new one clears the cancellation: the new plan renews normally.",
          "Credit you bought stays and is used after the plan's monthly leads.",
        ] },
        { note: "Moving from Scale to Growth in the middle of a month after using more than 2,000 leads leaves no plan leads until the 1st. Campaigns then use your credit, or pause until the count resets." },

        { h2: "Cancel your plan" },
        { ol: [
          "In **Settings → Billing**, go to **Cancellation**. It shows **Cancel plan** with a **Cancel** button.",
          "Press **Cancel**. The confirmation reads: Your plan stays active until (the date). After that, new searches stop until you subscribe again; all searches and leads stay saved.",
          "Press **Cancel plan** to confirm, or **Keep plan** to go back.",
        ] },
        { p: "**How to know it worked:** the message Plan canceled. It stays active until the end of the period. appears, **Cancellation** reads Your plan is canceled and ends on (the date). Resume any time before then., and owners and Admins receive an email. Three days before the end date, they receive a reminder when billing emails are on in their notification settings." },

        { h2: "Resume a canceled plan" },
        { p: "Before the end date, open **Settings → Billing** and press **Resume plan** under **Cancellation**. The message Plan resumed. appears, the renewal date returns, and the plan renews as before. After the end date, there is nothing to resume: choose a plan again with **Adjust plan** or **Upgrade**." },

        { h2: "What happens when a plan ends?" },
        { ul: [
          "Until the end date, the plan works as usual: its leads, campaigns and conversations.",
          "After it, campaigns stop finding new people, and owners and Admins receive an email that the plan ended.",
          "Campaigns, audiences, leads, conversations, meetings and invoices stay saved.",
          "Credit you bought stays and doesn't expire. With credit left, you can keep launching campaigns on Pay As You Go.",
          "To come back to a plan, choose one on the checkout page and pay. Campaigns paused for lack of leads continue by themselves.",
        ] },

        { h2: "What if a renewal isn't paid?" },
        { p: "At the end of each period, Yolias issues a renewal invoice and charges your saved card when one is saved. If the charge fails, or no card is saved, the invoice shows **Due** in **Invoices**, owners and Admins receive it by email, and Yolias tries the card again once a day. To pay it yourself, press **View** next to the invoice, then **Pay now**, and pay on the secure page." },
        { p: "The plan keeps working for seven days after the period ends. If the invoice is still unpaid after seven days, the plan ends as described above and the invoice becomes **Void**." },

        { h2: "Move from a plan to Pay As You Go" },
        { ol: [
          "Buy credit in **Settings → Usage** under **Top up**, if you need it before the plan ends.",
          "Cancel the plan in **Settings → Billing**.",
          "After the end date, campaigns use your credit at 10 cents a lead.",
        ] },

        { h2: "Examples" },
        { ul: [
          "A shop on Growth monthly since the 3rd moves to Scale monthly on the 18th. It pays $200 that day, its next renewal is the 18th of next month, and it has 4,000 leads this month minus the 1,400 already used.",
          "A consultant cancels Growth on the 10th; the period ends on the 25th. Campaigns run until the 25th. On the 22nd she receives the ending reminder and decides to keep the plan, so she presses **Resume plan**.",
          "A clinic's card is declined at renewal. The invoice shows **Due**; the next day the clinic's Admin opens it, presses **Pay now** and pays with another card. The plan never stopped.",
        ] },

        { h2: "Permissions and requirements" },
        { ul: [
          "Only the workspace owner and Admins can see Billing, change, cancel or resume the plan. Others see Only the workspace owner and admins can see billing.",
          "Payments are made by card on Paymob's secure page.",
          "Checkout offers Growth and Scale. A Yolias Pro plan you already have keeps running and renewing; once you move to another plan, Pro can't be chosen again.",
        ] },

        { h2: "Important notes" },
        { ul: [
          "Canceling doesn't delete anything. To remove your data, see [Deleting your account](/help-center/deleting-account).",
          "**Settings → Billing → Payment** shows the saved card, such as Visa ending in 4242. To use another card, press **Remove card**: renewals stop being charged automatically, and the next payment you make on the payment page with the option to save the card stores the new one. To pay a **Due** invoice with another card, use **Pay now**.",
          "Refunds follow the [Refund Policy](/legal/refunds).",
        ] },

        { h2: "Troubleshooting" },
        { h3: "There is no Cancellation section" },
        { p: "You don't have a plan: Pay As You Go has no subscription to cancel. Unused credit stays." },
        { h3: "Adjust plan or Cancel doesn't appear" },
        { p: "Your role is Advertiser or Analyst. Ask the workspace owner or an Admin." },
        { h3: "Couldn’t save. Please try again." },
        { p: "The cancellation or resume wasn't saved. Reload the page and try again." },

        { h2: "Related articles" },
        { ul: ["[Pay As You Go or a monthly plan](/help-center/choosing-a-plan)", "[Deleting your account](/help-center/deleting-account)", "[Adding people](/help-center/inviting-teammates)"] },
      ],
    },
    ar: {
      title: "تغيير خطتك أو إلغاؤها",
      summary: "انتقل بين النمو والتوسع، وبدّل بين الدفع الشهري والسنوي، وألغِ خطتك أو استأنفها، واعرف ما يحدث لحملاتك وعملائك ورصيدك في كل حالة.",
      updated: "2026-11-05",
      blocks: [
        { p: "تُدار خطتك من **الإعدادات ← الفوترة**. يشرح هذا المقال تغيير الخطة أو فترة الدفع، والإلغاء، والاستئناف، وما يحدث عند انتهاء الخطة، وما يحدث إذا لم يُدفع التجديد. أما الخيارات نفسها وأسعارها ففي [الدفع حسب الاستخدام أو الخطة الشهرية](/help-center/choosing-a-plan)." },

        { h2: "ماذا يعرض تبويب الفوترة؟" },
        { p: "افتح اسمك في أسفل الشريط الجانبي ثم **الإعدادات ← الفوترة**. يعرض التبويب:" },
        { ul: [
          "**خطتك**: اسمها (**الدفع حسب الاستخدام** أو **يولياس للنمو** أو **يولياس للتوسع**)، و**شهري** أو **سنوي** مع السعر، وسطرًا فيه التاريخ: يتجدد اشتراكك تلقائيًا في، أو تنتهي خطتك في بعد الإلغاء. ومن دون خطة يظهر: رصيد مسبق الدفع · بدون اشتراك.",
          "زرًا: **ترقية** إذا لم تكن لديك خطة، و**تعديل الخطة** إذا كانت لديك. وكلاهما يفتح صفحة الدفع.",
          "**الدفع**: كيف تتم المدفوعات.",
          "**الفواتير**: كل دفعة مع **التاريخ** و**الإجمالي** و**الحالة** وزر **عرض**.",
          "**الإلغاء**: يظهر فقط إذا كانت لديك خطة.",
        ] },

        { h2: "غيّر الخطة أو فترة الدفع" },
        { ol: [
          "في **الإعدادات ← الفوترة** اضغط **تعديل الخطة**. تفتح صفحة الدفع وعلى خطتك الحالية وسم **الخطة الحالية**.",
          "اختر **شهري** أو **سنوي** في الأعلى.",
          "اضغط **يولياس للنمو** أو **يولياس للتوسع**. وإذا اخترت الخطة والفترة اللتين لديك يظهر الزر: أنت على هذه الخطة · متابعة، ولا يتغير شيء.",
          "راجع **ملخص الطلب**: فيه سعر الخطة الجديدة، و**الوقت غير المستخدم من (الخطة الحالية)** مخصومًا منه، والمستحق اليوم. ثم اضغط **المتابعة إلى الدفع** وادفع في الصفحة الآمنة.",
        ] },
        { p: "**كيف تعرف أن التغيير تم:** تعود إلى يولياس، وتعرض **الإعدادات ← الفوترة** الخطة الجديدة وتاريخ تجديدها، وتظهر الدفعة في **الفواتير**، ويصل إيصال إلى بريد من دفع." },
        { p: "**إذا لم يتم:** تبقى الخطة كما كانت ولا يُخصم شيء. حاول مرة أخرى، أو راجع حل المشكلات أدناه." },

        { h2: "ماذا يحدث عند تغيير الخطة؟" },
        { ul: [
          "يُخصم من سعر الخطة الجديدة الجزء غير المستخدم من الفترة التي دفعتها، بحسب الأيام المتبقية، وتدفع الباقي في الحال. وتبدأ فترة جديدة من يوم الدفع. فمثلًا الانتقال من النمو (100 دولار) إلى التوسع (200 دولار) مع بقاء 20 يومًا من 30 يخصم 66.66 دولارًا، فتدفع 133.34 دولارًا.",
          "وإذا كانت قيمة الوقت غير المستخدم أكبر من الخطة الجديدة (مثل الانتقال من التوسع إلى النمو في أول الشهر)، تعرض صفحة الدفع **الوقت غير المستخدم من خطتك الحالية يغطي هذه الخطة.** فغيّرها عند انتهاء فترتك الحالية: ألغِ الخطة ثم اختر الجديدة بعد انتهائها.",
          "يبدأ عدد العملاء الشهري للخطة الجديدة فورًا، ويُحسب منه ما استخدمته في الشهر الميلادي الحالي.",
          "الانتقال من الشهري إلى السنوي أو العكس يتم بالطريقة نفسها: يُخصم الوقت غير المستخدم وتبدأ الفترة الجديدة في ذلك اليوم.",
          "إذا كنت قد ألغيت خطتك، فاختيار خطة جديدة يلغي الإلغاء، وتتجدد الخطة الجديدة كالمعتاد.",
          "يبقى الرصيد الذي اشتريته، ويُستخدم بعد عملاء الخطة الشهريين.",
        ] },
        { note: "الانتقال من التوسع إلى النمو في منتصف الشهر بعد استخدام أكثر من 2,000 عميل لا يترك لك عملاء من الخطة حتى أول الشهر التالي. فتستخدم الحملات رصيدك إن وُجد، أو تتوقف حتى يتجدد العدد." },

        { h2: "ألغِ خطتك" },
        { ol: [
          "في **الإعدادات ← الفوترة** انتقل إلى **الإلغاء**، وستجد **إلغاء الخطة** وبجوارها زر **إلغاء**.",
          "اضغط **إلغاء**. تظهر رسالة التأكيد: تبقى خطتك فعالة حتى (التاريخ). بعد ذلك تتوقف عمليات البحث الجديدة حتى تشترك من جديد، وتبقى كل عمليات البحث والعملاء محفوظين.",
          "اضغط **إلغاء الخطة** للتأكيد، أو **الإبقاء على الخطة** للتراجع.",
        ] },
        { p: "**كيف تعرف أن الإلغاء تم:** تظهر رسالة: تم إلغاء الخطة. تبقى فعالة حتى نهاية الفترة. ويعرض قسم **الإلغاء**: تم إلغاء خطتك وتنتهي في (التاريخ). يمكنك الاستئناف في أي وقت قبل ذلك. ويصل بريد إلى المالك والمسؤولين، ثم تذكير قبل تاريخ الانتهاء بثلاثة أيام إذا كانت رسائل الفوترة مفعّلة في إعدادات الإشعارات." },

        { h2: "استأنف خطة ملغاة" },
        { p: "قبل تاريخ الانتهاء افتح **الإعدادات ← الفوترة** واضغط **استئناف الخطة** في قسم **الإلغاء**. تظهر رسالة: تم استئناف الخطة. ويعود تاريخ التجديد، وتتجدد الخطة كما كانت. وبعد تاريخ الانتهاء لا يوجد ما يُستأنف، فاختر خطة من جديد من **تعديل الخطة** أو **ترقية**." },

        { h2: "ماذا يحدث عند انتهاء الخطة؟" },
        { ul: [
          "حتى تاريخ الانتهاء تعمل الخطة كالمعتاد: عملاؤها وحملاتها ومحادثاتها.",
          "بعده تتوقف الحملات عن إيجاد أشخاص جدد، ويصل إلى المالك والمسؤولين بريد بانتهاء الخطة.",
          "تبقى الحملات والجماهير والعملاء والمحادثات والاجتماعات والفواتير محفوظة.",
          "يبقى الرصيد الذي اشتريته ولا تنتهي صلاحيته. وإذا بقي لديك رصيد تستطيع مواصلة تشغيل الحملات بالدفع حسب الاستخدام.",
          "للعودة إلى خطة اختر واحدة من صفحة الدفع وادفع، وتستأنف الحملات التي توقفت لنفاد العملاء عملها وحدها.",
        ] },

        { h2: "ماذا لو لم يُدفع التجديد؟" },
        { p: "في نهاية كل فترة يصدر يولياس فاتورة التجديد ويخصمها من بطاقتك المحفوظة إن كانت هناك بطاقة محفوظة. فإذا فشل الخصم، أو لم تكن هناك بطاقة، تظهر الفاتورة بحالة **مستحقة** في **الفواتير**، وتصل بالبريد إلى المالك والمسؤولين، ويعيد يولياس محاولة الخصم مرة كل يوم. ولتدفعها بنفسك اضغط **عرض** بجوار الفاتورة، ثم **ادفع الآن**، وادفع في الصفحة الآمنة." },
        { p: "تظل الخطة تعمل سبعة أيام بعد نهاية الفترة. فإذا بقيت الفاتورة غير مدفوعة بعد السبعة أيام تنتهي الخطة كما هو موضح أعلاه، وتتحول الفاتورة إلى **ملغاة**." },

        { h2: "انتقل من خطة إلى الدفع حسب الاستخدام" },
        { ol: [
          "اشترِ رصيدًا من **شحن الرصيد** في **الإعدادات ← الاستخدام** إذا احتجته قبل انتهاء الخطة.",
          "ألغِ الخطة من **الإعدادات ← الفوترة**.",
          "بعد تاريخ الانتهاء تستخدم الحملات رصيدك بسعر 10 سنتات للعميل.",
        ] },

        { h2: "أمثلة" },
        { ul: [
          "متجر على النمو الشهري منذ يوم 3 ينتقل إلى التوسع الشهري يوم 18. يدفع 200 دولار في ذلك اليوم، ويصبح تجديده التالي يوم 18 من الشهر القادم، ويكون لديه هذا الشهر 4,000 عميل ناقص 1,400 استخدمها بالفعل.",
          "مستشارة تلغي النمو يوم 10 وتنتهي فترتها يوم 25، فتعمل حملاتها حتى يوم 25. ويوم 22 يصلها تذكير الانتهاء فتقرر الإبقاء على الخطة وتضغط **استئناف الخطة**.",
          "تُرفض بطاقة عيادة عند التجديد، فتظهر الفاتورة **مستحقة**. وفي اليوم التالي يفتحها مسؤول العيادة ويضغط **ادفع الآن** ويدفع ببطاقة أخرى، ولا تتوقف الخطة أبدًا.",
        ] },

        { h2: "الصلاحيات والمتطلبات" },
        { ul: [
          "يستطيع مالك مساحة العمل والمسؤول فقط رؤية الفوترة وتغيير الخطة وإلغاءها واستئنافها. ويرى غيرهما: الفوترة متاحة لمالك مساحة العمل والمسؤولين فقط.",
          "يتم الدفع بالبطاقة في صفحة Paymob الآمنة.",
          "تعرض صفحة الدفع خطتي النمو والتوسع. وإذا كانت لديك خطة يولياس برو فهي تستمر وتتجدد، لكن بعد انتقالك إلى خطة أخرى لا يمكن اختيار برو مرة أخرى.",
        ] },

        { h2: "ملاحظات مهمة" },
        { ul: [
          "الإلغاء لا يحذف شيئًا. ولحذف بياناتك راجع [حذف حسابك](/help-center/deleting-account).",
          "تعرض **الإعدادات ← الفوترة ← الدفع** البطاقة المحفوظة، مثل Visa المنتهية بـ 4242. ولاستخدام بطاقة أخرى اضغط **حذف البطاقة**، فتتوقف التجديدات عن الخصم التلقائي، ويحفظ الدفع التالي الذي تختار فيه حفظ البطاقة في صفحة الدفع البطاقة الجديدة. وللدفع ببطاقة أخرى لفاتورة **مستحقة** استخدم **ادفع الآن**.",
          "تخضع المبالغ المستردة لـ[سياسة الاسترداد](/legal/refunds).",
        ] },

        { h2: "حل المشكلات" },
        { h3: "لا يظهر قسم الإلغاء" },
        { p: "ليست لديك خطة: الدفع حسب الاستخدام بلا اشتراك يُلغى، والرصيد غير المستخدم يبقى." },
        { h3: "لا يظهر تعديل الخطة أو الإلغاء" },
        { p: "دورك معلن أو محلل. اطلب ذلك من مالك مساحة العمل أو أحد المسؤولين." },
        { h3: "تعذّر الحفظ. حاول مرة أخرى." },
        { p: "لم يُحفظ الإلغاء أو الاستئناف. أعد تحميل الصفحة وحاول مرة أخرى." },

        { h2: "مقالات ذات صلة" },
        { ul: ["[الدفع حسب الاستخدام أو الخطة الشهرية](/help-center/choosing-a-plan)", "[حذف حسابك](/help-center/deleting-account)", "[إضافة الأشخاص](/help-center/inviting-teammates)"] },
      ],
    },
  },

  "inviting-teammates": {
    en: {
      title: "Adding people",
      summary: "Invite your team to your workspace, choose what each person can do with a role, change roles, and remove people. Every option has unlimited users.",
      updated: "2026-11-05",
      blocks: [
        { p: "A Yolias workspace holds your company's campaigns, audiences, leads, conversations and meetings. You can add as many people to it as you need: every option, Pay As You Go, Growth and Scale, includes unlimited users at no extra cost. This article covers adding people, the roles, changing a role, removing someone, and what each person sets up for themselves." },

        { h2: "What is a role?" },
        { p: "Each person in the workspace has one role. The role decides what they can see and change. Yolias checks it on every action, so a button a role can't use either doesn't appear or answers with a message." },
        { table: { head: ["Role", "What they can do"], rows: [
          ["Owner", "The person who created the workspace. Full control, like an Admin. The Owner's role can't be changed and the Owner can't be removed."],
          ["Admin", "Full control: campaigns, billing, integrations and people. Pays, chooses the plan, buys credit, sets the spending limit, adds and removes people and changes roles."],
          ["Advertiser", "Creates and runs campaigns, audiences, leads, conversations and meetings. Connects their own mailboxes and Google Calendar. Sees credit and usage but can't pay or manage people."],
          ["Analyst", "Sees campaigns, results and reports. Can't change anything: a change answers with Your role is Analyst: you can see the results but not change them."],
        ] } },

        { p: "A workspace has one Owner: the person who signed up and created it. An Admin has the same day-to-day control; the differences are that an Admin's role can be changed or removed, and that deleting the Owner's account deletes the workspace when no one else is in it." },

        { h2: "What can each role do, action by action?" },
        { table: { head: ["Action", "Owner and Admin", "Advertiser", "Analyst"], rows: [
          ["See campaigns, results, leads, conversations and meetings", "Yes", "Yes", "Yes"],
          ["Create, edit, launch and pause campaigns and audiences", "Yes", "Yes", "No"],
          ["Reply in conversations and handle leads", "Yes", "Yes", "No"],
          ["Edit their booking page, cancel meetings, record outcomes", "Yes", "Yes", "No"],
          ["Connect their own mailboxes and Google Calendar", "Yes", "Yes", "No"],
          ["See the balance and usage in Settings → Usage", "Yes", "Yes", "Yes"],
          ["Buy credit, choose or cancel a plan, see invoices", "Yes", "No", "No"],
          ["Set the account spending limit", "Yes", "No", "No"],
          ["Add and remove people, change roles", "Yes", "No", "No"],
        ] } },
        { p: "[Yolias AI](/help-center/yolias-ai) works within the role of the person using it: for an Analyst it answers questions about results but doesn't change anything." },

        { h2: "Which role should I choose?" },
        { table: { head: ["The person", "Role"], rows: [
          ["Runs the business with you, pays, or manages the team", "Admin"],
          ["Runs campaigns, answers leads and takes meetings", "Advertiser"],
          ["Follows results only: an accountant, an investor, a manager who reviews reports", "Analyst"],
          ["An agency or freelancer who runs your campaigns", "Advertiser, so they can't change billing or the team"],
        ] } },
        { p: "Start with the narrowest role that lets the person do their work. You can change it at any time from **Settings → Team**, and the change applies to their next action." },

        { h2: "Add someone" },
        { ol: [
          "Open your name at the bottom of the sidebar, then **Settings → Team**.",
          "Press **Add people**. The **Add people** window opens.",
          "In **Email**, enter the person's work email.",
          "Under **Role**, choose **Admin**, **Advertiser** or **Analyst**. Each choice shows what the role does. **Advertiser** is selected by default.",
          "Press **Send invitation**.",
        ] },
        { p: "**How to know it worked:** the window closes and the invitation appears under **People** as the email address with **Invitation sent · (role)** and **Pending**. Yolias emails them a link to the invitation, in their language if they already use Yolias, otherwise in yours. They join only when they accept it." },
        { p: "**If it didn't work:** the window stays open with a message. See Troubleshooting below." },
        { p: "Each invitation is for one email address. To add several people, repeat the steps for each one." },

        { h2: "What happens when they open the email?" },
        { ol: [
          "The link opens the invitation page, **Join (workspace) on Yolias**, with who invited them, the role and the email it is for.",
          "Without a Yolias account, they press **Create your account and join** and confirm their email from the link Yolias sends. The new account is in your workspace with the role you chose.",
          "With an account, they press **Sign in** on the same page, then **Join the team**. An empty account of their own, such as the one a removed member gets, is replaced by your workspace.",
          "Yolias asks for their name in a short welcome step. Your company details come from the workspace, so they don't enter them again.",
        ] },
        { p: "The invitation is for one email address: signed in with another one, the page asks them to sign in with the invited address. An account that has its own campaigns, payments or team can't join, and the page says why. The link works until the invitation is accepted or revoked." },
        { p: "From then on they sign in from the sign-in page with the same email, like any member. See [Signing in](/help-center/signing-in)." },

        { h2: "What does each person set up for themselves?" },
        { ul: [
          "**Mailboxes.** Each person connects their own Gmail or other mailbox in **Integrations**. Campaigns they create send from their mailboxes, and replies to them arrive in their conversations. A member without a mailbox can't launch a campaign that sends emails, because a campaign sends from the mailbox of the member who creates it. See [Connecting Gmail](/help-center/connect-gmail).",
          "**Booking page and Google Calendar.** Each person has their own booking page, hours and calendar connection. Meetings Yolias books from a reply go to the member whose mailbox holds the conversation. See [Meetings and your booking page](/help-center/deals-and-meetings).",
          "**Language, time zone and notifications.** Each person sets these in their own Settings.",
        ] },
        { p: "Each person does this from their own login: the Owner or an Admin can't connect a mailbox or calendar for a colleague, or set up their booking page." },
        { p: "Campaigns, audiences, leads, conversations, meetings and credit belong to the workspace, so every member sees them. The **Owner** column in **Campaigns** shows who created each campaign." },

        { h2: "Who is in the workspace?" },
        { p: "**Settings → Team** lists everyone under **People**: Everyone with access to this account, and their role. Each row shows the photo or initials, the name, the email and the role. Every member can open this list; only the Owner and Admins see the role menus and the X buttons." },

        { h2: "Change someone's role" },
        { ol: [
          "Open **Settings → Team**.",
          "Next to the person, open the role menu and choose **Admin**, **Advertiser** or **Analyst**.",
        ] },
        { p: "**How to know it worked:** the menu shows the new role, and the person's access changes on their next action. You can't change your own role or the Owner's; for those, the role appears as a label instead of a menu." },

        { h2: "Remove someone" },
        { ol: [
          "Open **Settings → Team**.",
          "Press the X next to the person.",
          "Confirm **Remove (name) from the workspace?**.",
        ] },
        { p: "**How to know it worked:** the person disappears from **People** and loses access to your workspace at once. What they created, campaigns, leads, conversations and meetings, stays in your workspace." },
        { p: "Their account isn't deleted: Yolias gives them a new, empty workspace of their own, and they go through the welcome steps again the next time they sign in. You can invite them again later; they accept the new invitation from its link." },

        { h2: "Before you remove someone" },
        { ul: [
          "**Campaigns they own.** In **Campaigns**, select their campaigns, open **Edit (n) campaigns**, choose another member under **Owner** and save, so someone else follows them.",
          "**Upcoming meetings.** Meetings booked on their page stay in **Meetings**. Decide who attends, or cancel them so guests are told before the person loses access.",
          "**Conversations waiting for a reply.** Open **Conversations** and answer, or hand them to a colleague, before removing the person.",
        ] },

        { h2: "Revoke an invitation" },
        { p: "An invitation waiting to be accepted is listed under **People** as the email address with Invitation sent · (role) and **Pending**. Press the X next to it to revoke it; its link stops working. Once the person appears with their name and role, use **Remove** instead." },

        { h2: "Example" },
        { p: "A dental supplies company runs Yolias with three people. The founder, the Owner, adds the sales manager as **Admin** to handle billing and the team, a salesperson as **Advertiser** who connects her Gmail and her Google Calendar and runs her own campaigns, and the accountant as **Analyst** to follow spend and cost per meeting. Six months later the salesperson leaves: the Admin removes her, and her campaigns, leads and past meetings stay in the workspace." },
        { p: "In another case, a restaurant group works with a marketing agency. The Owner adds the agency's account manager as **Advertiser**: she connects a mailbox, builds and launches campaigns and answers leads, but **Billing** shows her Only the workspace owner and admins can see billing., so payments and the team stay with the restaurant." },

        { h2: "Permissions and requirements" },
        { ul: [
          "Only the Owner and Admins see **Add people**, change roles, remove people and revoke invitations. Others see the list.",
          "Users are unlimited on every option and never change the price.",
          "An invited person doesn't pay or subscribe separately: they use the workspace's credit and plan.",
          "One email address has one Yolias account, and an account belongs to one workspace.",
          "An Admin can't change their own role or remove themselves; the Owner or another Admin does it.",
        ] },

        { h2: "Important notes" },
        { ul: [
          "To hand the workspace to someone else, the Owner opens **Settings → Team** and presses the crown next to that member (**Make {name} the owner**), then confirms. The member becomes the Owner and is notified; the previous Owner becomes an Admin. Only the Owner can do this.",
          "The Owner can't delete their account while other people are in the workspace. See [Deleting your account](/help-center/deleting-account).",
          "Removing someone doesn't disconnect what they connected in Google; they can remove Yolias from their Google account's security settings.",
        ] },

        { h2: "Troubleshooting" },
        { h3: "This person is already in your team." },
        { p: "They are listed under **People** already. Change their role there if needed." },
        { h3: "Enter a valid email address." },
        { p: "Check the address for typos and spaces." },
        { h3: "Couldn’t send the invitation email." },
        { p: "Nothing was created. Try again in a few minutes." },
        { h3: "The invitation email didn't arrive" },
        { p: "Ask them to check spam. To send it again, press **Add people** with the same email: the same invitation is sent once more." },
        { h3: "They see questions about their own company" },
        { p: "They signed up on their own instead of from the invitation, so Yolias created a separate workspace for them. They open the invitation link again and press **Join the team**: while that workspace has no campaigns, payments or team, yours replaces it." },
        { h3: "The invitation page says it can't be used" },
        { p: "The invitation was revoked or already accepted. Send a new one with **Add people**." },
        { h3: "Add people doesn't appear" },
        { p: "Your role is Advertiser or Analyst. Ask the Owner or an Admin." },

        { h2: "Related articles" },
        { ul: ["[Deleting your account](/help-center/deleting-account)", "[Connecting Gmail](/help-center/connect-gmail)", "[Connecting Google Calendar](/help-center/google-calendar)", "[Signing in](/help-center/signing-in)"] },
      ],
    },
    ar: {
      title: "إضافة الأشخاص",
      summary: "ادعُ فريقك إلى مساحة عملك، وحدد ما يفعله كل شخص بدوره، وغيّر الأدوار، وأزل الأشخاص. كل الخيارات بمستخدمين بلا حد.",
      updated: "2026-11-05",
      blocks: [
        { p: "تضم مساحة العمل في يولياس حملات شركتك وجماهيرها وعملاءها ومحادثاتها واجتماعاتها. وتستطيع أن تضيف إليها من تحتاج من الأشخاص: فكل الخيارات، الدفع حسب الاستخدام والنمو والتوسع، تشمل مستخدمين بلا حد ودون تكلفة إضافية. يشرح هذا المقال إضافة الأشخاص، والأدوار، وتغيير الدور، وإزالة شخص، وما يضبطه كل شخص لنفسه." },

        { h2: "ما الدور؟" },
        { p: "لكل شخص في مساحة العمل دور واحد يحدد ما يراه وما يستطيع تغييره. ويتحقق يولياس من الدور في كل إجراء، فالزر الذي لا يستطيع الدور استخدامه إما لا يظهر أو يرد برسالة. ويمكن تغيير الدور في أي وقت دون أن يفقد الشخص شيئًا مما أنشأه، فالحملات والعملاء والمحادثات تبقى كما هي، ويتغير فقط ما يستطيع فعله بها." },
        { table: { head: ["الدور", "ما يستطيعه"], rows: [
          ["المالك", "الشخص الذي أنشأ مساحة العمل. تحكم كامل مثل المسؤول. ولا يمكن تغيير دوره ولا إزالته."],
          ["مسؤول", "تحكم كامل: الحملات والفوترة والتكاملات والأشخاص. يدفع ويختار الخطة ويشتري الرصيد ويضبط حد الإنفاق، ويضيف الأشخاص ويزيلهم ويغيّر أدوارهم."],
          ["معلن", "ينشئ الحملات ويديرها، والجماهير والعملاء والمحادثات والاجتماعات، ويربط بريده وتقويم Google الخاصين به. يرى الرصيد والاستهلاك لكنه لا يدفع ولا يدير الأشخاص."],
          ["محلل", "يرى الحملات والنتائج والتقارير، ولا يغيّر شيئًا: أي تغيير يرد برسالة: دورك محلل: يمكنك رؤية النتائج دون تعديلها."],
        ] } },

        { p: "في كل مساحة عمل مالك واحد، وهو الشخص الذي سجّل أولًا وأنشأها. ويملك المسؤول التحكم نفسه في العمل اليومي، والفرق بينهما أن دور المسؤول يمكن تغييره ويمكن إزالته، أما المالك فلا، وأن حذف حساب المالك يحذف مساحة العمل كلها إذا لم يكن فيها أحد غيره. لذلك اختر للمسؤولين أشخاصًا تثق بهم، لأنهم يستطيعون الدفع وإزالة الآخرين وتغيير أدوارهم." },

        { h2: "ماذا يستطيع كل دور، إجراءً بإجراء؟" },
        { table: { head: ["الإجراء", "المالك والمسؤول", "المعلن", "المحلل"], rows: [
          ["رؤية الحملات والنتائج والعملاء والمحادثات والاجتماعات", "نعم", "نعم", "نعم"],
          ["إنشاء الحملات والجماهير وتعديلها وتشغيلها وإيقافها", "نعم", "نعم", "لا"],
          ["الرد في المحادثات والتعامل مع العملاء", "نعم", "نعم", "لا"],
          ["تعديل صفحة الحجز وإلغاء الاجتماعات وتسجيل النتائج", "نعم", "نعم", "لا"],
          ["ربط البريد وتقويم Google الخاصين به", "نعم", "نعم", "لا"],
          ["رؤية الرصيد والاستهلاك في الإعدادات ← الاستخدام", "نعم", "نعم", "نعم"],
          ["شراء الرصيد واختيار الخطة أو إلغاؤها ورؤية الفواتير", "نعم", "لا", "لا"],
          ["ضبط حد الإنفاق للحساب", "نعم", "لا", "لا"],
          ["إضافة الأشخاص وإزالتهم وتغيير أدوارهم", "نعم", "لا", "لا"],
        ] } },
        { p: "يعمل [يولياس AI](/help-center/yolias-ai) في حدود دور الشخص الذي يستخدمه: فمع المحلل يجيب عن أسئلة النتائج، لكنه لا يغيّر شيئًا." },

        { h2: "أي دور أختار؟" },
        { table: { head: ["الشخص", "الدور"], rows: [
          ["يدير النشاط معك، أو يدفع، أو يدير الفريق", "مسؤول"],
          ["يشغّل الحملات ويرد على العملاء ويحضر الاجتماعات", "معلن"],
          ["يتابع النتائج فقط: محاسب أو مستثمر أو مدير يراجع التقارير", "محلل"],
          ["وكالة أو مستقل يدير حملاتك", "معلن، حتى لا يغيّر الفوترة أو الفريق"],
        ] } },
        { p: "ابدأ بأضيق دور يكفي الشخص لإنجاز عمله. وتستطيع تغييره في أي وقت من **الإعدادات ← الفريق**، ويسري التغيير من أول إجراء يقوم به بعدها." },

        { h2: "أضف شخصًا" },
        { ol: [
          "افتح اسمك في أسفل الشريط الجانبي ثم **الإعدادات ← الفريق**.",
          "اضغط **إضافة أشخاص**، فتفتح نافذة **إضافة أشخاص**.",
          "في **البريد الإلكتروني** اكتب بريد العمل الخاص بالشخص.",
          "في **الدور** اختر **مسؤول** أو **معلن** أو **محلل**، ويعرض كل خيار ما يستطيعه الدور. والاختيار الافتراضي **معلن**.",
          "اضغط **إرسال الدعوة**.",
        ] },
        { p: "**كيف تعرف أن الإضافة تمت:** تُغلق النافذة وتظهر الدعوة في **الأشخاص** بعنوان البريد ومعه **تم إرسال الدعوة · (الدور)** ووسم **قيد الانتظار**. ويرسل إليه يولياس بريدًا فيه رابط الدعوة، بلغته إن كان يستخدم يولياس، وإلا بلغتك. ولا ينضم إلا عندما يقبلها." },
        { p: "**إذا لم تتم:** تبقى النافذة مفتوحة ومعها رسالة. راجع حل المشكلات أدناه." },
        { p: "كل دعوة لعنوان بريد واحد. ولإضافة عدة أشخاص كرر الخطوات لكل شخص منهم، واختر لكل واحد الدور الذي يناسب عمله." },

        { h2: "ماذا يحدث عندما يفتح البريد؟" },
        { ol: [
          "يفتح الرابط صفحة الدعوة **انضم إلى (مساحة العمل) على يولياس**، وفيها من دعاه والدور والبريد الذي أُرسلت إليه.",
          "إذا لم يكن له حساب في يولياس يضغط **أنشئ حسابك وانضم** ويؤكد بريده من الرابط الذي يرسله يولياس، فيصبح الحساب الجديد في مساحة عملك بالدور الذي اخترته.",
          "وإذا كان له حساب يضغط **سجّل الدخول** في الصفحة نفسها ثم **انضم إلى الفريق**. والحساب الفارغ الخاص به، مثل الذي يحصل عليه العضو بعد إزالته، تحل محله مساحة عملك.",
          "يطلب يولياس اسمه في خطوة ترحيب قصيرة. أما بيانات شركتك فتأتي من مساحة العمل، فلا يكتبها مرة أخرى.",
        ] },
        { p: "الدعوة لعنوان بريد واحد: فإذا دخل ببريد آخر تطلب منه الصفحة الدخول بالبريد المدعو. والحساب الذي له حملات أو مدفوعات أو فريق خاص به لا يستطيع الانضمام، وتوضح الصفحة السبب. ويعمل الرابط حتى تُقبل الدعوة أو تُلغى." },
        { p: "وبعد ذلك يدخل من صفحة تسجيل الدخول بالبريد نفسه مثل أي عضو، فيصله رابط دخول جديد في كل مرة. راجع [تسجيل الدخول](/help-center/signing-in). ويرى من أول دخول ما في مساحة العمل من حملات وعملاء ومحادثات واجتماعات، في حدود دوره." },

        { h2: "ماذا يضبط كل شخص لنفسه؟" },
        { ul: [
          "**البريد.** يربط كل شخص بريده في Gmail أو أي بريد آخر من **التكاملات**. وترسل الحملات التي ينشئها من بريده، وتصل الردود إلى محادثاته. ومن لم يربط بريدًا لا يستطيع تشغيل حملة ترسل رسائل، لأن الحملة ترسل من بريد العضو الذي ينشئها. راجع [ربط Gmail](/help-center/connect-gmail).",
          "**صفحة الحجز وتقويم Google.** لكل شخص صفحة حجز وساعات وربط تقويم خاص به. والاجتماعات التي يحجزها يولياس من رد تذهب إلى العضو الذي تجري المحادثة من بريده. راجع [الاجتماعات وصفحة الحجز](/help-center/deals-and-meetings).",
          "**اللغة والمنطقة الزمنية والإشعارات.** يضبطها كل شخص في إعداداته.",
        ] },
        { p: "يتم كل ما سبق من حساب الشخص نفسه بعد دخوله، ولا يستطيع المالك أو المسؤول ربط بريد أو تقويم باسم زميل أو ضبط صفحة حجزه نيابة عنه. لذلك اطلب من كل عضو جديد أن يربط بريده ويضبط صفحة حجزه في أول يوم." },
        { p: "أما الحملات والجماهير والعملاء والمحادثات والاجتماعات والرصيد فهي ملك مساحة العمل، ويراها كل الأعضاء. ويعرض عمود **المسؤول** في **الحملات** من أنشأ كل حملة." },

        { h2: "من في مساحة العمل؟" },
        { p: "تعرض **الإعدادات ← الفريق** الجميع تحت **الأشخاص**: كل من يمكنه الوصول إلى هذا الحساب، ودوره. ويعرض كل صف الصورة أو الأحرف الأولى، والاسم، والبريد، والدور. ويستطيع كل عضو فتح هذه القائمة، لكن قوائم الأدوار وأزرار X لا تظهر إلا للمالك والمسؤولين." },

        { h2: "غيّر دور شخص" },
        { ol: [
          "افتح **الإعدادات ← الفريق**.",
          "بجوار الشخص افتح قائمة الدور واختر **مسؤول** أو **معلن** أو **محلل**.",
        ] },
        { p: "**كيف تعرف أن التغيير تم:** تعرض القائمة الدور الجديد، وتتغير صلاحيات الشخص من أول إجراء يقوم به بعدها. ولا يمكنك تغيير دورك أنت ولا دور المالك، فيظهر الدور لهما وسمًا بدل القائمة." },

        { h2: "أزل شخصًا" },
        { ol: [
          "افتح **الإعدادات ← الفريق**.",
          "اضغط X بجوار الشخص.",
          "أكّد **إزالة (الاسم) من مساحة العمل؟**.",
        ] },
        { p: "**كيف تعرف أن الإزالة تمت:** يختفي الشخص من **الأشخاص** ويفقد الوصول إلى مساحة عملك في الحال، حتى لو كان داخل يولياس في تلك اللحظة. ويبقى ما أنشأه، من حملات وعملاء ومحادثات واجتماعات، في مساحة عملك، ويستطيع بقية الأعضاء متابعته." },
        { p: "لا يُحذف حسابه: يمنحه يولياس مساحة عمل جديدة فارغة خاصة به، ويمر بخطوات الترحيب مرة أخرى عند دخوله التالي. ويمكنك دعوته مرة أخرى لاحقًا، فيقبل الدعوة الجديدة من رابطها." },

        { h2: "قبل أن تزيل شخصًا" },
        { ul: [
          "**الحملات التي يتولاها.** في **الحملات** حدد حملاته، وافتح **تعديل (العدد) حملات**، واختر عضوًا آخر في **المسؤول** واحفظ، ليتابعها شخص غيره.",
          "**الاجتماعات القادمة.** تبقى الاجتماعات المحجوزة على صفحته في **الاجتماعات**. حدد من سيحضرها، أو ألغها حتى يُبلَّغ الضيوف قبل أن يفقد الشخص الوصول.",
          "**المحادثات التي تنتظر ردًا.** افتح **المحادثات** وأجب عنها، أو سلّمها لزميل، قبل إزالة الشخص.",
        ] },

        { h2: "ألغِ دعوة" },
        { p: "الدعوة التي تنتظر القبول تظهر في **الأشخاص** بعنوان البريد ومعه: تم إرسال الدعوة · (الدور) ووسم **قيد الانتظار**. اضغط X بجوارها لإلغائها، فيتوقف رابطها عن العمل. وبعد أن يظهر الشخص باسمه ودوره استخدم الإزالة بدلًا من ذلك." },

        { h2: "مثال" },
        { p: "شركة مستلزمات أسنان تعمل على يولياس بثلاثة أشخاص. يضيف المؤسس، وهو المالك، مدير المبيعات بدور **مسؤول** ليتولى الفوترة والفريق، ومندوبة مبيعات بدور **معلن** تربط Gmail وتقويم Google الخاصين بها وتشغّل حملاتها، والمحاسب بدور **محلل** ليتابع الإنفاق وتكلفة الاجتماع. يفتح المحاسب الحملات والاجتماعات ويرى الرصيد والاستهلاك في صفحة الاستخدام، لكنه لا يرى الفواتير لأنها للمالك والمسؤول فقط. وبعد ستة أشهر تغادر المندوبة، فيزيلها المسؤول، وتبقى حملاتها وعملاؤها واجتماعاتها السابقة في مساحة العمل." },
        { p: "وفي حالة أخرى تعمل مجموعة مطاعم مع وكالة تسويق. يضيف المالك مديرة الحساب في الوكالة بدور **معلن**: تربط بريدًا، وتبني الحملات وتشغّلها، وترد على العملاء، لكن **الفوترة** تعرض لها: الفوترة متاحة لمالك مساحة العمل والمسؤولين فقط. فتبقى المدفوعات والفريق في يد المطاعم." },

        { h2: "الصلاحيات والمتطلبات" },
        { ul: [
          "يرى المالك والمسؤول فقط زر **إضافة أشخاص**، ويغيّران الأدوار ويزيلان الأشخاص ويلغيان الدعوات. ويرى الباقون القائمة.",
          "المستخدمون بلا حد في كل الخيارات، ولا يغيّرون السعر أبدًا.",
          "لا يدفع الشخص المدعو ولا يشترك بشكل منفصل، فهو يستخدم رصيد مساحة العمل وخطتها، ويُحسب ما تصل إليه حملاته من الرصيد نفسه.",
          "لكل بريد حساب واحد في يولياس، والحساب ينتمي إلى مساحة عمل واحدة.",
          "لا يستطيع المسؤول تغيير دوره بنفسه ولا إزالة نفسه، فيطلب ذلك من المالك أو من مسؤول آخر في مساحة العمل نفسها.",
        ] },

        { h2: "ملاحظات مهمة" },
        { ul: [
          "لتسليم مساحة العمل لشخص آخر يفتح المالك **الإعدادات ← الفريق** ويضغط التاج بجانب العضو (**اجعل {name} المالك**) ثم يؤكد. فيصبح العضو المالك ويصله إشعار، ويصبح المالك السابق مسؤولًا. والمالك وحده يستطيع ذلك.",
          "لا يستطيع المالك حذف حسابه ما دام في مساحة العمل أشخاص آخرون. راجع [حذف حسابك](/help-center/deleting-account).",
          "إزالة شخص لا تفصل ما ربطه في Google، ويستطيع هو إزالة يولياس من إعدادات الأمان في حسابه على Google.",
        ] },

        { h2: "حل المشكلات" },
        { h3: "هذا الشخص موجود في فريقك بالفعل." },
        { p: "يظهر بالفعل في **الأشخاص**، ويمكنك تغيير دوره من هناك." },
        { h3: "أدخل بريدًا إلكترونيًا صالحًا." },
        { p: "راجع العنوان بحثًا عن خطأ في الكتابة أو مسافة زائدة في أوله أو آخره، ثم أعد المحاولة." },
        { h3: "تعذّر إرسال بريد الدعوة." },
        { p: "لم يُنشأ شيء. حاول مرة أخرى بعد دقائق." },
        { h3: "لم يصل بريد الدعوة" },
        { p: "اطلب منه مراجعة الرسائل غير المرغوب فيها. ولإرسالها مرة أخرى اضغط **إضافة أشخاص** بالبريد نفسه، فتُرسل الدعوة نفسها من جديد." },
        { h3: "يرى أسئلة عن شركته الخاصة" },
        { p: "سجّل بنفسه بدل التسجيل من الدعوة، فأنشأ له يولياس مساحة عمل منفصلة. يفتح رابط الدعوة مرة أخرى ويضغط **انضم إلى الفريق**، وما دامت مساحة عمله بلا حملات ولا مدفوعات ولا فريق تحل محلها مساحة عملك." },
        { h3: "تقول صفحة الدعوة إنه لا يمكن استخدامها" },
        { p: "أُلغيت الدعوة أو قُبلت بالفعل. أرسل دعوة جديدة من **إضافة أشخاص**." },
        { h3: "لا يظهر زر إضافة أشخاص" },
        { p: "دورك معلن أو محلل. اطلب ذلك من المالك أو أحد المسؤولين." },

        { h2: "مقالات ذات صلة" },
        { ul: ["[حذف حسابك](/help-center/deleting-account)", "[ربط Gmail](/help-center/connect-gmail)", "[ربط تقويم Google](/help-center/google-calendar)", "[تسجيل الدخول](/help-center/signing-in)"] },
      ],
    },
  },

  "deleting-account": {
    en: {
      title: "Deleting your account",
      summary: "What deleting your account removes in each case, what to do first, and how to delete it from Settings → Account.",
      updated: "2026-11-05",
      blocks: [
        { p: "Deleting your account is permanent. What it removes depends on your role and on whether anyone else is in your workspace. This article covers each case, what to save first, and the steps." },

        { h2: "What does deleting remove?" },
        { table: { head: ["Your situation", "What is deleted", "What stays"], rows: [
          ["Owner, alone in the workspace", "Your account and the whole workspace: campaigns, audiences, leads, conversations, meetings, booking page, invoices, credit and plan", "Nothing in Yolias"],
          ["Owner, with other people in the workspace", "Nothing: deletion is refused until you remove them", "Everything"],
          ["Admin, Advertiser or Analyst in someone's workspace", "Your account, your booking page, your Google Calendar connection and your connected mailboxes", "The workspace and everything in it, including the campaigns you created"],
        ] } },
        { p: "In every case you are signed out, taken to the sign-up page, and a confirmation is sent to your email." },

        { h2: "Before you delete" },
        { ul: [
          "**Export your leads.** Deleted leads can't be recovered. See [Exporting](/help-center/exporting-prospects).",
          "**Save your invoices.** If you are the Owner and alone, invoices are deleted with the workspace. In **Settings → Billing**, press **View** on each invoice, then **Download PDF**.",
          "**Cancel upcoming meetings.** Deleting doesn't tell your guests. Cancel each upcoming meeting in **Meetings** so guests are told, or tell them yourself.",
          "**Remove your teammates,** if you are the Owner. See [Adding people](/help-center/inviting-teammates).",
          "**Use your credit,** if you are the Owner and alone. Credit left in the workspace is deleted with it.",
          "**Consider canceling instead.** If you only want to stop paying, [cancel your plan](/help-center/changing-plan): everything stays saved and you can come back.",
        ] },

        { h2: "Delete your account" },
        { ol: [
          "Open your name at the bottom of the sidebar, then **Settings → Account**.",
          "Scroll to the box at the bottom: **Delete account**, Permanently delete your profile and extracted customer databases.",
          "Press **Delete account**.",
          "Your browser asks: Permanently delete your Yolias account and its discovered customer data? This can’t be undone. Press **OK** to confirm, or **Cancel** to keep your account.",
        ] },
        { p: "**How to know it worked:** you are signed out and land on the sign-up page, and an email confirms the deletion." },
        { p: "**If it didn't work:** you stay in Settings with a message. See Troubleshooting below." },

        { h2: "If you are the Owner and have a team" },
        { ol: [
          "Open **Settings → Team**.",
          "Remove every other person: press the X next to each one and confirm. Removed people keep their own accounts in new, empty workspaces.",
          "If an invitation shows **Pending**, press its X to revoke it.",
          "Return to **Settings → Account** and delete your account. As the only member, the workspace is deleted with it.",
        ] },
        { p: "Yolias has no option to hand the workspace to someone else. If the team should keep working in it, don't delete your account." },

        { h2: "What happens outside Yolias?" },
        { ul: [
          "Your plan stops: with the workspace deleted, no renewal is charged.",
          "The **Yolias meetings** calendar and its events stay in your Google account. Delete them in Google Calendar if you no longer want them.",
          "Yolias may still be listed in your Google account's connected apps. Remove it from your Google account's security settings.",
          "Your public booking link stops working.",
          "Emails your campaigns already sent stay in the recipients' inboxes, and in your own mailbox's sent folder.",
        ] },

        { h2: "Can I come back?" },
        { p: "Deletion can't be undone, and Yolias can't restore a deleted account or workspace. You can sign up again with the same email at any time: you start with a new, empty workspace." },

        { h2: "Example" },
        { p: "A freelance designer used Yolias alone on Pay As You Go. She exports her leads, downloads her three invoices, cancels one upcoming meeting, then deletes her account from **Settings → Account**. She is signed out, receives the confirmation email, and her workspace with its campaigns and remaining credit is gone." },

        { h2: "Permissions and requirements" },
        { ul: [
          "Every person can delete their own account, whatever their role.",
          "No one can delete another person's account. To take someone's access away, remove them in **Settings → Team**.",
          "The Owner can delete their account only when they are the only member.",
        ] },

        { h2: "Troubleshooting" },
        { h3: "Make another member the owner in Team, or remove your team members first. The workspace owner can’t leave a team behind." },
        { p: "You are the Owner and other people are in the workspace. In **Settings → Team**, make one of them the owner with the crown next to their name, or remove them, then try again." },
        { h3: "Couldn’t delete the account. Please try again." },
        { p: "The deletion didn't complete. Reload the page and try again. If it repeats, contact [support](/contact?topic=support)." },
        { h3: "I deleted my account by mistake" },
        { p: "It can't be restored. Sign up again to start a new workspace." },

        { h2: "Related articles" },
        { ul: ["[Exporting](/help-center/exporting-prospects)", "[Changing or canceling your plan](/help-center/changing-plan)", "[Adding people](/help-center/inviting-teammates)", "[Connecting Google Calendar](/help-center/google-calendar)"] },
      ],
    },
    ar: {
      title: "حذف حسابك",
      summary: "ما يزيله حذف الحساب في كل حالة، وما تفعله قبله، وكيف تحذفه من الإعدادات ← الحساب.",
      updated: "2026-11-05",
      blocks: [
        { p: "حذف الحساب نهائي، وما يزيله يعتمد على دورك وعلى وجود أشخاص آخرين في مساحة عملك. يشرح هذا المقال كل حالة، وما تحفظه أولًا، وخطوات الحذف." },

        { h2: "ماذا يزيل الحذف؟" },
        { table: { head: ["حالتك", "ما يُحذف", "ما يبقى"], rows: [
          ["المالك، وحدك في مساحة العمل", "حسابك ومساحة العمل كلها: الحملات والجماهير والعملاء والمحادثات والاجتماعات وصفحة الحجز والفواتير والرصيد والخطة", "لا شيء في يولياس"],
          ["المالك، ومعك أشخاص آخرون في مساحة العمل", "لا شيء: يُرفض الحذف حتى تزيلهم", "كل شيء"],
          ["مسؤول أو معلن أو محلل في مساحة عمل شخص آخر", "حسابك وصفحة حجزك وربط تقويم Google وصناديق البريد التي ربطتها", "مساحة العمل وكل ما فيها، ومنه الحملات التي أنشأتها"],
        ] } },
        { p: "وفي كل الحالات يُسجَّل خروجك، وتنتقل إلى صفحة التسجيل، ويصل بريد تأكيد إلى عنوانك." },

        { h2: "قبل أن تحذف" },
        { ul: [
          "**صدّر عملاءك.** لا يمكن استعادة العملاء بعد حذفهم. راجع [التصدير](/help-center/exporting-prospects).",
          "**احفظ فواتيرك.** إذا كنت المالك ووحدك فستُحذف الفواتير مع مساحة العمل. في **الإعدادات ← الفوترة** اضغط **عرض** على كل فاتورة ثم **تنزيل PDF**.",
          "**ألغِ الاجتماعات القادمة.** الحذف لا يُبلغ ضيوفك. ألغِ كل اجتماع قادم من **الاجتماعات** حتى يُبلَّغ الضيوف، أو أبلغهم بنفسك.",
          "**أزل زملاءك** إذا كنت المالك. راجع [إضافة الأشخاص](/help-center/inviting-teammates).",
          "**استخدم رصيدك** إذا كنت المالك ووحدك، لأن الرصيد المتبقي يُحذف مع مساحة العمل.",
          "**فكّر في الإلغاء بدل الحذف.** إذا كنت تريد التوقف عن الدفع فقط، [ألغِ خطتك](/help-center/changing-plan): يبقى كل شيء محفوظًا وتستطيع العودة.",
        ] },

        { h2: "احذف حسابك" },
        { ol: [
          "افتح اسمك في أسفل الشريط الجانبي ثم **الإعدادات ← الحساب**.",
          "انزل إلى المربع في أسفل الصفحة: **حذف الحساب**، حذف ملفك الشخصي وقواعد بيانات العملاء المستخرجة نهائيًا.",
          "اضغط **حذف الحساب**.",
          "يسألك المتصفح: هل تريد حذف حساب يولياس وبيانات العملاء المكتشفة نهائيًا؟ لا يمكن التراجع عن ذلك. اضغط **موافق** للتأكيد، أو **إلغاء** للإبقاء على حسابك.",
        ] },
        { p: "**كيف تعرف أن الحذف تم:** يُسجَّل خروجك وتصل إلى صفحة التسجيل، ويصلك بريد يؤكد الحذف." },
        { p: "**إذا لم يتم:** تبقى في الإعدادات وتظهر رسالة. راجع حل المشكلات أدناه." },

        { h2: "إذا كنت المالك ومعك فريق" },
        { ol: [
          "افتح **الإعدادات ← الفريق**.",
          "أزل كل شخص آخر: اضغط X بجوار كل واحد وأكّد. ويحتفظ من تزيلهم بحساباتهم في مساحات عمل جديدة فارغة.",
          "إذا ظهرت دعوة بوسم **قيد الانتظار** فاضغط X بجوارها لإلغائها.",
          "ارجع إلى **الإعدادات ← الحساب** واحذف حسابك. ولأنك العضو الوحيد تُحذف مساحة العمل معه.",
        ] },
        { p: "لا يوجد في يولياس خيار لتسليم مساحة العمل إلى شخص آخر. فإذا كان الفريق سيواصل العمل فيها فلا تحذف حسابك." },

        { h2: "ماذا يحدث خارج يولياس؟" },
        { ul: [
          "تتوقف خطتك: بعد حذف مساحة العمل لا يُخصم أي تجديد.",
          "يبقى تقويم **Yolias meetings** وأحداثه في حسابك على Google، فاحذفها من تقويم Google إذا لم تعد تحتاجها.",
          "قد يظل يولياس ظاهرًا في التطبيقات المتصلة بحسابك على Google، فأزله من إعدادات الأمان في حسابك.",
          "يتوقف رابط صفحة حجزك العامة عن العمل.",
          "تبقى الرسائل التي أرسلتها حملاتك في صناديق من استلموها، وفي مجلد المرسل في بريدك.",
        ] },

        { h2: "هل أستطيع العودة؟" },
        { p: "لا يمكن التراجع عن الحذف، ولا يستطيع يولياس استعادة حساب أو مساحة عمل محذوفة. وتستطيع التسجيل من جديد بالبريد نفسه في أي وقت، فتبدأ بمساحة عمل جديدة فارغة." },

        { h2: "مثال" },
        { p: "مصممة مستقلة استخدمت يولياس وحدها بالدفع حسب الاستخدام. تصدّر عملاءها، وتنزّل فواتيرها الثلاث، وتلغي اجتماعًا قادمًا واحدًا، ثم تحذف حسابها من **الإعدادات ← الحساب**. يُسجَّل خروجها، ويصلها بريد التأكيد، وتُحذف مساحة عملها بحملاتها ورصيدها المتبقي." },

        { h2: "الصلاحيات والمتطلبات" },
        { ul: [
          "يستطيع كل شخص حذف حسابه هو، أيًّا كان دوره.",
          "لا يستطيع أحد حذف حساب شخص آخر. ولسحب وصول شخص أزله من **الإعدادات ← الفريق**.",
          "لا يستطيع المالك حذف حسابه إلا إذا كان العضو الوحيد.",
        ] },

        { h2: "حل المشكلات" },
        { h3: "اجعل عضوًا آخر المالك من صفحة الفريق، أو أزل أعضاء فريقك أولًا، إذ لا يمكن لمالك مساحة العمل ترك فريق خلفه." },
        { p: "أنت المالك وفي مساحة العمل أشخاص آخرون. من **الإعدادات ← الفريق** اجعل أحدهم المالك بالتاج بجانب اسمه، أو أزلهم، ثم حاول مرة أخرى." },
        { h3: "تعذّر حذف الحساب. حاول مرة أخرى." },
        { p: "لم يكتمل الحذف. أعد تحميل الصفحة وحاول مرة أخرى، وإذا تكرر فتواصل مع [الدعم](/contact?topic=support)." },
        { h3: "حذفت حسابي بالخطأ" },
        { p: "لا يمكن استعادته. سجّل من جديد لتبدأ مساحة عمل جديدة." },

        { h2: "مقالات ذات صلة" },
        { ul: ["[التصدير](/help-center/exporting-prospects)", "[تغيير خطتك أو إلغاؤها](/help-center/changing-plan)", "[إضافة الأشخاص](/help-center/inviting-teammates)", "[ربط تقويم Google](/help-center/google-calendar)"] },
      ],
    },
  },
};
