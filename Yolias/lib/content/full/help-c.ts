import type { Doc, Localized } from "../types";

// Help Center, full articles: audiences, leads, export, conversations, a
// search waiting to start, and requests Yolias AI can't complete.
// Checked against the product code and UI text, 2026-11-05.
export const helpC: Record<string, Localized<Doc>> = {
  audiences: {
    en: {
      title: "Audiences",
      summary: "Targeting, signals, custom and lookalike audiences, and how to reuse them across campaigns.",
      updated: "2026-11-05",
      blocks: [
        { p: "An audience decides who a campaign reaches. You set it inside the campaign builder, or you keep it on the **Audiences** page and reuse it in any campaign. This article covers both places, every audience type, and how Yolias reads what you enter." },

        { h2: "What an audience is" },
        { p: "Each campaign holds one or more audiences, the same way an ad campaign holds ad sets. Every audience has its own targeting and its own results, so you can see which one brings meetings and customers. Building or saving an audience contacts no one. People are contacted only when a campaign that uses the audience runs." },
        { p: "The **Audiences** page in the sidebar lists every audience in your workspace in one table with these columns:" },
        { table: { head: ["Column", "What it shows"], rows: [
          ["Name", "The name you gave the audience."],
          ["Type", "Custom audience, Lookalike audience or Saved targeting."],
          ["Size", "Custom: the number of people (\"{n} people\"). Lookalike: the size of the base it learned from (\"Seed of {n}\"). Saved targeting: \"Targeting\", because it has no fixed list."],
          ["Source", "Where it comes from: the custom source, the lookalike base and similarity level, or the first fields of a saved targeting."],
          ["Confidence", "Lookalikes only: Low, Medium or High."],
          ["Used in", "How many campaigns use it."],
          ["Updated", "The last time it was built, refreshed, renamed or edited."],
        ] } },
        { p: "The tabs above the table filter it: **All**, **Custom**, **Lookalike** and **Saved targeting**, each with its count." },

        { h2: "The audience types" },
        { table: { head: ["Type", "What it holds", "How a campaign uses it"], rows: [
          ["New targeting (in the builder)", "Locations, company fields, people fields, signals and exclusions", "Yolias finds new companies and people that match, and keeps finding them while the campaign runs."],
          ["Custom audience", "People you already have: a previous campaign's contacts, your customers, people who booked a meeting, interested people, or a CSV file", "The people in the list join the campaign directly. No new search runs."],
          ["Lookalike audience", "The traits most of a base shares, plus a list of seed companies", "Yolias searches for new companies similar to the seed companies, within the shared traits."],
          ["Saved targeting", "A targeting you saved to reuse", "Works like new targeting: Yolias searches for matches."],
        ] } },

        { h2: "How targeting works" },
        { p: "In the campaign builder, open the **Audience** step and pick **Find new people for this targeting**. The editor has five groups:" },
        { ul: [
          "**Locations**: countries, then the regions and cities of a country. Each place is included or excluded.",
          "**Companies**: Industries, Company type, Employees and Revenue (yearly).",
          "**People**: Decision makers only, Job titles, Seniority and Department.",
          "**Signals**: Buying intent (what they need now), Hiring now, Funding stage, Technologies they use, and Keywords (services, needs, website topics).",
          "**Exclusions**: Companies never to contact.",
        ] },
        { p: "Below the groups, **Anything else about who fits (optional)** takes free text, up to 2,000 characters, for anything the fields don't cover." },
        { h3: "The matching rule" },
        { p: "Inside a field, any of the values is enough. Across fields, all of them must match. Choosing Dental and Healthcare & clinics in Industries finds companies in either one. Adding Riyadh in Cities then keeps only those in Riyadh." },
        { h3: "Include and exclude" },
        { p: "Locations, Industries, Job titles and Keywords offer **Include** and **Exclude**. A value can sit on one side only: picking an included place on the Exclude side moves it there. Excluded values show with a minus sign. The other fields are include only." },
        { h3: "Lists and your own values" },
        { p: "Each list field is searchable. Type to filter, then pick a value or press Enter to take the first match. Industries, Job titles and every signal field also take your own value: type it and choose **Add “…”**. Revenue and Funding stage carry the hint \"Only where the data is published\": companies that don't publish these figures don't match them." },
        { h3: "Locations" },
        { p: "The location picker lists every country, searchable in English and Arabic. A country with regions and cities shows **Regions · Cities** beside it. Open it to pick its regions and its cities (cities of 5,000 people or more, each shown with its region and population). Every choice appears as a chip you can remove on its own. With nothing chosen, the picker reads **Anywhere**." },
        { h3: "Signals" },
        { table: { head: ["Signal", "What it means"], rows: [
          ["Buying intent (what they need now)", "Needs or projects their site, posts or job ads show, for example \"opening a new branch\". You type the needs."],
          ["Hiring now", "Only companies with open roles."],
          ["Funding stage", "Pre-seed, Seed, Series A, Series B, or Series C+. Only where the data is published."],
          ["Technologies they use", "Tools or platforms the company runs, typed by you."],
          ["Keywords (services, needs, website topics)", "Words about what the company does or needs. Can be included or excluded."],
        ] } },

        { h2: "Check the size of an audience" },
        { p: "Under the targeting, the **Audience** box shows two numbers: how many matching companies and people are already in Yolias, and how many of them can be emailed. For new targeting it adds that Yolias keeps finding new matches while the campaign runs. The numbers come from data Yolias already has, not from the whole market, and they are not a promise of results. Press **Check again** after a change." },
        { p: "The known count reads locations, industries, job titles, employee sizes and Companies never to contact. Signals, company type, seniority, department and revenue still narrow the search when the campaign runs, but they don't change this count." },
        { p: "Before launch, the builder also warns about three problems. It doesn't block the launch:" },
        { ul: [
          "the same value is included and excluded;",
          "no job titles, seniority or department, when the campaign contacts people;",
          "no location, or no industry, company type, keyword or technology.",
        ] },

        { h2: "Create a custom audience" },
        { ol: [
          "Open **Audiences** in the sidebar and choose **Create audience**, then **Custom audience**.",
          "Enter a **Name**, for example \"Clinics that booked a meeting\".",
          "Under **Build it from**, pick a source: A previous campaign's contacts, Your customers, People who booked a meeting, Interested people, or A file (CSV). For a previous campaign, choose it in **Pick a campaign**.",
          "Press **Preview**. The line under it shows how many people the source holds, how many have an email, and how many asked not to be contacted. Campaigns skip those.",
          "Press **Create audience**. The message \"Audience created: {n} people.\" confirms it, and the audience appears in the table.",
        ] },
        { p: "If you see \"Nobody to add.\", the source is empty: no won deals for Your customers, no meetings, no interested replies, or no contacts in that campaign." },
        { h3: "From a CSV file" },
        { ol: [
          "In **Build it from**, choose **A file (CSV)**, then **Choose a CSV file**.",
          "Enter the audience name and pick the file. The first row must hold the column names. A file can have up to 5,000 rows and 5 MB.",
          "Check **Import as** (People, Companies or Local businesses) and the **Columns**. Yolias guesses each column from its header; set any column to **Don’t import** to leave it out.",
          "Read the summary: the number of rows ready, and rows skipped because they have no name.",
          "Press **Import {count} rows**.",
        ] },
        { p: "Name is the only required column. Email, company, title, website and country help Yolias. Imported rows also appear in **Leads** with the source **Imported**, and count toward the uploaded contacts in your plan for the month." },

        { h2: "Create a lookalike audience" },
        { ol: [
          "On **Audiences**, choose **Create audience**, then **Lookalike audience**, and enter a name.",
          "Under **Similar to**, pick the base: Your customers, People who booked a meeting, Interested people, or One of your custom audiences.",
          "Set **Similarity** from 1 (**Closest**) to 10 (**Broader**). The default is 3.",
          "Press **Analyze**. Yolias shows how many people it learned from, a confidence badge, what most of them share with the share of each trait, and the companies it will find lookalikes of.",
          "Press **Create lookalike**. The button stays off until the analysis found someone to learn from.",
        ] },
        { p: "Closer keeps only traits that most of the base shares, so it finds fewer and more similar companies. Broader keeps traits fewer of them share and uses more seed companies. From level 6 the job titles are dropped, and from level 8 the company sizes are dropped too." },
        { table: { head: ["Confidence", "Base size"], rows: [["Low", "Fewer than 5 people to learn from"], ["Medium", "5 to 19 people"], ["High", "20 or more people"]] } },
        { p: "Similar is not the same as ready to buy: Yolias still qualifies each company before writing to it." },

        { h2: "Save a targeting" },
        { p: "On **Audiences**, choose **Create audience**, then **Saved targeting**. Name it, fill the same targeting editor the builder uses, and press **Save targeting**. From the builder, set up an audience and press **Save as an audience**. You see \"Saved to Audiences.\"" },

        { h2: "Use an audience in a campaign" },
        { ol: [
          "Open the campaign builder: **Create campaign**, or **Use in a campaign** from an audience's menu on the Audiences page. The menu opens a new campaign; it doesn't preselect the audience.",
          "In the **Audience** step, choose **Use a saved audience**.",
          "Pick the audience in the list. Each row shows its type, and custom audiences show their number of people.",
          "Read the **Audience** box: a custom audience shows its people and how many can be emailed.",
        ] },
        { p: "With no audiences yet, the list reads \"No saved audiences yet.\" and **Open Audiences** takes you there. To compare two audiences, add both to the campaign with **Add audience**, or use **Duplicate** to copy one and change it." },

        { h2: "Manage audiences" },
        { p: "The menu at the end of each row offers:" },
        { ul: [
          "**Use in a campaign**: opens the campaign builder.",
          "**Edit** (saved targeting) or **Rename** (custom and lookalike). Custom and lookalike audiences can only be renamed.",
          "**Refresh** (custom and lookalike, except file audiences): a custom audience is rebuilt from its source, so new customers or meetings are added. A lookalike learns again from its base at the same similarity.",
          "**Delete**: asks first. Campaigns that already used the audience keep their people.",
        ] },

        { h2: "Examples" },
        { ul: [
          "**Clinics in one city**: Cities Riyadh; Industries Dental and Healthcare & clinics; Employees 1-10 and 11-50; Job titles Owner, Clinic Manager, Practice Owner; Companies never to contact: your current clients.",
          "**Companies hiring sales staff**: Countries United Arab Emirates and Saudi Arabia; Industries Software & SaaS; Hiring now on; Department Sales; Seniority Director and Head.",
          "**Win back past interest**: a custom audience from Interested people, used in a new campaign with a new offer.",
          "**More customers like your best ones**: a lookalike of Your customers at similarity 3, after at least 20 won deals.",
        ] },

        { h2: "Permissions and requirements" },
        { ul: [
          "Admins and Advertisers can create, refresh, rename and delete audiences. Analysts can open the page and preview, but saving returns \"Your role is Analyst: you can see the results but not change them.\"",
          "A custom audience from a file counts toward the uploaded contacts of your plan for the month.",
          "Up to 5,000 people are read from one source.",
          "A lookalike needs at least one won customer, meeting, interested person or custom audience member in its base.",
        ] },

        { h2: "Important notes" },
        { ul: [
          "Once a campaign is running, its existing audiences are locked: \"This campaign is running: its audiences' targeting can't change. Add a new audience instead.\"",
          "People who asked not to be contacted are skipped by every campaign, even when they sit in a custom audience.",
          "Company type, seniority and department are include only; you can't exclude them.",
        ] },

        { h2: "Troubleshooting" },
        { table: { head: ["Problem", "What to do"], rows: [
          ["The known count is low", "Widen the location, or add industries, sizes or job titles. Removing a signal doesn't change this count; it widens the search once the campaign runs."],
          ["\"Nobody to add.\" when creating a custom audience", "The source is empty. Pick another source, or a campaign that contacted people."],
          ["A lookalike shows Low confidence", "The base is small. Use a bigger base or wait for more customers or meetings, then press **Refresh**."],
          ["\"There is nobody to learn from yet in this base.\"", "The base has no people. Choose another base."],
          ["**Create lookalike** stays off", "Enter a name and press **Analyze** first."],
          ["\"Couldn't read this file.\" or rows skipped", "Use a .csv file up to 5 MB, with column names in the first row and a name in every row."],
          ["An audience can't be edited in a running campaign", "Add a new audience to the campaign instead."],
        ] } },

        { h2: "Related articles" },
        { ul: [
          "[Creating a campaign](/help-center/creating-a-campaign)",
          "[Working with leads](/help-center/prospects-workspace)",
          "[A campaign waiting to start](/help-center/awaiting-data-source)",
          "[Exporting leads and campaigns](/help-center/exporting-prospects)",
        ] },
      ],
    },
    ar: {
      title: "الجماهير",
      summary: "الاستهداف والإشارات والجماهير المخصصة والمشابهة، وطريقة إعادة استخدامها في الحملات.",
      updated: "2026-11-05",
      blocks: [
        { p: "الجمهور هو من تصل إليهم الحملة. تحدده داخل بناء الحملة، أو تحفظه في صفحة **الجماهير** وتعيد استخدامه في أي حملة. يشرح هذا المقال المكانين، وكل أنواع الجماهير، وكيف يقرأ يولياس ما تدخله." },

        { h2: "ما هو الجمهور" },
        { p: "تضم كل حملة جمهورًا أو أكثر، كما تضم الحملة الإعلانية مجموعات إعلانية. ولكل جمهور استهدافه ونتائجه، فترى أيها يأتي باجتماعات وعملاء. وإنشاء الجمهور أو حفظه لا يراسل أحدًا، فالتواصل يبدأ فقط عندما تعمل حملة تستخدمه." },
        { p: "تعرض صفحة **الجماهير** في الشريط الجانبي كل جماهير مساحة العمل في جدول واحد بهذه الأعمدة:" },
        { table: { head: ["العمود", "ما يعرضه"], rows: [
          ["الاسم", "الاسم الذي أعطيته للجمهور."],
          ["النوع", "جمهور مخصص، أو جمهور مشابه، أو استهداف محفوظ."],
          ["الحجم", "المخصص: عدد الأشخاص. المشابه: حجم الأساس الذي تعلّم منه («عينة من {n}»). الاستهداف المحفوظ: «استهداف»، لأنه بلا قائمة ثابتة."],
          ["المصدر", "من أين جاء: مصدر الجمهور المخصص، أو أساس المشابه ودرجة تشابهه، أو أول حقول الاستهداف المحفوظ."],
          ["الثقة", "للجمهور المشابه فقط: منخفضة أو متوسطة أو عالية."],
          ["مستخدم في", "عدد الحملات التي تستخدمه."],
          ["آخر تحديث", "آخر مرة أُنشئ فيها أو حُدّث أو أُعيدت تسميته أو عُدّل."],
        ] } },
        { p: "وتصفّي التبويبات أعلى الجدول ما يظهر: **الكل** و**مخصص** و**مشابه** و**استهداف محفوظ**، ومع كل منها عدده." },

        { h2: "أنواع الجماهير" },
        { table: { head: ["النوع", "ما يحتويه", "كيف تستخدمه الحملة"], rows: [
          ["استهداف جديد (في بناء الحملة)", "المواقع وحقول الشركات والأشخاص والإشارات والاستبعادات", "يجد يولياس شركات وأشخاصًا جددًا مطابقين، ويستمر في ذلك طوال عمل الحملة."],
          ["جمهور مخصص", "أشخاص لديك بالفعل: جهات حملة سابقة، أو عملاؤك، أو من حجزوا اجتماعًا، أو المهتمون، أو ملف CSV", "ينضم أشخاص القائمة إلى الحملة مباشرة، دون بحث جديد."],
          ["جمهور مشابه", "السمات التي يشترك فيها معظم أساس معين، مع قائمة شركات مرجعية", "يبحث يولياس عن شركات جديدة تشبه الشركات المرجعية ضمن السمات المشتركة."],
          ["استهداف محفوظ", "استهداف حفظته لتعيد استخدامه", "يعمل كالاستهداف الجديد: يبحث يولياس عن المطابقين."],
        ] } },

        { h2: "كيف يعمل الاستهداف" },
        { p: "في بناء الحملة افتح خطوة **الجمهور** واختر **إيجاد أشخاص جدد لهذا الاستهداف**. يتكون المحرر من خمس مجموعات:" },
        { ul: [
          "**المواقع**: الدول، ثم مناطق الدولة ومدنها. وكل مكان إما مضمَّن أو مستبعَد.",
          "**الشركات**: المجالات، ونوع الشركة، وعدد الموظفين، والإيرادات السنوية.",
          "**الأشخاص**: أصحاب القرار فقط، والمسميات الوظيفية، والمستوى الوظيفي، والإدارة.",
          "**إشارات**: نية الشراء (ما يحتاجونه الآن)، وتوظّف الآن، ومرحلة التمويل، وتقنيات يستخدمونها، وكلمات مفتاحية (خدمات، احتياجات، موضوعات الموقع).",
          "**الاستبعادات**: شركات لا يتم التواصل معها.",
        ] },
        { p: "وتحت المجموعات حقل **أي شيء آخر عن المناسبين (اختياري)** لنص حر حتى 2,000 حرف، لما لا تغطيه الحقول." },
        { h3: "قاعدة المطابقة" },
        { p: "داخل الحقل الواحد تكفي أي قيمة، وبين الحقول يجب أن تتحقق كلها معًا. فاختيار «طب الأسنان» و«الرعاية الصحية والعيادات» في المجالات يأتي بالشركات في أي منهما، وإضافة الرياض في المدن تُبقي من في الرياض منها فقط." },
        { h3: "التضمين والاستبعاد" },
        { p: "تتيح المواقع والمجالات والمسميات الوظيفية والكلمات المفتاحية خياري **تضمين** و**استبعاد**. والقيمة تكون في جانب واحد فقط: إذا اخترت مكانًا مضمَّنًا وأنت في جانب الاستبعاد انتقل إليه. وتظهر القيم المستبعدة بعلامة ناقص. أما بقية الحقول فللتضمين فقط." },
        { h3: "القوائم والقيم التي تكتبها" },
        { p: "كل حقل قائمة قابل للبحث: اكتب لتصفية القيم، ثم اختر قيمة أو اضغط Enter لأخذ أول نتيجة. وتقبل المجالات والمسميات الوظيفية وكل حقول الإشارات قيمة من عندك: اكتبها واختر **إضافة «…»**. ويظهر تحت الإيرادات ومرحلة التمويل تنبيه «حيث تكون البيانات منشورة فقط»، فالشركات التي لا تنشر هذه الأرقام لا تطابقهما." },
        { h3: "المواقع" },
        { p: "تعرض أداة المواقع كل دول العالم، ويمكن البحث فيها بالعربية والإنجليزية. وبجانب كل دولة لها مناطق ومدن يظهر **المناطق والمحافظات · المدن**؛ افتحه لتختار مناطقها ومدنها (المدن التي يبلغ سكانها 5,000 نسمة فأكثر، مع منطقة كل مدينة وعدد سكانها). ويظهر كل اختيار كشريحة تحذفها وحدها. وإذا لم تختر شيئًا تعرض الأداة **أي مكان**." },
        { h3: "الإشارات" },
        { table: { head: ["الإشارة", "معناها"], rows: [
          ["نية الشراء (ما يحتاجونه الآن)", "احتياجات أو مشاريع يظهرها موقعهم أو منشوراتهم أو إعلانات توظيفهم، مثل «افتتاح فرع جديد». تكتبها أنت."],
          ["توظّف الآن", "الشركات التي لديها وظائف مفتوحة فقط."],
          ["مرحلة التمويل", "ما قبل التأسيسية، أو التأسيسية، أو الجولة A أو B أو C وما بعدها. حيث تكون البيانات منشورة فقط."],
          ["تقنيات يستخدمونها", "أدوات أو منصات تعمل بها الشركة، تكتبها أنت."],
          ["كلمات مفتاحية (خدمات، احتياجات، موضوعات الموقع)", "كلمات عما تقدمه الشركة أو تحتاجه، تضمينًا أو استبعادًا."],
        ] } },

        { h2: "اعرف حجم الجمهور" },
        { p: "يعرض مربع **الجمهور** تحت الاستهداف رقمين: عدد الشركات والأشخاص المطابقين الموجودين في يولياس، وعدد من يمكن مراسلتهم بالبريد منهم. ويضيف في الاستهداف الجديد أن يولياس يستمر في إيجاد مطابقين جدد أثناء عمل الحملة. هذان الرقمان من البيانات المتاحة لدى يولياس لا من السوق كله، وليسا وعدًا بنتائج. اضغط **افحص مرة أخرى** بعد أي تغيير." },
        { p: "يحسب هذا الرقم المواقعَ والمجالات والمسميات الوظيفية وأحجام الشركات وقائمة الشركات التي لا يتم التواصل معها. أما الإشارات ونوع الشركة والمستوى الوظيفي والإدارة والإيرادات فتضيّق البحث عند عمل الحملة، لكنها لا تغيّر هذا الرقم." },
        { p: "وينبهك بناء الحملة قبل التشغيل إلى ثلاث مشكلات، دون أن يمنع التشغيل:" },
        { ul: [
          "القيمة نفسها مضمَّنة ومستبعَدة؛",
          "لا توجد مسميات أو مستوى وظيفي أو إدارة، والحملة تتواصل مع أشخاص؛",
          "لا يوجد موقع، أو لا يوجد مجال أو نوع شركة أو كلمة مفتاحية أو تقنية.",
        ] },

        { h2: "أنشئ جمهورًا مخصصًا" },
        { ol: [
          "افتح **الجماهير** من الشريط الجانبي واختر **إنشاء جمهور** ثم **جمهور مخصص**.",
          "اكتب **الاسم**، مثل «عيادات حجزت اجتماعًا».",
          "اختر المصدر تحت **أنشئه من**: جهات حملة سابقة، أو عملاؤك، أو من حجزوا اجتماعًا، أو المهتمون، أو ملف (CSV). وللحملة السابقة اخترها من **اختر حملة**.",
          "اضغط **معاينة**. يعرض السطر تحتها عدد الأشخاص في المصدر، وعدد من لديهم بريد، وعدد من طلبوا عدم التواصل؛ وهؤلاء تتخطاهم الحملات.",
          "اضغط **إنشاء الجمهور**. تؤكد رسالة «أُنشئ الجمهور: {n} شخص.» الإنشاء، ويظهر الجمهور في الجدول.",
        ] },
        { p: "إذا ظهرت «لا يوجد أحد للإضافة.» فالمصدر فارغ: لا صفقات مكسوبة في «عملاؤك»، أو لا اجتماعات، أو لا ردود مهتمة، أو لم تتواصل الحملة المختارة مع أحد." },
        { h3: "من ملف CSV" },
        { ol: [
          "اختر **ملف (CSV)** تحت **أنشئه من**، ثم **اختر ملف CSV**.",
          "اكتب اسم الجمهور واختر الملف. يجب أن يحمل الصف الأول أسماء الأعمدة، والحد 5,000 صف و5 ميجابايت للملف.",
          "راجع **الاستيراد كـ** (أشخاص أو شركات أو أنشطة محلية) و**الأعمدة**. يخمّن يولياس كل عمود من عنوانه، واختر **لا تستورد** لأي عمود تريد تركه.",
          "اقرأ الملخص: عدد الصفوف الجاهزة، والصفوف التي تُخطّيت لأنها بلا اسم.",
          "اضغط **استيراد {count} صف**.",
        ] },
        { p: "الاسم هو العمود المطلوب الوحيد، والبريد والشركة والمسمى والموقع والدولة تساعد يولياس. وتظهر الصفوف المستوردة أيضًا في **العملاء** بمصدر **مستورد**، وتُحسب من جهات الاتصال المرفوعة في خطتك هذا الشهر." },

        { h2: "أنشئ جمهورًا مشابهًا" },
        { ol: [
          "في **الجماهير** اختر **إنشاء جمهور** ثم **جمهور مشابه**، واكتب اسمًا.",
          "اختر الأساس تحت **مشابه لـ**: عملاؤك، أو من حجزوا اجتماعًا، أو المهتمون، أو أحد جماهيرك المخصصة.",
          "حدد **درجة التشابه** من 1 (**الأقرب**) إلى 10 (**الأوسع**). القيمة الافتراضية 3.",
          "اضغط **تحليل**. يعرض يولياس عدد من تعلّم منهم، وشارة الثقة، وما يشترك فيه معظمهم مع نسبة كل سمة، والشركات التي سيبحث عن مشابهاتها.",
          "اضغط **إنشاء جمهور مشابه**. يبقى الزر معطلًا حتى يجد التحليل من يتعلم منه.",
        ] },
        { p: "الأقرب يُبقي السمات التي يشترك فيها معظم الأساس، فيجد شركات أقل وأكثر تشابهًا. والأوسع يُبقي سمات يشترك فيها عدد أقل، ويستخدم شركات مرجعية أكثر. ومن الدرجة 6 تُستبعد المسميات الوظيفية، ومن الدرجة 8 تُستبعد أحجام الشركات أيضًا." },
        { table: { head: ["الثقة", "حجم الأساس"], rows: [["منخفضة", "أقل من 5 أشخاص للتعلم منهم"], ["متوسطة", "من 5 إلى 19 شخصًا"], ["عالية", "20 شخصًا أو أكثر"]] } },
        { p: "المشابه ليس بالضرورة جاهزًا للشراء: يظل يولياس يقيّم كل شركة قبل الكتابة إليها." },

        { h2: "احفظ استهدافًا" },
        { p: "في **الجماهير** اختر **إنشاء جمهور** ثم **استهداف محفوظ**، وسمّه واملأ محرر الاستهداف نفسه الموجود في بناء الحملة، ثم اضغط **حفظ الاستهداف**. ومن بناء الحملة جهّز الجمهور واضغط **حفظ كجمهور**، فتظهر «حُفظ في الجماهير.»" },

        { h2: "استخدم جمهورًا في حملة" },
        { ol: [
          "افتح بناء الحملة: **إنشاء حملة**، أو **استخدامه في حملة** من قائمة الجمهور في صفحة الجماهير. تفتح القائمة حملة جديدة ولا تختار الجمهور مسبقًا.",
          "في خطوة **الجمهور** اختر **استخدام جمهور محفوظ**.",
          "اختر الجمهور من القائمة. يظهر في كل سطر نوعه، ومع الجمهور المخصص عدد أشخاصه.",
          "راجع مربع **الجمهور**: يعرض الجمهور المخصص عدد أشخاصه ومن يمكن مراسلتهم بالبريد.",
        ] },
        { p: "إذا لم تكن لديك جماهير تظهر «لا توجد جماهير محفوظة بعد.» ويأخذك **فتح الجماهير** إلى الصفحة. ولمقارنة جمهورين أضفهما إلى الحملة نفسها بزر **إضافة جمهور**، أو استخدم **نسخ** لتكرار جمهور ثم غيّر فيه." },

        { h2: "إدارة الجماهير" },
        { p: "تتيح القائمة في آخر كل سطر:" },
        { ul: [
          "**استخدامه في حملة**: يفتح بناء الحملة.",
          "**تعديل** للاستهداف المحفوظ، أو **إعادة تسمية** للمخصص والمشابه. فالجمهور المخصص والمشابه تُغيَّر أسماؤهما فقط.",
          "**تحديث** للمخصص والمشابه عدا جماهير الملفات: يُعاد بناء الجمهور المخصص من مصدره فيُضاف العملاء أو الاجتماعات الجديدة، ويتعلم الجمهور المشابه من أساسه مجددًا بدرجة التشابه نفسها.",
          "**حذف**: يطلب التأكيد أولًا، والحملات التي استخدمت الجمهور تحتفظ بأشخاصها.",
        ] },

        { h2: "أمثلة" },
        { ul: [
          "**عيادات في مدينة واحدة**: المدن الرياض؛ المجالات طب الأسنان والرعاية الصحية والعيادات؛ عدد الموظفين 1-10 و11-50؛ المسميات المالك ومدير العيادة وصاحب العيادة؛ وفي الشركات التي لا يتم التواصل معها عملاؤك الحاليون.",
          "**شركات توظّف في المبيعات**: الدول الإمارات والسعودية؛ المجالات البرمجيات وSaaS؛ تفعيل توظّف الآن؛ الإدارة المبيعات؛ المستوى مدير إدارة ورئيس قسم.",
          "**استعادة اهتمام سابق**: جمهور مخصص من المهتمين في حملة جديدة بعرض جديد.",
          "**عملاء جدد يشبهون أفضل عملائك**: جمهور مشابه لـ«عملاؤك» بدرجة 3، بعد 20 صفقة مكسوبة على الأقل.",
        ] },

        { h2: "الصلاحيات والمتطلبات" },
        { ul: [
          "المدير والمعلن ينشئان الجماهير ويحدّثانها ويعيدان تسميتها ويحذفانها. ويفتح المحلل الصفحة ويعاين، لكن الحفظ يعيد له «دورك محلل: يمكنك رؤية النتائج دون تعديلها.»",
          "الجمهور المخصص من ملف يُحسب من جهات الاتصال المرفوعة في خطتك هذا الشهر.",
          "يُقرأ حتى 5,000 شخص من المصدر الواحد.",
          "يحتاج الجمهور المشابه إلى عميل مكسوب أو اجتماع أو شخص مهتم أو عضو في جمهور مخصص واحد على الأقل في أساسه.",
        ] },

        { h2: "ملاحظات مهمة" },
        { ul: [
          "بعد تشغيل الحملة تُقفل جماهيرها الحالية: «هذه الحملة تعمل: لا يمكن تغيير استهداف جماهيرها. أضف جمهورًا جديدًا بدلًا من ذلك.»",
          "تتخطى كل الحملات من طلبوا عدم التواصل، حتى إن كانوا في جمهور مخصص.",
          "نوع الشركة والمستوى الوظيفي والإدارة للتضمين فقط، ولا يمكن استبعادها.",
        ] },

        { h2: "حل المشكلات" },
        { table: { head: ["المشكلة", "ما تفعله"], rows: [
          ["عدد المطابقين المعروفين قليل", "وسّع الموقع، أو أضف مجالات أو أحجامًا أو مسميات. حذف إشارة لا يغيّر هذا الرقم، لكنه يوسّع البحث عند عمل الحملة."],
          ["«لا يوجد أحد للإضافة.» عند إنشاء جمهور مخصص", "المصدر فارغ. اختر مصدرًا آخر، أو حملة تواصلت مع أشخاص."],
          ["ثقة الجمهور المشابه منخفضة", "الأساس صغير. اختر أساسًا أكبر أو انتظر عملاء أو اجتماعات أكثر، ثم اضغط **تحديث**."],
          ["«لا يوجد بعد من يُتعلم منه في هذا الأساس.»", "الأساس بلا أشخاص. اختر أساسًا آخر."],
          ["زر **إنشاء جمهور مشابه** معطل", "اكتب اسمًا واضغط **تحليل** أولًا."],
          ["«تعذّرت قراءة هذا الملف.» أو تُخطّيت صفوف", "استخدم ملف csv حتى 5 ميجابايت، بأسماء الأعمدة في الصف الأول واسم في كل صف."],
          ["لا يمكن تعديل جمهور في حملة تعمل", "أضف جمهورًا جديدًا إلى الحملة بدلًا من ذلك."],
        ] } },

        { h2: "مقالات ذات صلة" },
        { ul: [
          "[إنشاء حملة](/help-center/creating-a-campaign)",
          "[العمل مع العملاء](/help-center/prospects-workspace)",
          "[حملة تنتظر البدء](/help-center/awaiting-data-source)",
          "[تصدير العملاء والحملات](/help-center/exporting-prospects)",
        ] },
      ],
    },
  },

  "prospects-workspace": {
    en: {
      title: "Working with leads",
      summary: "The Companies, People and Saved tabs, what each column means, the filters, and how to act on several rows at once.",
      updated: "2026-11-05",
      blocks: [
        { p: "**Leads** holds the companies and people your campaigns found and reached, plus the ones you imported, with what came of each. Open it from the sidebar, or go to /leads. This article explains the tabs, every column, the filters, a lead's own page, and what you can do with a selection." },

        { h2: "What the Leads page is" },
        { p: "Every company or person Yolias delivers for a campaign lands here, and so does every row you import from a CSV file. Leads is where you check who a campaign reached and how far each conversation went. Contacting people happens in campaigns, through their audiences: Leads doesn't send messages. To put people from here into a campaign, build a [custom audience](/help-center/audiences) from them." },

        { h2: "How a row reaches Leads" },
        { p: "A row enters Leads in one of three ways:" },
        { ul: [
          "**From a campaign**: when the search behind a campaign's audience finds a matching company or decision maker, it is added with the source **Yolias search**, and the campaign shows in the Campaign column.",
          "**From a file**: a custom audience built from a CSV file adds its rows with the source **Imported**.",
          "**By saving**: saving a person or company from their page adds it to Leads if it wasn't there, and to Saved.",
        ] },
        { p: "A person or company is one row however many campaigns reached it. When it is in several, the Campaign column shows the first with \"+n\"." },
        { h3: "Sorting" },
        { p: "The table sorts by best match with the targeting by default. Click the Name or Company header to sort alphabetically, or **Updated** on Companies to sort by newest; click the same header again to return to the default. The **Sort** field in the filter panel does the same. In Saved, Newest sorts by when you saved the row." },

        { h2: "The tabs" },
        { table: { head: ["Tab", "What it lists"], rows: [
          ["Companies", "Companies and local businesses. This tab opens first, unless your workspace has only people."],
          ["People", "Decision makers and other people, each with their company."],
          ["Saved", "The people and companies you bookmarked, with its own **Companies** and **People** switch."],
        ] } },
        { p: "Each tab shows its count. Above the table, the campaign picker (**Any campaign** by default) limits the list to the leads of one campaign, and the tabs keep that choice when you switch between them." },

        { h2: "The columns" },
        { h3: "People" },
        { table: { head: ["Column", "What it shows"], rows: [
          ["Name", "The person's photo and name. Click the header to sort by name."],
          ["Title", "Their job title."],
          ["Company", "Their company, with its website. The company name opens the company's page."],
          ["Source", "**Yolias search** for people a campaign found, **Imported** for rows from a file."],
          ["Campaign", "The first campaign they are in, with \"+n\" for more, or **Not in a campaign**."],
          ["Status", "Where they stand (see below)."],
          ["Reach", "Three icons: **Has an email**, **LinkedIn profile** and **Has a phone number**. A lit icon means Yolias has it; the LinkedIn icon opens the profile."],
        ] } },
        { h3: "Companies" },
        { table: { head: ["Column", "What it shows"], rows: [
          ["Company", "Logo, name and website. Click the header to sort by name."],
          ["People", "How many of its people are in Leads."],
          ["Source", "Yolias search or Imported."],
          ["Campaign", "The campaigns it is in."],
          ["Status", "Where it stands."],
          ["Links", "Website and LinkedIn, when Yolias has them."],
          ["Updated", "The last change. Click the header to sort by newest."],
        ] } },
        { h3: "The Status column" },
        { p: "Status reads the conversation, not only the campaign:" },
        { ul: [
          "**Not contacted**: in Leads, not reached yet.",
          "**In a campaign** or **Contacted**: enrolled, or a message went out, with no reply yet.",
          "A stage, a reply type, or both: stages are Interested, Meeting booked, Meeting done, Proposal sent, Negotiation, Won and Lost. Reply types are Interested, Meeting Requested, Information Requested, Objection, Not Interested, Unsubscribed, Out of Office, Wants a Person and Other.",
          "**Do not contact** in red: the person asked not to be contacted. No campaign writes to them again.",
        ] },
        { p: "A second line can show what comes next: **Action required**, **Next follow-up** with a date, **Waiting on them** or **Follow-ups exhausted**." },

        { h2: "Find what you need" },
        { ol: [
          "Open **Leads** and pick **Companies**, **People** or **Saved**.",
          "Type in the search box (**Search companies…** or **Search people…**) and press Enter. The search reads names, titles, company names, industries, descriptions, websites and signals.",
          "Press **Filter** to open the filter panel, set the fields you need, and press **Apply**. The button then shows how many filters are on, for example **Filter (2)**. **Clear** removes them; **Close filters** closes the panel without applying.",
          "Pick a campaign in the campaign picker, if you want one campaign's leads.",
        ] },
        { p: "The panel title shows the number of matching rows, for example \"128 companies\". When nothing matches, the table reads \"Nothing matches these filters.\"" },
        { note: "Pressing Enter in the search or **Apply** in the filter panel resets the campaign picker to **Any campaign**. Set the search and filters first, then pick the campaign." },
        { h3: "The filters" },
        { table: { head: ["Filter", "What it keeps"], rows: [
          ["Job titles", "Titles containing any of the words you type, separated by commas (up to 10). On Companies, companies with a person holding that title."],
          ["Location", "One country, from the countries in your Leads."],
          ["City", "A city. Arabic and English names match each other, so «القاهرة» also finds Cairo."],
          ["Industry", "Industries containing the word you type."],
          ["Employees", "One size band: 1-10, 11-50, 51-200, 201-1000, 1001-5000, 5000+."],
          ["Domain / Company name", "Websites or company names containing what you type."],
          ["Signals", "Rows whose signals mention the word, for example \"expansion\"."],
          ["Funding type", "Shown only when your leads have funding data."],
          ["Min. ICP match", "70%+, 80%+ or 90%+ match with the targeting."],
          ["Job listings", "Hiring now (open roles found)."],
          ["Sort", "Best match (default), Newest or Name."],
          ["Saved only / Verified email only", "Bookmarked rows, or people with a verified email."],
        ] } },

        { h2: "Open a lead" },
        { p: "Click a row, or choose **Open** in the row menu. Every view and filter lives in the page address, so you can reload it or share the link with a teammate." },
        { h3: "A person's page" },
        { ul: [
          "The header shows the name, title, company and place, three badges, **Open LinkedIn** when there is a profile, and the bookmark to save the person.",
          "**Fit** is how well the person matches the targeting. **Interest** comes from their replies: none, a reply, or an interested reply or meeting request. **Lead score** weighs both: fit 40%, company signals 20% (hiring, funding, technologies), complete data 10% (email, title, LinkedIn, phone) and engagement 30%. Email opens never count.",
          "**Overview** lists title, location, email, phone, LinkedIn, Facebook and Instagram. A verified email shows a check mark. A missing value reads \"Not provided by the source\".",
          "The company card links to the company's page and shows **From search** with the search that found the person.",
          "**Messages** lists every email sent to the person, with when it was last opened.",
          "**Data intelligence** shows the ICP match, why it matches, missing data, and when each field was last updated.",
        ] },
        { h3: "A company's page" },
        { ul: [
          "**Visit website**, **Open LinkedIn** and the bookmark sit in the header.",
          "**Company brief** and **Company information**: industry or category, location, website, phone, size, founding year, email and social links.",
          "**Decision makers** lists the people Yolias found at the company, with their count.",
        ] },

        { h2: "Collect a company's decision makers" },
        { ol: [
          "Open the company's page from the **Companies** tab.",
          "In **Decision makers**, if it reads **Not collected yet**, press **Collect decision makers**.",
          "The button changes to **Collecting…** and the status beside the heading moves through **Queued** and **Searching…**.",
          "When it finishes, the status reads \"{count} found\" and the people appear on the page and in the **People** tab.",
        ] },
        { p: "If the status reads **No people source connected yet**, **Leads used up** or **Couldn’t search**, nothing was collected. The button stays available, so you can press it again once the cause is gone." },

        { h2: "Save and remove" },
        { ul: [
          "**Save**: press the bookmark on a person's or company's page. The row appears in **Saved**, and in Leads if it wasn't there.",
          "**Remove from Leads**: select rows and press the trash icon in the selection bar, or choose **Remove** in a row's menu. A message such as \"3 removed from Leads.\" confirms it. The rows stay in the results of the search that found them, and **Save to Leads** on that search brings them back.",
          "**Remove from Saved**: in the Saved tab, the selection bar offers this instead. The rows stay in Leads.",
        ] },

        { h2: "Act on several rows" },
        { ol: [
          "Tick the checkbox at the start of each row you want, or the one in the header to select every row on the page.",
          "The selection bar shows \"{count} selected\" with its actions: export (the download icon), remove, and on the Companies, Local and All tabs **Find decision makers** (the people icon).",
          "When every row on the page is ticked and more rows match, the bar offers **Select all {count} matching**. The actions then cover every matching row on every page, not only the 50 you see.",
          "Press **Clear selection** (the X) to start over.",
        ] },
        { p: "The table shows 50 rows per page, with **Previous** and **Next** below it. A selection covers the current page and clears when you move to another page; **Select all {count} matching** extends it to every matching row. **Export CSV** from the **More** menu also takes all rows of the current view. See [Exporting leads and campaigns](/help-center/exporting-prospects)." },

        { h2: "Examples" },
        { ul: [
          "**Who replied with interest this week**: People tab, pick the campaign, sort by Newest, then read the Status column for Interested or Meeting Requested.",
          "**Clinics in Jeddah with a verified owner email**: People tab, Filter: City Jeddah, Industry \"Dental\", Job titles \"Owner, Clinic Manager\", Verified email only.",
          "**Companies without people yet**: Companies tab, look for a People count of 0, open each one and press **Collect decision makers**.",
        ] },

        { h2: "Permissions and requirements" },
        { ul: [
          "Every role can open Leads, filter, open pages and export.",
          "Saving, removing and collecting decision makers need the Admin or Advertiser role. For an Analyst these actions do nothing.",
          "Business emails and phones show once Yolias delivers the person. Viewing them again uses no leads.",
        ] },

        { h2: "Important notes" },
        { ul: [
          "Yolias shows only contact details it found published or could verify. An invalid email is never shown.",
          "Leads and Conversations show the same people. A conversation's stage and reply type appear in the Status column here.",
          "Companies and local businesses share the Companies tab.",
        ] },

        { h2: "Troubleshooting" },
        { table: { head: ["Problem", "What to do"], rows: [
          ["I can't find someone", "Press **Clear**, set the campaign picker to **Any campaign**, and check **Saved** and the other tab. A removed row is only in its search's results."],
          ["The People tab is empty but Companies isn't", "The message tells you how many companies your searches found. Open a company and press **Collect decision makers**."],
          ["A person has no email", "The source didn't publish one, or it failed verification. The Reach icon stays grey."],
          ["My campaign filter disappeared", "Applying a search or filters resets it. Pick the campaign again last."],
          ["Remove or Save does nothing", "Your role is Analyst. Ask an Admin to change your role."],
          ["The decision makers status reads No people source connected yet", "No people source is available right now. Press the button again later; the request is kept."],
        ] } },

        { h2: "Related articles" },
        { ul: [
          "[Exporting leads and campaigns](/help-center/exporting-prospects)",
          "[Audiences](/help-center/audiences)",
          "[Conversations](/help-center/conversations)",
        ] },
      ],
    },
    ar: {
      title: "العمل مع العملاء",
      summary: "تبويبات الشركات والأشخاص والمحفوظات، ومعنى كل عمود، والفلاتر، وكيف تتعامل مع عدة صفوف معًا.",
      updated: "2026-11-05",
      blocks: [
        { p: "تجمع صفحة **العملاء** الشركات والأشخاص الذين وجدتهم حملاتك وتواصلت معهم، ومن استوردتهم بنفسك، مع ما نتج عن كل منهم. افتحها من الشريط الجانبي أو من الرابط /leads. يشرح هذا المقال التبويبات، وكل عمود، والفلاتر، وصفحة كل عميل، وما تفعله بعدة صفوف محددة." },

        { h2: "ما هي صفحة العملاء" },
        { p: "كل شركة أو شخص يسلّمه يولياس لحملة يصل إلى هنا، وكذلك كل صف تستورده من ملف CSV. وفي هذه الصفحة تعرف من وصلت إليه الحملة وإلى أين وصلت كل محادثة. أما التواصل فيتم في الحملات عبر جماهيرها، فصفحة العملاء لا ترسل رسائل. ولإدخال أشخاص من هنا في حملة أنشئ منهم [جمهورًا مخصصًا](/help-center/audiences)." },

        { h2: "كيف يصل الصف إلى العملاء" },
        { p: "يدخل الصف إلى العملاء بإحدى ثلاث طرق:" },
        { ul: [
          "**من حملة**: عندما يجد البحث الذي يعمل خلف جمهور الحملة شركة أو صاحب قرار مطابقًا، يُضاف إلى العملاء بمصدر **بحث يولياس**، ويظهر اسم الحملة في عمود الحملة.",
          "**من ملف**: الجمهور المخصص المنشأ من ملف CSV يضيف صفوفه إلى العملاء بمصدر **مستورد**.",
          "**بالحفظ**: حفظ شخص أو شركة من صفحته يضيفه إلى العملاء إن لم يكن فيها، ويضعه في المحفوظات.",
        ] },
        { p: "والشخص أو الشركة صف واحد مهما تعددت الحملات التي وصلت إليه، فلا يتكرر في الجدول. وإذا كان في أكثر من حملة تظهر الأولى في عمود الحملة ومعها «+n». وتتخطى الحملات تلقائيًا من تواصلت معه حملة سابقة أو من طلب عدم التواصل، فوجوده في العملاء لا يعني أنه سيتلقى رسالة جديدة." },
        { h3: "الترتيب" },
        { p: "يرتب الجدول افتراضيًا بالأعلى تطابقًا مع الاستهداف. واضغط عنوان عمود الاسم أو الشركة للترتيب أبجديًا، أو عنوان **آخر تحديث** في الشركات للترتيب بالأحدث، واضغط العنوان نفسه مرة أخرى للعودة إلى الترتيب الافتراضي. ويمكنك اختيار الترتيب أيضًا من حقل **الترتيب** داخل لوحة الفلاتر. وفي تبويب المحفوظات يرتب «الأحدث» حسب وقت الحفظ." },

        { h2: "التبويبات" },
        { table: { head: ["التبويب", "ما يعرضه"], rows: [
          ["الشركات", "الشركات والأنشطة المحلية. يفتح هذا التبويب أولًا، إلا إذا لم يكن في مساحة العمل غير أشخاص."],
          ["الأشخاص", "أصحاب القرار وغيرهم، ومع كل منهم شركته."],
          ["المحفوظات", "الأشخاص والشركات الذين حفظتهم، وفيه مفتاح خاص بين **الشركات** و**الأشخاص**."],
        ] } },
        { p: "يظهر مع كل تبويب عدده. وفوق الجدول تحصر قائمة الحملات (**كل الحملات** افتراضيًا) العرض في عملاء حملة واحدة، وتحتفظ التبويبات بهذا الاختيار عند التنقل بينها." },

        { h2: "الأعمدة" },
        { h3: "الأشخاص" },
        { table: { head: ["العمود", "ما يعرضه"], rows: [
          ["الاسم", "صورة الشخص واسمه. اضغط العنوان للترتيب بالاسم."],
          ["المسمى", "مسماه الوظيفي."],
          ["الشركة", "شركته وموقعها، واسم الشركة يفتح صفحتها."],
          ["المصدر", "**بحث يولياس** لمن وجدتهم الحملة، و**مستورد** لصفوف الملفات."],
          ["الحملة", "أول حملة هو فيها، مع «+n» إن كان في غيرها، أو **ليس في حملة**."],
          ["الحالة", "أين وصل (انظر أدناه)."],
          ["التواصل", "ثلاث أيقونات: **لديه بريد**، و**حساب LinkedIn**، و**لديه رقم هاتف**. الأيقونة المضيئة تعني أن يولياس يملكه، وأيقونة LinkedIn تفتح الحساب."],
        ] } },
        { h3: "الشركات" },
        { table: { head: ["العمود", "ما يعرضه"], rows: [
          ["الشركة", "الشعار والاسم والموقع. اضغط العنوان للترتيب بالاسم."],
          ["الأشخاص", "عدد أشخاصها الموجودين في العملاء."],
          ["المصدر", "بحث يولياس أو مستورد."],
          ["الحملة", "الحملات التي هي فيها."],
          ["الحالة", "أين وصلت."],
          ["الروابط", "الموقع وLinkedIn إذا كانا لدى يولياس."],
          ["آخر تحديث", "آخر تغيير. اضغط العنوان للترتيب بالأحدث."],
        ] } },
        { h3: "عمود الحالة" },
        { p: "يقرأ عمود الحالة المحادثة لا الحملة فقط:" },
        { ul: [
          "**لم يُتواصل معه**: موجود في العملاء ولم تصله رسالة بعد.",
          "**في حملة** أو **تم التواصل**: مسجّل في حملة أو أُرسلت له رسالة، ولا رد بعد.",
          "مرحلة أو نوع رد أو كلاهما. المراحل: مهتم، وتم حجز اجتماع، وتم الاجتماع، وتم إرسال العرض، وتفاوض، وكسبنا، وخسرنا. وأنواع الردود: مهتم، وطلب اجتماع، وطلب معلومات، واعتراض، وغير مهتم، وألغى الاشتراك، وخارج المكتب، ويريد شخصًا، وأخرى.",
          "**عدم التواصل** بالأحمر: طلب الشخص عدم التواصل معه، فلا تكتب له أي حملة مجددًا.",
        ] },
        { p: "وقد يظهر سطر ثانٍ بما يلي: **يحتاج إجراء**، أو **المتابعة التالية** مع تاريخها، أو **في انتظارهم**، أو **انتهت المتابعات**." },

        { h2: "جد ما تحتاجه" },
        { ol: [
          "افتح **العملاء** واختر **الشركات** أو **الأشخاص** أو **المحفوظات**.",
          "اكتب في خانة البحث (**ابحث في الشركات…** أو **ابحث في الأشخاص…**) واضغط Enter. يبحث في الأسماء والمسميات وأسماء الشركات والمجالات والأوصاف والمواقع والإشارات.",
          "اضغط **تصفية** لفتح لوحة الفلاتر، واضبط ما تحتاجه، ثم اضغط **تطبيق**. يعرض الزر بعدها عدد الفلاتر المفعّلة، مثل **تصفية (2)**. ويزيلها زر **مسح**، ويغلق **إغلاق الفلاتر** اللوحة دون تطبيق.",
          "اختر حملة من قائمة الحملات إذا أردت عملاء حملة واحدة.",
        ] },
        { p: "يظهر في عنوان اللوحة عدد الصفوف المطابقة، مثل «128 شركة». وإذا لم يطابق شيء يظهر في الجدول «لا توجد نتائج مطابقة لهذه الفلاتر.»" },
        { note: "الضغط على Enter في البحث أو على **تطبيق** في لوحة الفلاتر يعيد قائمة الحملات إلى **كل الحملات**. اضبط البحث والفلاتر أولًا، ثم اختر الحملة." },
        { h3: "الفلاتر" },
        { table: { head: ["الفلتر", "ما يُبقيه"], rows: [
          ["المسميات الوظيفية", "المسميات التي تحتوي أيًا من الكلمات التي تكتبها، مفصولة بفواصل (حتى 10). وفي الشركات: الشركات التي فيها شخص بهذا المسمى."],
          ["الموقع", "دولة واحدة من الدول الموجودة في عملائك."],
          ["المدينة", "مدينة، والاسم العربي يطابق الإنجليزي، فكتابة «القاهرة» تأتي بـ Cairo أيضًا."],
          ["المجال", "المجالات التي تحتوي الكلمة."],
          ["عدد الموظفين", "شريحة واحدة: 1-10، أو 11-50، أو 51-200، أو 201-1000، أو 1001-5000، أو 5000+."],
          ["النطاق / اسم الشركة", "المواقع أو أسماء الشركات التي تحتوي ما تكتبه."],
          ["الإشارات", "الصفوف التي تذكر إشاراتها الكلمة، مثل «توسع»."],
          ["نوع التمويل", "يظهر فقط إذا كانت لدى عملائك بيانات تمويل."],
          ["أدنى تطابق ICP", "تطابق مع الاستهداف بنسبة 70% أو 80% أو 90% فأكثر."],
          ["إعلانات الوظائف", "تقوم بالتوظيف الآن (وظائف مفتوحة)."],
          ["الترتيب", "الأعلى تطابقًا (افتراضي)، أو الأحدث، أو الاسم."],
          ["المحفوظ فقط / البريد الموثّق فقط", "الصفوف المحفوظة، أو الأشخاص ذوو البريد الموثّق."],
        ] } },

        { h2: "افتح صفحة عميل" },
        { p: "اضغط على الصف، أو اختر **فتح** من قائمته. وكل عرض وفلتر محفوظ في عنوان الصفحة، فتستطيع إعادة تحميلها أو مشاركة الرابط مع زميل." },
        { h3: "صفحة الشخص" },
        { ul: [
          "يعرض أعلى الصفحة الاسم والمسمى والشركة والمكان، وثلاث شارات، وزر **فتح LinkedIn** إذا وُجد حساب، وعلامة الحفظ.",
          "**التطابق** مدى مطابقة الشخص للاستهداف. و**الاهتمام** يأتي من ردوده: لا رد، أو رد، أو رد مهتم أو طلب اجتماع. و**درجة العميل** تجمع الاثنين: التطابق 40%، وإشارات الشركة 20% (التوظيف والتمويل والتقنيات)، واكتمال البيانات 10% (البريد والمسمى وLinkedIn والهاتف)، والتفاعل 30%. ولا يُحسب فتح الرسائل أبدًا.",
          "تعرض **نظرة عامة** المسمى والموقع والبريد والهاتف وLinkedIn وفيسبوك وإنستجرام. ويظهر بجانب البريد الموثّق علامة صح، والقيمة الناقصة تظهر «لم يوفره المصدر».",
          "تربط بطاقة الشركة بصفحتها، وتعرض **من البحث** مع اسم البحث الذي وجد الشخص.",
          "تعرض **الرسائل** كل بريد أُرسل للشخص ووقت آخر فتح له.",
          "يعرض قسم **معلومات البيانات** تطابق ICP وسبب التطابق والبيانات الناقصة وآخر تحديث لكل حقل.",
        ] },
        { h3: "صفحة الشركة" },
        { ul: [
          "في الأعلى **زيارة الموقع** و**فتح LinkedIn** وعلامة الحفظ.",
          "**نبذة عن الشركة** و**معلومات الشركة**: المجال أو الفئة، والموقع، والموقع الإلكتروني، والهاتف، والحجم، وسنة التأسيس، والبريد، وروابط التواصل الاجتماعي.",
          "يعرض قسم **صنّاع القرار** الأشخاص الذين وجدهم يولياس في الشركة مع عددهم.",
        ] },

        { h2: "اجمع صنّاع القرار في شركة" },
        { ol: [
          "افتح صفحة الشركة من تبويب **الشركات**.",
          "إذا ظهر في قسم **صنّاع القرار** «لم يتم الجمع بعد» فاضغط **جمع صنّاع القرار**.",
          "يتحول الزر إلى **جارٍ الجمع…**، وتتغير الحالة بجانب العنوان إلى **في الانتظار** ثم **جارٍ البحث…**.",
          "عند الانتهاء تظهر «تم العثور على {count}»، ويظهر الأشخاص في الصفحة وفي تبويب **الأشخاص**.",
        ] },
        { p: "إذا ظهرت الحالة **لم يتم ربط مصدر للأشخاص بعد** أو **نفد رصيد العملاء** أو **تعذّر البحث** فلم يُجمع أحد. ويبقى الزر متاحًا لتضغطه مجددًا بعد زوال السبب." },

        { h2: "الحفظ والإزالة" },
        { ul: [
          "**الحفظ**: اضغط علامة الحفظ في صفحة الشخص أو الشركة، فيظهر في **المحفوظات**، ويُضاف إلى العملاء إن لم يكن فيها.",
          "**الإزالة من العملاء**: حدد الصفوف واضغط أيقونة سلة المهملات في شريط التحديد، أو اختر **إزالة** من قائمة الصف. تؤكد رسالة مثل «تمت إزالة 3 من العملاء» العملية. وتبقى الصفوف في نتائج البحث الذي وجدها، ويعيدها زر **حفظ في العملاء** في ذلك البحث.",
          "**الإزالة من المحفوظات**: يظهر هذا الخيار في شريط التحديد داخل تبويب المحفوظات، وتبقى الصفوف في العملاء.",
        ] },

        { h2: "تعامل مع عدة صفوف" },
        { ol: [
          "ضع علامة في المربع أول كل صف تريده، أو في مربع العنوان لتحديد كل صفوف الصفحة.",
          "يعرض شريط التحديد «تم تحديد {count}» مع إجراءاته: التصدير (أيقونة التنزيل)، والإزالة، و**إيجاد صناع القرار** (أيقونة الأشخاص) في تبويبات الشركات والأنشطة المحلية والكل.",
          "إذا حددت كل صفوف الصفحة وكانت هناك صفوف مطابقة أخرى، يعرض الشريط **تحديد كل الـ{count} المطابقة**، فتشمل الإجراءات كل الصفوف المطابقة في كل الصفحات لا الخمسين الظاهرة فقط.",
          "اضغط **إلغاء التحديد** (علامة X) لتبدأ من جديد.",
        ] },
        { p: "يعرض الجدول 50 صفًا في الصفحة، وتحته **السابق** و**التالي**. والتحديد يشمل الصفحة الحالية ويُلغى عند الانتقال إلى صفحة أخرى، و**تحديد كل الـ{count} المطابقة** يمدّه إلى كل الصفوف المطابقة. ويأخذ **تصدير CSV** من قائمة **المزيد** أيضًا كل صفوف العرض الحالي. راجع [تصدير العملاء والحملات](/help-center/exporting-prospects)." },

        { h2: "أمثلة" },
        { ul: [
          "**من ردّ باهتمام هذا الأسبوع**: تبويب الأشخاص، اختر الحملة، رتّب بالأحدث، ثم اقرأ عمود الحالة بحثًا عن «مهتم» أو «طلب اجتماع».",
          "**عيادات في جدة لأصحابها بريد موثّق**: تبويب الأشخاص، ثم تصفية: المدينة جدة، والمجال «أسنان»، والمسميات «المالك، مدير العيادة»، والبريد الموثّق فقط.",
          "**شركات بلا أشخاص بعد**: تبويب الشركات، ابحث عن عدد أشخاص 0، وافتح كل شركة واضغط **جمع صنّاع القرار**.",
        ] },

        { h2: "الصلاحيات والمتطلبات" },
        { ul: [
          "كل الأدوار تفتح العملاء وتصفّي وتفتح الصفحات وتصدّر.",
          "الحفظ والإزالة وجمع صنّاع القرار تحتاج دور مدير أو معلن، ولا تفعل شيئًا مع المحلل.",
          "يظهر البريد والهاتف بمجرد أن يسلّم يولياس الشخص، وعرضهما مرة أخرى لا يستهلك من رصيد العملاء.",
        ] },

        { h2: "ملاحظات مهمة" },
        { ul: [
          "يعرض يولياس فقط بيانات التواصل المنشورة أو التي تحقق منها، ولا يعرض بريدًا غير صالح أبدًا.",
          "العملاء والمحادثات يعرضان الأشخاص أنفسهم، ومرحلة المحادثة ونوع الرد يظهران هنا في عمود الحالة.",
          "الشركات والأنشطة المحلية في تبويب الشركات نفسه.",
        ] },

        { h2: "حل المشكلات" },
        { table: { head: ["المشكلة", "ما تفعله"], rows: [
          ["لا أجد شخصًا", "اضغط **مسح**، واجعل قائمة الحملات **كل الحملات**، وراجع **المحفوظات** والتبويب الآخر. والصف المُزال موجود فقط في نتائج بحثه."],
          ["تبويب الأشخاص فارغ والشركات لا", "تخبرك الرسالة بعدد الشركات التي وجدتها عمليات البحث. افتح شركة واضغط **جمع صنّاع القرار**."],
          ["شخص بلا بريد", "لم ينشره المصدر أو فشل التحقق منه، فتبقى أيقونة البريد رمادية."],
          ["اختفى اختيار الحملة", "تطبيق البحث أو الفلاتر يعيده إلى كل الحملات. اختر الحملة في النهاية."],
          ["الإزالة أو الحفظ لا يعملان", "دورك محلل. اطلب من المدير تغيير دورك."],
          ["حالة صنّاع القرار «لم يتم ربط مصدر للأشخاص بعد»", "لا يتوفر مصدر للأشخاص الآن. اضغط الزر لاحقًا، والطلب محفوظ."],
        ] } },

        { h2: "مقالات ذات صلة" },
        { ul: [
          "[تصدير العملاء والحملات](/help-center/exporting-prospects)",
          "[الجماهير](/help-center/audiences)",
          "[المحادثات](/help-center/conversations)",
        ] },
      ],
    },
  },

  "exporting-prospects": {
    en: {
      title: "Exporting leads and campaigns",
      summary: "Download your leads as a CSV file, and your campaign numbers as CSV or Excel, with exactly what each file contains.",
      updated: "2026-11-05",
      blocks: [
        { p: "You can download what you see in **Leads** and on the **Campaigns** page. Leads export as CSV. Campaign numbers export as CSV or as an Excel file (.xlsx). Files open in Excel, Numbers or Google Sheets, and column headers follow the language of your interface." },

        { h2: "What you can export" },
        { table: { head: ["From", "What you get", "Format"], rows: [
          ["Leads, **More** menu, **Export CSV**", "Every row of the current view: the tab, search, filters, campaign and sort you set", "CSV"],
          ["Leads, selection bar, the download icon", "The rows you ticked on the current page, or every matching row after **Select all {count} matching**", "CSV"],
          ["A company's page, **Decision makers**", "The decision makers you select on that page", "CSV"],
          ["Campaigns, **Export**", "The current table (Campaigns, Audiences or Messages) with the columns and dates shown", "CSV or .xlsx"],
        ] } },

        { h2: "How the leads export works" },
        { p: "The export reads the same view as the table. Whatever narrows the table narrows the file: the tab, the search box, every filter in the filter panel, the campaign picker and the sort order. The rows come out in the order the table shows them." },
        { p: "Each tab has its own columns:" },
        { table: { head: ["Tab", "Columns in the file"], rows: [
          ["People", "Name, Title, Company, Employees, City, Country, Search, Email, Email status, Phone, LinkedIn, Facebook, Instagram, ICP match %, Last updated, Missing data"],
          ["Companies", "Name, Website, Industry, Employees, City, Country, Email, Phone, LinkedIn, Facebook, Instagram, Search, ICP match %, Last updated, Missing data"],
          ["Saved", "Type (Person, Company or Local business), Name, Title, Company, City, Country, Email, Phone, Website, LinkedIn, Facebook, Instagram, Search, ICP match %, Last updated, Missing data"],
        ] } },
        { ul: [
          "**Search** holds the name of the search that found the row, not the campaign name.",
          "For a local business, **Industry** holds its category.",
          "**Email status** says whether the email was verified. An email that failed verification is left empty.",
          "**Missing data** lists the fields the source didn't provide, separated by semicolons.",
          "Exporting from **Saved** takes every saved person and company, whichever of the Companies or People switch is on. The **Type** column tells them apart.",
        ] },
        { p: "**ICP match %** is how well the row matches the targeting of the search that found it, from 0 to 100, the same value the **Min. ICP match** filter uses. **Last updated** is when Yolias last refreshed the row's data. Before you send the file to anyone, delete the columns they don't need: a people file holds emails, phones and social links." },
        { p: "The file is named after the tab and the date, for example yolias-people-2026-11-05.csv." },

        { h2: "Export your leads" },
        { ol: [
          "Open **Leads** and pick the tab: **Companies**, **People** or **Saved**.",
          "Narrow the view: search, open **Filter** and press **Apply**, and pick the campaign last (applying filters resets the campaign picker).",
          "Check the count under the panel title, for example \"240 people\". That is how many rows the file will hold, up to 10,000.",
          "Open the **More** menu (the three dots beside **Filter**) and choose **Export CSV**.",
          "The file downloads through your browser. Open it from your downloads folder.",
        ] },
        { p: "If nothing downloads, check that your browser doesn't block downloads from Yolias, then try again. An empty view gives a file with the header row only." },

        { h2: "Export selected rows" },
        { ol: [
          "In **Leads**, tick the rows you want. The checkbox in the header selects every row on the page.",
          "In the selection bar (\"{count} selected\"), press the download icon (**Export CSV**).",
          "The file holds only the selected rows, with the columns of the current tab.",
        ] },
        { p: "A selection covers the current page, up to 50 rows, and clears when you move to another page. To export every matching row, tick the header checkbox, press **Select all {count} matching** in the bar, then the download icon, or use **Export CSV** from the **More** menu." },
        { h3: "Decision makers of one company" },
        { p: "Open a company's page. In **Decision makers**, tick people or **Select all**, then press **Export CSV** in the bar that appears. The file uses the People columns." },

        { h2: "Export campaign numbers" },
        { ol: [
          "Open **Campaigns**.",
          "Pick the table: **Campaigns**, **Audiences** or **Messages**.",
          "Set the dates (for example **Last 30 days**, **This month** or **Custom range**), the **Filters**, and the **Columns** you want, in the order you want.",
          "Press **Export**, then **Export as .csv** or **Export as .xlsx**.",
          "The file downloads as yolias-campaigns-2026-11-05.xlsx, or with audiences or messages in the name.",
        ] },
        { p: "The file has the name, then the status (on Campaigns) or the campaign (on Audiences and Messages), then every visible column in the order shown. It holds every row the table shows with your filters." },
        { h3: "What each table holds" },
        { ul: [
          "**Campaigns**: one row per campaign, with its status.",
          "**Audiences**: one row per audience, with the campaign it belongs to. Use it to compare audiences of the same campaign.",
          "**Messages**: one row per message opening, with its campaign.",
        ] },
        { p: "Hidden columns are not exported. Open **Columns** first and turn on everything the file should hold." },
        { table: { head: ["Format", "How values are written"], rows: [
          [".csv", "As the table shows them: formatted numbers, currency and percentages as text."],
          [".xlsx", "Numbers stay numbers, so you can add, sort and chart them. Percentages become numbers, so 12.5% is written as 12.5. Money and other values are rounded to two decimals."],
        ] } },

        { h2: "Which export to use" },
        { table: { head: ["You want", "Use"], rows: [
          ["Every lead of one campaign", "Leads, pick the campaign, **More**, **Export CSV**"],
          ["A handful of specific people", "Tick them in Leads, then the download icon in the selection bar"],
          ["The people at one company", "The company's page, **Decision makers**, **Select all**, **Export CSV**"],
          ["Everything you bookmarked", "The **Saved** tab, **More**, **Export CSV**"],
          ["Results per campaign for a report", "Campaigns, **Campaigns** table, **Export as .xlsx**"],
          ["Which audience performs best", "Campaigns, **Audiences** table, with the columns you compare"],
          ["Which email openings get replies", "Campaigns, **Messages** table"],
        ] } },

        { h2: "Bring an exported list back as an audience" },
        { p: "A leads file can become a custom audience, for example after you cleaned it or removed people in a spreadsheet. Yolias recognizes most of the exported headers by itself." },
        { ol: [
          "Export the leads you want, open the file, and delete the rows you don't want. Keep the header row.",
          "Save it as CSV (comma or semicolon separated, UTF-8).",
          "Open **Audiences**, choose **Create audience**, **Custom audience**, then **A file (CSV)** and **Choose a CSV file**.",
          "Name the audience and pick the file. Check that **Import as** reads People or Companies, as in your file.",
          "Under **Columns**, check that Name, Title, Company, Email, Phone, Website, City and Employees point to the right headers. Set any other column to **Don’t import**.",
          "Press **Import {count} rows**. The audience appears with its number of people, ready for **Use a saved audience** in a campaign.",
        ] },
        { p: "The file can hold up to 5,000 rows and 5 MB. Imported rows count toward your plan's uploaded contacts for the month, and people who asked not to be contacted are still skipped by every campaign." },

        { h2: "Opening the file" },
        { ul: [
          "**Excel**: double-click the file. Both CSV files carry a UTF-8 marker, so Arabic names open correctly in current Excel versions.",
          "**Google Sheets**: File, Import, Upload, then choose the file.",
          "**Numbers**: open the file directly.",
        ] },
        { p: "If Arabic shows as symbols in an older Excel version, import the file instead of opening it: open a blank sheet, choose **Data**, then **From Text/CSV**, pick the file, set the origin to **UTF-8** and the delimiter to **Comma**, then **Load**." },
        { p: "A value that starts with =, +, - or @ is written with an apostrophe in front, so a spreadsheet never runs it as a formula. Phone numbers such as +966 5x keep their plus sign." },

        { h2: "Examples" },
        { ul: [
          "**Send your sales team this month's interested leads**: People tab, pick the campaign, sort by Newest, then **Export CSV**. Filter the Status in the spreadsheet.",
          "**Every company with a verified decision maker email in one city**: People tab, Filter: City and Verified email only, then **Export CSV**.",
          "**A monthly report**: Campaigns, **This month**, the Columns you report on, then **Export as .xlsx** to chart the numbers.",
          "**Compare two audiences in one campaign**: Campaigns, **Audiences** table, filter by the campaign, show replies, meetings and cost per meeting, then **Export as .xlsx**.",
        ] },
        { p: "Export when someone needs the list outside Yolias. To reach the same people with a campaign, you don't need a file: build a custom audience from a source inside Yolias, such as Interested people, which stays linked to its source and can be refreshed." },

        { h2: "Permissions and requirements" },
        { ul: [
          "Every role can export, including Analysts.",
          "One leads file holds up to 10,000 rows. A selection holds the 50 rows of a page, or every matching row with **Select all {count} matching**.",
          "Each leads export is recorded in the workspace's user activity, with the tab and the number of rows.",
          "Exporting uses no leads and changes nothing in Leads or campaigns. The file is a copy of the data at the moment you download it.",
        ] },

        { h2: "Important notes" },
        { ul: [
          "The leads file has no Status column. To share where each lead stands, filter Leads by the campaign first, then add the status from the table by hand.",
          "Campaign exports contain the numbers only, not the people. Export people from Leads.",
          "Exported files leave Yolias. Keep them as you would any list of business contacts.",
        ] },

        { h2: "Troubleshooting" },
        { table: { head: ["Problem", "What to do"], rows: [
          ["Arabic shows as symbols", "In Excel, use Data, From Text/CSV and pick UTF-8. For campaign numbers, use **Export as .xlsx**."],
          ["The file has fewer rows than expected", "Check the tab, search, filters and campaign picker. More than 10,000 matching rows are cut at 10,000; split them with filters."],
          ["Some emails are empty", "They failed verification, or the source didn't publish one."],
          ["My campaign filter wasn't applied", "Applying a search or filters resets it. Pick the campaign last, then export."],
          ["The Excel option is missing in Leads", "Leads export as CSV only. Excel and Sheets open CSV files directly."],
          ["Only some rows downloaded after I selected all", "The header checkbox selects the current page. Press **Select all {count} matching** in the bar before exporting, or use **Export CSV** from the **More** menu."],
          ["A campaign column is missing from the file", "Turn it on in **Columns** and export again. The file takes visible columns only."],
          ["The Saved export mixes people and companies", "That is by design. Filter the **Type** column in your spreadsheet to separate them."],
        ] } },

        { h2: "Related articles" },
        { ul: [
          "[Working with leads](/help-center/prospects-workspace)",
          "[Reading campaign results](/help-center/campaign-results)",
          "[Audiences](/help-center/audiences)",
        ] },
      ],
    },
    ar: {
      title: "تصدير العملاء والحملات",
      summary: "نزّل عملاءك كملف CSV، وأرقام حملاتك كملف CSV أو Excel، مع ما يحتويه كل ملف بالضبط.",
      updated: "2026-11-05",
      blocks: [
        { p: "تستطيع تنزيل ما تراه في **العملاء** وفي صفحة **الحملات**. يُصدَّر العملاء بصيغة CSV، وأرقام الحملات بصيغة CSV أو ملف Excel ‏(.xlsx). وتفتح الملفات في Excel أو Numbers أو Google Sheets، وتتبع عناوين الأعمدة لغة واجهتك." },

        { h2: "ما الذي يمكنك تصديره" },
        { table: { head: ["من", "ما تحصل عليه", "الصيغة"], rows: [
          ["العملاء، قائمة **المزيد**، **تصدير CSV**", "كل صفوف العرض الحالي: التبويب والبحث والفلاتر والحملة والترتيب", "CSV"],
          ["العملاء، شريط التحديد، أيقونة التنزيل", "الصفوف التي حددتها في الصفحة الحالية، أو كل الصفوف المطابقة بعد **تحديد كل الـ{count} المطابقة**", "CSV"],
          ["صفحة شركة، قسم **صنّاع القرار**", "صنّاع القرار الذين تحددهم في الصفحة", "CSV"],
          ["الحملات، **تصدير**", "الجدول الحالي (الحملات أو الجماهير أو الرسائل) بأعمدته وتواريخه الظاهرة", "CSV أو xlsx."],
        ] } },

        { h2: "كيف يعمل تصدير العملاء" },
        { p: "يقرأ التصدير العرض نفسه الذي يعرضه الجدول، فكل ما يضيّق الجدول يضيّق الملف: التبويب، وخانة البحث، وكل فلتر في لوحة الفلاتر، وقائمة الحملات، والترتيب. وتخرج الصفوف بترتيب الجدول نفسه." },
        { p: "لكل تبويب أعمدته:" },
        { table: { head: ["التبويب", "أعمدة الملف"], rows: [
          ["الأشخاص", "الاسم، المسمى الوظيفي، الشركة، عدد الموظفين، المدينة، الدولة، البحث، البريد، حالة البريد، الهاتف، لينكدإن، فيسبوك، إنستجرام، نسبة تطابق ICP، آخر تحديث، بيانات ناقصة"],
          ["الشركات", "الاسم، الموقع، القطاع، عدد الموظفين، المدينة، الدولة، البريد، الهاتف، لينكدإن، فيسبوك، إنستجرام، البحث، نسبة تطابق ICP، آخر تحديث، بيانات ناقصة"],
          ["المحفوظات", "النوع (شخص أو شركة أو نشاط محلي)، الاسم، المسمى الوظيفي، الشركة، المدينة، الدولة، البريد، الهاتف، الموقع، لينكدإن، فيسبوك، إنستجرام، البحث، نسبة تطابق ICP، آخر تحديث، بيانات ناقصة"],
        ] } },
        { ul: [
          "عمود **البحث** يحمل اسم البحث الذي وجد الصف، لا اسم الحملة.",
          "في النشاط المحلي يحمل عمود **القطاع** فئته.",
          "يبين عمود **حالة البريد** هل البريد موثّق. والبريد الذي فشل التحقق منه يُترك فارغًا.",
          "يسرد عمود **بيانات ناقصة** الحقول التي لم يوفرها المصدر، مفصولة بفاصلة منقوطة.",
          "التصدير من **المحفوظات** يشمل كل الأشخاص والشركات المحفوظين، أيًا كان المفتاح المختار بين الشركات والأشخاص، ويميّز عمود **النوع** بينهم.",
        ] },
        { p: "تبيّن **نسبة تطابق ICP** مدى مطابقة الصف لاستهداف البحث الذي وجده، من 0 إلى 100، وهي القيمة نفسها التي يستخدمها فلتر **أدنى تطابق ICP**. أما **آخر تحديث** فهو آخر وقت حدّث فيه يولياس بيانات الصف." },
        { p: "يحمل الملف اسم التبويب والتاريخ، مثل yolias-people-2026-11-05.csv." },

        { h2: "صدّر عملاءك" },
        { ol: [
          "افتح **العملاء** واختر التبويب: **الشركات** أو **الأشخاص** أو **المحفوظات**.",
          "ضيّق العرض: ابحث، وافتح **تصفية** واضغط **تطبيق**، واختر الحملة في النهاية (تطبيق الفلاتر يعيد قائمة الحملات إلى كل الحملات).",
          "راجع العدد تحت عنوان اللوحة، مثل «240 شخص». هذا عدد صفوف الملف، بحد أقصى 10,000.",
          "افتح قائمة **المزيد** (النقاط الثلاث بجانب **تصفية**) واختر **تصدير CSV**.",
          "يُنزَّل الملف عبر متصفحك، فافتحه من مجلد التنزيلات.",
        ] },
        { p: "إذا لم يُنزَّل شيء فتأكد أن متصفحك لا يمنع التنزيل من يولياس، ثم حاول مجددًا. والعرض الفارغ يعطي ملفًا فيه صف العناوين فقط." },

        { h2: "صدّر صفوفًا محددة" },
        { ol: [
          "في **العملاء** حدد الصفوف التي تريدها. ومربع العنوان يحدد كل صفوف الصفحة.",
          "في شريط التحديد («تم تحديد {count}») اضغط أيقونة التنزيل (**تصدير CSV**).",
          "يحتوي الملف الصفوف المحددة فقط، بأعمدة التبويب الحالي.",
        ] },
        { p: "التحديد يشمل الصفحة الحالية، حتى 50 صفًا، ويُلغى عند الانتقال إلى صفحة أخرى. ولتصدير كل الصفوف المطابقة حدد مربع العنوان، ثم اضغط **تحديد كل الـ{count} المطابقة** في الشريط، ثم أيقونة التنزيل، أو استخدم **تصدير CSV** من قائمة **المزيد**." },
        { h3: "صنّاع القرار في شركة واحدة" },
        { p: "افتح صفحة الشركة، وفي قسم **صنّاع القرار** حدد أشخاصًا أو اضغط **تحديد الكل**، ثم اضغط **تصدير CSV** في الشريط الذي يظهر. ويستخدم الملف أعمدة الأشخاص." },

        { h2: "صدّر أرقام الحملات" },
        { ol: [
          "افتح **الحملات**.",
          "اختر الجدول: **الحملات** أو **الجماهير** أو **الرسائل**.",
          "حدد الفترة (مثل **آخر 30 يومًا** أو **هذا الشهر** أو **فترة مخصصة**)، و**الفلاتر**، و**الأعمدة** التي تريدها بالترتيب الذي تريده.",
          "اضغط **تصدير** ثم **تصدير كملف ‎.csv** أو **تصدير كملف ‎.xlsx**.",
          "يُنزَّل الملف باسم مثل yolias-campaigns-2026-11-05.xlsx، أو باسم الجماهير أو الرسائل.",
        ] },
        { p: "يحتوي الملف الاسم، ثم الحالة (في الحملات) أو الحملة (في الجماهير والرسائل)، ثم كل عمود ظاهر بترتيبه. ويشمل كل صف يعرضه الجدول بفلاترك." },
        { h3: "ما يحتويه كل جدول" },
        { ul: [
          "**الحملات**: صف لكل حملة مع حالتها.",
          "**الجماهير**: صف لكل جمهور مع الحملة التي ينتمي إليها، وهو المناسب لمقارنة جماهير الحملة الواحدة.",
          "**الرسائل**: صف لكل افتتاحية رسالة مع حملتها.",
        ] },
        { p: "الأعمدة المخفية لا تُصدَّر، فافتح **الأعمدة** أولًا وفعّل كل ما تريده في الملف، ورتبه بالترتيب الذي تريد أن تقرأه به. وإذا حفظت هذا الإعداد كعرض من **العروض المحفوظة** فستجده جاهزًا في التقرير التالي دون أن تعيد ضبط الأعمدة." },
        { table: { head: ["الصيغة", "كيف تُكتب القيم"], rows: [
          [".csv", "كما يعرضها الجدول: الأرقام والعملات والنسب منسقة كنص."],
          [".xlsx", "تبقى الأرقام أرقامًا، فتجمعها وترتبها وترسمها. وتصبح النسب أرقامًا، فتُكتب 12.5% على أنها 12.5. وتُقرّب المبالغ والقيم الأخرى إلى منزلتين عشريتين."],
        ] } },

        { h2: "أي تصدير تستخدم" },
        { table: { head: ["تريد", "استخدم"], rows: [
          ["كل عملاء حملة واحدة", "العملاء، ثم اختر الحملة، ثم **المزيد**، ثم **تصدير CSV**"],
          ["عددًا قليلًا من أشخاص بعينهم", "حددهم في العملاء، ثم أيقونة التنزيل في شريط التحديد"],
          ["الأشخاص في شركة واحدة", "صفحة الشركة، ثم **صنّاع القرار**، ثم **تحديد الكل**، ثم **تصدير CSV**"],
          ["كل ما حفظته", "تبويب **المحفوظات**، ثم **المزيد**، ثم **تصدير CSV**"],
          ["نتائج كل حملة لتقرير", "الحملات، جدول **الحملات**، ثم **تصدير كملف ‎.xlsx**"],
          ["أي جمهور يحقق أفضل النتائج", "الحملات، جدول **الجماهير**، مع الأعمدة التي تقارن بها"],
          ["أي افتتاحيات الرسائل تجلب ردودًا", "الحملات، جدول **الرسائل**"],
        ] } },

        { h2: "أعد قائمة مصدّرة كجمهور" },
        { p: "يمكن أن يتحول ملف العملاء إلى جمهور مخصص، مثلًا بعد أن تنقّحه أو تحذف منه أشخاصًا في برنامج الجداول. ويتعرف يولياس وحده على معظم عناوين الأعمدة المصدّرة، بالعربية والإنجليزية." },
        { ol: [
          "صدّر العملاء الذين تريدهم، وافتح الملف، واحذف الصفوف التي لا تريدها مع الإبقاء على صف العناوين.",
          "احفظه بصيغة CSV (مفصول بفاصلة أو فاصلة منقوطة، وبترميز UTF-8).",
          "افتح **الجماهير** واختر **إنشاء جمهور** ثم **جمهور مخصص** ثم **ملف (CSV)** ثم **اختر ملف CSV**.",
          "سمِّ الجمهور واختر الملف، وتأكد أن **الاستيراد كـ** يطابق ملفك: أشخاص أو شركات.",
          "تحت **الأعمدة** تأكد أن الاسم والمسمى الوظيفي والشركة والبريد والهاتف والموقع والمدينة وعدد الموظفين تشير إلى العناوين الصحيحة، واختر **لا تستورد** لأي عمود آخر.",
          "اضغط **استيراد {count} صف**. يظهر الجمهور بعدد أشخاصه، جاهزًا لاختياره من **استخدام جمهور محفوظ** في أي حملة.",
        ] },
        { p: "يقبل الملف حتى 5,000 صف و5 ميجابايت. وتُحسب الصفوف المستوردة من جهات الاتصال المرفوعة في خطتك هذا الشهر، ويظل كل من طلب عدم التواصل مستبعدًا من كل الحملات حتى لو كان في الملف." },
        { h3: "قبل أن ترسل الملف لأحد" },
        { p: "راجع الأعمدة التي يحتاجها من سيستلم الملف واحذف الباقي، فملف الأشخاص يحتوي البريد والهاتف وروابط التواصل الاجتماعي. وإذا أرسلته لفريق المبيعات فاحتفظ بعمودي **البحث** و**آخر تحديث**، فهما يبينان من أين جاء كل صف ومدى حداثة بياناته." },

        { h2: "فتح الملف" },
        { ul: [
          "**Excel**: افتح الملف بنقرتين. ويحمل ملفا CSV علامة ترميز UTF-8، فتظهر الأسماء العربية صحيحة في إصدارات Excel الحالية.",
          "**Google Sheets**: ملف، ثم استيراد، ثم تحميل، واختر الملف.",
          "**Numbers**: افتح الملف مباشرة.",
        ] },
        { p: "وإذا ظهرت العربية رموزًا غير مفهومة في إصدار قديم من Excel فاستورد الملف بدل فتحه:" },
        { ol: [
          "افتح Excel على ورقة فارغة.",
          "اختر **البيانات** ثم **من نص/CSV**، واختر الملف.",
          "اجعل أصل الملف **UTF-8** والفاصل **فاصلة**، ثم اضغط **تحميل**.",
        ] },
        { p: "القيمة التي تبدأ بـ = أو + أو - أو @ تُكتب وقبلها علامة ' حتى لا ينفذها برنامج الجداول كمعادلة. أما أرقام الهاتف مثل ‎+966 5x فتحتفظ بعلامة الزائد." },

        { h2: "أمثلة" },
        { ul: [
          "**أرسل لفريق المبيعات العملاء المهتمين هذا الشهر**: تبويب الأشخاص، اختر الحملة، رتّب بالأحدث، ثم **تصدير CSV**، وصفِّ الحالة داخل الجدول.",
          "**كل الشركات التي لصاحب القرار فيها بريد موثّق في مدينة واحدة**: تبويب الأشخاص، ثم تصفية: المدينة والبريد الموثّق فقط، ثم **تصدير CSV**.",
          "**تقرير شهري**: الحملات، ثم **هذا الشهر**، والأعمدة التي تقدم عنها تقريرًا، ثم **تصدير كملف ‎.xlsx** لترسم الأرقام.",
          "**مقارنة جمهورين في حملة واحدة**: الحملات، جدول **الجماهير**، فلتر الحملة، ثم أعمدة الردود والاجتماعات وتكلفة الاجتماع، ثم **تصدير كملف ‎.xlsx**، واحسب الفرق بينهما في الجدول.",
          "**قائمة نظيفة لحملة جديدة**: صدّر من تبويب الأشخاص بفلتر البريد الموثّق فقط، واحذف من الملف من لا يناسب عرضك الجديد، ثم أعده كجمهور مخصص كما في القسم السابق.",
        ] },
        { p: "التصدير يناسب من يحتاج القائمة خارج يولياس: فريق مبيعات أو محاسب أو تقرير. أما إذا أردت أن تصل حملة إلى هؤلاء الأشخاص أنفسهم فلا حاجة إلى ملف، بل أنشئ جمهورًا مخصصًا من مصدر داخل يولياس مثل «المهتمون» أو «جهات حملة سابقة»، فيبقى مرتبطًا بمصدره ويمكن تحديثه." },

        { h2: "الصلاحيات والمتطلبات" },
        { ul: [
          "كل الأدوار تستطيع التصدير، ومنها المحلل.",
          "يحتوي ملف العملاء حتى 10,000 صف، والتحديد صفوف الصفحة الخمسين، أو كل الصفوف المطابقة مع **تحديد كل الـ{count} المطابقة**.",
          "يُسجَّل كل تصدير للعملاء في نشاط المستخدمين بمساحة العمل، مع التبويب وعدد الصفوف.",
          "لا يحتاج التصدير إلى رصيد، ولا يغيّر شيئًا في العملاء أو الحملات: هو نسخة من البيانات كما هي لحظة التنزيل، فإذا تغيرت البيانات بعدها فصدّر ملفًا جديدًا.",
        ] },

        { h2: "ملاحظات مهمة" },
        { ul: [
          "ملف العملاء لا يحتوي عمود حالة المحادثة. ولمشاركة أين وصل كل عميل، صفِّ في العملاء حسب الحملة أولًا ثم أضف الحالة يدويًا من الجدول.",
          "تصدير الحملات يحمل الأرقام فقط لا الأشخاص. صدّر الأشخاص من العملاء.",
          "الملفات المصدّرة تخرج من يولياس، فاحفظها كما تحفظ أي قائمة جهات اتصال تجارية.",
        ] },

        { h2: "حل المشكلات" },
        { table: { head: ["المشكلة", "ما تفعله"], rows: [
          ["تظهر العربية رموزًا", "في Excel استخدم البيانات، ثم من نص/CSV، واختر UTF-8. ولأرقام الحملات استخدم **تصدير كملف ‎.xlsx**."],
          ["صفوف الملف أقل من المتوقع", "راجع التبويب والبحث والفلاتر وقائمة الحملات. وما زاد على 10,000 صف يُقطع عندها، فقسّمه بالفلاتر."],
          ["بعض الإيميلات فارغة", "فشل التحقق منها، أو لم ينشرها المصدر."],
          ["لم يُطبَّق اختيار الحملة", "تطبيق البحث أو الفلاتر يعيده إلى كل الحملات. اختر الحملة في النهاية ثم صدّر."],
          ["لا يوجد خيار Excel في العملاء", "العملاء يُصدَّرون بصيغة CSV فقط، وExcel وSheets يفتحانها مباشرة."],
          ["نُزّلت بعض الصفوف فقط بعد تحديد الكل", "مربع العنوان يحدد الصفحة الحالية. اضغط **تحديد كل الـ{count} المطابقة** في الشريط قبل التصدير، أو استخدم **تصدير CSV** من قائمة **المزيد**."],
          ["ملف الحملات ينقصه عمود أراه في الجدول", "تأكد أن العمود مفعّل في **الأعمدة**، ثم صدّر مجددًا؛ فالملف يأخذ الأعمدة الظاهرة فقط وبترتيبها."],
          ["تصدير المحفوظات فيه شركات وأشخاص معًا", "هذا مقصود: ملف المحفوظات يجمع النوعين. صفِّ عمود **النوع** في برنامج الجداول لفصلهما."],
        ] } },

        { h2: "مقالات ذات صلة" },
        { ul: [
          "[العمل مع العملاء](/help-center/prospects-workspace)",
          "[قراءة نتائج الحملة](/help-center/campaign-results)",
          "[الجماهير](/help-center/audiences)",
        ] },
      ],
    },
  },

  conversations: {
    en: {
      title: "Conversations",
      summary: "Read every thread, see who is likely to buy, take over the conversations Yolias hands you, tag them, and reply with files, images, GIFs, emoji or a voice note.",
      updated: "2026-11-05",
      blocks: [
        { p: "**Conversations** is where every exchange between your campaigns and the people they reach comes together. Yolias AI answers what it can from your Company Knowledge and hands you the rest. This article explains the list, the thread, buying intent, tags, the reply tools, and what Yolias does with each kind of reply." },

        { h2: "What Conversations shows" },
        { p: "A conversation appears once a message went out to someone or came in from them, or when an action waits for your approval. A draft of a campaign that never launched doesn't create one. The list shows the latest 400 conversations, newest first, grouped under **This week** and **Earlier**." },
        { p: "Each row shows the name, the company, the date, the subject and the start of the latest message. Unread conversations are in bold. Chips under the text add what matters: **Needs you**, the buying intent, **AI draft** when a reply is prepared, and the type of the latest reply." },

        { h2: "How Yolias handles a reply" },
        { p: "When someone replies, Yolias AI reads the reply, classifies it, and acts on it. It answers only from your Company Knowledge and only while the campaign is active with automatic replies on." },
        { table: { head: ["The reply", "What Yolias does"], rows: [
          ["Asks to stop", "Marks the person **Do not contact** and sends nothing more."],
          ["Not interested", "Closes the conversation. No more follow-ups."],
          ["Out of office", "Moves the follow-ups later."],
          ["Names a time", "Books it if it is free and confirms in the thread."],
          ["Interested or asks for a meeting", "Answers and offers two free times with your booking page."],
          ["A question", "Answers it from Company Knowledge. If the answer isn't there, hands it to you."],
          ["An objection", "Answers the first one from Company Knowledge. The next one goes to you."],
          ["Wants a person, a complaint, a negotiation, or unclear", "Hands it to you."],
        ] } },
        { p: "Yolias also hands the conversation to you after it has sent 4 answers in the same thread, or when the campaign isn't running. A handed conversation gets a **Needs you** chip and a task under **Reminders**." },

        { h3: "Follow-ups and their limits" },
        { p: "Yolias sends someone who hasn't replied at most three messages: the first email, a follow-up 3 days later, and a last one 7 days after that. A lower limit set for your workspace wins. With the setting **Stop follow-ups when the lead replies** on (it is on by default), the planned follow-ups to a person stop when they reply, and the reply is handled as in the table above. The next date shows under **Next step** in the details panel, and as **Next follow-up** in the Status column of Leads." },

        { h2: "The tabs and filters" },
        { table: { head: ["Tab", "What it lists"], rows: [
          ["All", "Every conversation."],
          ["Needs you", "Conversations Yolias handed to you, a draft or an action waiting for your approval, or an objection, a request for a person or an unclear reply that nobody has answered. The tab shows its count."],
          ["Replies", "Replies from leads, without out-of-office auto-replies."],
          ["More: Inbox", "Every open conversation with a reply. Its count is the unread ones."],
          ["More: To approve", "Drafts and actions waiting for your approval."],
          ["More: Out of office", "Auto-replies and out-of-office notices."],
          ["More: Sent", "Conversations where something went out."],
          ["More: Done", "Conversations you closed."],
        ] } },
        { p: "Above the tabs:" },
        { ul: [
          "**Search emails, leads…**: names, companies and email addresses. Press Enter.",
          "**Channel**: Email.",
          "**Show**: All, Interested, Not interested, Needs you, Asked for a meeting, Meeting booked, Replied or No reply.",
          "**Buying intent**: Any buying intent, High intent, Medium intent or Low intent.",
          "**Tag**: appears once your workspace has at least one tag.",
          "The campaign picker: **Any campaign** or one campaign.",
        ] },
        { p: "The footer shows how many conversations the list holds. Tab counts are counted before the Buying intent and Tag filters, so they can be higher than what the list shows." },

        { h2: "Read a conversation" },
        { ol: [
          "Click a row. The thread opens in the middle and the person's details on the side.",
          "Each message shows who sent it, the addresses, the time, the subject and the body. Files sent with it show as links. A message that bounced shows **Bounced**; one that failed shows the error.",
          "The conversation is marked read when you open it.",
        ] },
        { p: "Keyboard: **J** and **K** move through the list, **Enter** opens, **Esc** returns to the list, and **R** opens the reply box." },
        { h3: "The details panel" },
        { ul: [
          "**Status**: Stage, Sequence (the campaigns), Next step, Last reply and Last sent.",
          "**What came of it?**: when there is no meeting, mark **Became a customer**, or pick a reason under **Didn't buy**: Price, Timing, No need, Chose a competitor, Stopped replying or Other.",
          "**Conversation**: the channel, the mailbox and the number of messages.",
          "**Contact**: email, phone and LinkedIn.",
          "**What Yolias did**: Yolias's latest actions in this conversation.",
          "**Reminders**: open tasks. Tick one to close it.",
        ] },
        { p: "**Hide details** closes the panel; **Details** opens it again." },

        { h2: "Read the buying intent" },
        { ol: [
          "Open a conversation that has a reply.",
          "Under the name, read **Buying intent**: High intent, Medium intent or Low intent, followed by the words in the conversation that show it.",
          "To focus on likely buyers, pick **High intent** in the **Buying intent** filter. Each row keeps its badge.",
        ] },
        { p: "Yolias AI reads the intent from the whole conversation. For replies read before this was added, it comes from the reply type: a meeting request or interest is high; a question, an objection or a request for a person is medium; not interested or a stop request is low. The filter uses the latest reply." },
        { p: "If the classification is wrong, open the reply type badge under the name (**Change classification**) and pick the right one. You see \"Classification updated.\"" },

        { h2: "Take over a conversation" },
        { ol: [
          "Open the **Needs you** tab, then the conversation. The banner reads \"Yolias handed this conversation to you.\" with a short summary.",
          "Reply yourself (next section). Sending a reply takes the conversation out of **Needs you**.",
          "If no reply is needed, press **Done** in the banner. You see \"Marked as done.\"",
        ] },
        { p: "To close a conversation, press **Mark done** in the header; it moves to **Done**. Closing deletes nothing and doesn't change the lead's stage; it only takes the conversation out of the open lists. **Reopen** brings it back." },
        { p: "Conversations in **To approve** hold a draft or an action Yolias prepared that waits for you: open the conversation, read the draft, then send it as it is or edit it first." },

        { h2: "Reply yourself" },
        { ol: [
          "Open the conversation and press the reply bar (\"Reply to {name}…\", with the mailbox it sends from), or press **R**.",
          "Write your reply, up to 5,000 characters.",
          "To let Yolias write it, type what you want said, or nothing, and press **Write with AI**. You see \"Yolias wrote a reply. Review it, then send.\", and the draft appears in the thread for review.",
          "Add files, images, a GIF, emoji or a voice note with the tools under the text (see below).",
          "Press **Send**. You see \"Sent.\" and the reply appears in the thread.",
        ] },
        { p: "The reply goes out from your connected mailbox, in the same email thread as the earlier messages. If it can't be sent, it stays as a draft in the conversation." },
        { h3: "When Yolias prepared a reply" },
        { p: "A card reads \"AI reply ready · Check it before sending\". Press **Review draft** to read it in full. When Yolias suggested an answer instead of a full draft, **Review draft** puts the text in the reply box for you to edit and send." },

        { h2: "Reply tools" },
        { p: "The reply box offers the tools of the conversation's channel. On email, all five are available, and everything you add is sent as an attachment of the email." },
        { table: { head: ["Tool", "What it does"], rows: [
          ["Attach a file", "Any file except programs and scripts (.exe, .bat, .cmd, .com, .scr, .js, .vbs, .jar, .msi, .ps1, .sh, .apk)."],
          ["Add an image", "Opens your images."],
          ["Add a GIF", "Opens your .gif files."],
          ["Emoji", "A panel of 20 emoji, added where your text ends."],
          ["Record a voice note", "Records from your microphone. Press **Stop recording**; the recording is attached as an audio file."],
        ] } },
        { p: "Up to 5 files in one reply, 10 MB each. Each added file shows under the text with **Remove**. While a file uploads, the toolbar reads **Uploading…**." },

        { h2: "Tag a conversation" },
        { ol: [
          "Open the conversation.",
          "Type in **Add tag** under the name, up to 40 characters, and press Enter. Tags already used in your workspace are suggested as you type.",
          "To remove a tag, press the X on it.",
          "To see every conversation with a tag, pick it in the **Tag** filter.",
        ] },
        { p: "Tags belong to the person, so they follow the conversation in every tab." },

        { h2: "Follow a campaign live" },
        { p: "After you approve a campaign, Conversations opens with a strip for that campaign: \"Writing x · Sent y of z\", and the number not sent, if any. It updates while Yolias writes and sends. **Show all conversations** removes it." },

        { h2: "Examples" },
        { ul: [
          "**Morning check**: open **Needs you**, answer each conversation or press **Done**, then filter **High intent** and make sure each has a meeting or a next step.",
          "**Price questions**: tag every conversation about pricing \"pricing\", then add the answer to Company Knowledge so Yolias answers the next ones.",
          "**Send a proposal**: open the conversation, press **R**, write two lines, attach the PDF, and send.",
        ] },

        { h2: "Permissions and requirements" },
        { ul: [
          "Replying needs a mailbox connected in **Integrations**. Without one, the box reads \"Connect a mailbox in Integrations to reply from Yolias.\" and **Send** stays off.",
          "Admins and Advertisers can reply, tag, approve and close. Analysts can read.",
          "Voice notes need your browser's microphone permission.",
          "Yolias answers by itself only while the campaign is active with automatic replies on.",
        ] },

        { h2: "Important notes" },
        { ul: [
          "When a person asked not to be contacted, the reply box is replaced by \"This lead asked not to be contacted.\"",
          "Yolias never promises prices, discounts, dates or terms that aren't in Company Knowledge.",
          "Email opens don't change the buying intent or the lead score.",
        ] },

        { h2: "Troubleshooting" },
        { table: { head: ["Problem", "What to do"], rows: [
          ["**Send** is off", "Connect a mailbox in Integrations, and write something or attach a file."],
          ["A conversation isn't listed", "Only threads where something was sent or received appear. Clear the search, Show, Buying intent, Tag and campaign filters, and check **Done**."],
          ["\"A file can be up to 10 MB.\"", "Compress the file or send a link."],
          ["\"This file type can't be sent.\"", "Program and script files are refused. Zip or convert the file."],
          ["\"Up to 5 files in one reply.\"", "Remove a file, or send the rest in a second reply."],
          ["\"Allow the microphone in your browser to record.\"", "Allow the microphone for Yolias in your browser's site settings, then try again."],
          ["Yolias didn't answer a reply", "The campaign is paused or ended, automatic replies are off, the answer isn't in Company Knowledge, or the thread reached 4 answers. The conversation is in **Needs you**."],
          ["The buying intent looks wrong", "Correct the reply type with **Change classification**."],
        ] } },

        { h2: "Related articles" },
        { ul: [
          "[Yolias AI](/help-center/yolias-ai)",
          "[Company Knowledge](/help-center/company-knowledge)",
          "[Meetings and your booking page](/help-center/deals-and-meetings)",
          "[Working with leads](/help-center/prospects-workspace)",
        ] },
      ],
    },
    ar: {
      title: "المحادثات",
      summary: "اقرأ كل محادثة، واعرف من يُرجَّح أن يشتري، وتولَّ المحادثات التي يسلمك إياها يولياس، وضع لها تاجات، ورد بملفات وصور وGIF وإيموجي وتسجيل صوتي.",
      updated: "2026-11-05",
      blocks: [
        { p: "تجمع صفحة **المحادثات** كل ما يدور بين حملاتك والأشخاص الذين تصل إليهم. يرد Yolias AI على ما يستطيع من معرفة شركتك، ويسلمك الباقي. يشرح هذا المقال القائمة، وصفحة المحادثة، ونية الشراء، والتاجات، وأدوات الرد، وما يفعله يولياس مع كل نوع من الردود." },

        { h2: "ما الذي تعرضه المحادثات" },
        { p: "تظهر المحادثة بمجرد أن تُرسل رسالة إلى شخص أو تصل منه، أو عندما ينتظر إجراء موافقتك. أما مسودة حملة لم تبدأ فلا تُنشئ محادثة. وتعرض القائمة آخر 400 محادثة، الأحدث أولًا، تحت **هذا الأسبوع** و**أقدم**." },
        { p: "يعرض كل سطر الاسم والشركة والتاريخ والموضوع وبداية آخر رسالة، والمحادثات غير المقروءة بخط عريض. وتضيف الشارات تحت النص ما يهم: **يحتاجك**، ونية الشراء، و**مسودة AI** عندما يكون الرد جاهزًا، ونوع آخر رد." },

        { h2: "كيف يتعامل يولياس مع الرد" },
        { p: "عندما يرد شخص يقرأ Yolias AI الرد ويصنّفه ثم يتصرف. ولا يجيب إلا من معرفة شركتك، وفقط والحملة تعمل والردود التلقائية مفعّلة." },
        { table: { head: ["الرد", "ما يفعله يولياس"], rows: [
          ["يطلب التوقف", "يضعه في **عدم التواصل** ولا يرسل شيئًا بعدها."],
          ["غير مهتم", "يغلق المحادثة ويوقف المتابعات."],
          ["خارج المكتب", "يؤجل المتابعات."],
          ["يحدد موعدًا", "يحجزه إن كان متاحًا ويؤكده في المحادثة."],
          ["مهتم أو يطلب اجتماعًا", "يرد ويعرض موعدين متاحين مع صفحة الحجز."],
          ["سؤال", "يجيب من معرفة الشركة، وإن لم يجد الإجابة سلّمك المحادثة."],
          ["اعتراض", "يجيب عن أول اعتراض من معرفة الشركة، والاعتراض التالي يذهب إليك."],
          ["يريد شخصًا، أو شكوى، أو تفاوض، أو رد غير واضح", "يسلّمك المحادثة."],
        ] } },
        { p: "ويسلّمك يولياس المحادثة أيضًا بعد أن يرسل 4 ردود في المحادثة نفسها، أو إذا لم تكن الحملة تعمل. وتحمل المحادثة المسلَّمة شارة **يحتاجك**، وتظهر لها مهمة تحت **التذكيرات**." },

        { h3: "المتابعات وحدودها" },
        { p: "يرسل يولياس لمن لم يرد ثلاث رسائل على الأكثر: الرسالة الأولى، ثم متابعة بعد 3 أيام، ثم متابعة أخيرة بعد 7 أيام من السابقة، وإذا وضعت مساحة العمل حدًا أقل فالحد الأقل هو المعتمد. ومع تفعيل إعداد **إيقاف المتابعات عند رد العميل** (وهو مفعّل افتراضيًا) تتوقف المتابعات المجدولة لهذا الشخص بمجرد أن يرد، ويبدأ التعامل مع رده كما في الجدول السابق. فإذا عطّلته استمرت المتابعات المجدولة رغم الرد، لذلك اتركه مفعّلًا ما لم يكن لديك سبب واضح. وتظهر هذه المواعيد في لوحة التفاصيل تحت **الخطوة التالية**، وفي عمود الحالة في صفحة العملاء تحت **المتابعة التالية**." },

        { h2: "التبويبات والفلاتر" },
        { table: { head: ["التبويب", "ما يعرضه"], rows: [
          ["الكل", "كل المحادثات."],
          ["محتاج تدخلك", "المحادثات التي سلّمك إياها يولياس، أو مسودة أو إجراء ينتظر موافقتك، أو اعتراض أو طلب شخص أو رد غير واضح لم يُجب عنه. ويظهر عددها بجانب التبويب."],
          ["الردود", "ردود العملاء بدون ردود «خارج المكتب» التلقائية."],
          ["المزيد: الوارد", "كل محادثة مفتوحة فيها رد، وعدده هو غير المقروء."],
          ["المزيد: بانتظار موافقتك", "مسودات وإجراءات تنتظر موافقتك."],
          ["المزيد: خارج المكتب", "الردود التلقائية وإشعارات خارج المكتب."],
          ["المزيد: المرسلة", "محادثات أُرسل فيها شيء."],
          ["المزيد: منتهية", "محادثات أغلقتها."],
        ] } },
        { p: "وفوق التبويبات:" },
        { ul: [
          "**ابحث في الرسائل والعملاء…**: في الأسماء والشركات وعناوين البريد، ثم اضغط Enter.",
          "**القناة**: البريد.",
          "**عرض**: الكل، أو مهتم، أو غير مهتم، أو يحتاج تدخلك، أو طلب اجتماعًا، أو تم حجز اجتماع، أو ردّ، أو لم يرد.",
          "**نية الشراء**: كل درجات نية الشراء، أو نية عالية، أو متوسطة، أو منخفضة.",
          "**التاج**: يظهر بعد أن يصبح في مساحة العمل تاج واحد على الأقل.",
          "قائمة الحملات: **كل الحملات** أو حملة واحدة.",
        ] },
        { p: "يعرض أسفل القائمة عدد المحادثات فيها. وتُحسب أعداد التبويبات قبل فلتري نية الشراء والتاج، فقد تكون أكبر مما تعرضه القائمة." },

        { h2: "اقرأ محادثة" },
        { ol: [
          "اضغط على سطر، فتُفتح المحادثة في الوسط وتفاصيل الشخص على الجانب.",
          "تعرض كل رسالة المرسل والعناوين والوقت والموضوع والنص، والملفات المرسلة معها كروابط. والرسالة المرتدة تظهر عليها **ارتدّت**، والفاشلة يظهر سبب فشلها.",
          "تُعلَّم المحادثة مقروءة عند فتحها.",
        ] },
        { p: "لوحة المفاتيح: **J** و**K** للتنقل في القائمة، و**Enter** للفتح، و**Esc** للرجوع إلى القائمة، و**R** لفتح خانة الرد." },
        { h3: "لوحة التفاصيل" },
        { ul: [
          "**الحالة**: المرحلة، والتسلسل (الحملات)، والخطوة التالية، وآخر رد، وآخر إرسال.",
          "**ما النتيجة؟**: عندما لا يوجد اجتماع، اختر **صار عميلًا**، أو اختر سببًا من **لم يشترِ**: السعر، أو التوقيت، أو لا يحتاجه، أو اختار منافسًا، أو توقف عن الرد، أو سبب آخر.",
          "**المحادثة**: القناة وصندوق البريد وعدد الرسائل.",
          "**التواصل**: البريد والهاتف وLinkedIn.",
          "**ما فعله يولياس**: آخر ما قام به يولياس في هذه المحادثة.",
          "**التذكيرات**: المهام المفتوحة، وعلامة على المهمة تغلقها.",
        ] },
        { p: "يغلق **إخفاء التفاصيل** اللوحة، ويعيد **التفاصيل** فتحها." },

        { h2: "اقرأ نية الشراء" },
        { ol: [
          "افتح محادثة فيها رد.",
          "اقرأ تحت الاسم **نية الشراء**: نية عالية أو متوسطة أو منخفضة، وبعدها الكلمات في المحادثة التي تدل عليها.",
          "للتركيز على من يُرجَّح أن يشتري اختر **نية عالية** من فلتر **نية الشراء**، ويبقى مع كل سطر شارته.",
        ] },
        { p: "يقرأ Yolias AI النية من المحادثة كاملة. وفي الردود التي قُرئت قبل إضافة هذه الميزة تأتي النية من نوع الرد: طلب الاجتماع والاهتمام نية عالية، والسؤال والاعتراض وطلب شخص نية متوسطة، وعدم الاهتمام وطلب التوقف نية منخفضة. ويعتمد الفلتر على آخر رد." },
        { p: "إذا كان التصنيف خاطئًا فافتح شارة نوع الرد تحت الاسم (**تغيير التصنيف**) واختر الصحيح، فتظهر «تم تحديث التصنيف.»" },

        { h2: "تولَّ محادثة" },
        { ol: [
          "افتح تبويب **محتاج تدخلك** ثم المحادثة. يظهر شريط «يولياس سلّمك هذه المحادثة.» مع ملخص قصير.",
          "رد بنفسك (القسم التالي). إرسال الرد يُخرج المحادثة من **محتاج تدخلك**.",
          "إذا لم تحتج إلى رد فاضغط **تم** في الشريط، فتظهر «تم التعليم كمنتهية.»",
        ] },
        { p: "ولإغلاق المحادثة اضغط **إنهاء** في أعلاها فتنتقل إلى **منتهية**، ويعيدها **إعادة فتح**. والإنهاء لا يحذف شيئًا ولا يغيّر مرحلة العميل، بل يُخرج المحادثة من القوائم المفتوحة فقط. وإذا وصل رد جديد في محادثة منتهية فاضغط **إعادة فتح** لتعود إلى تبويبات الوارد والردود." },
        { p: "أما المحادثات في تبويب **بانتظار موافقتك** فتحمل مسودة أو إجراء جهّزه يولياس ولا يُنفَّذ قبل أن تراجعه: افتح المحادثة، واقرأ المسودة، ثم أرسلها كما هي أو عدّلها قبل الإرسال." },

        { h2: "رد بنفسك" },
        { ol: [
          "افتح المحادثة واضغط شريط الرد («رد على {name}…» ومعه البريد الذي يُرسل منه)، أو اضغط **R**.",
          "اكتب ردك، حتى 5,000 حرف.",
          "لتترك يولياس يكتبه، اكتب ما تريد قوله أو اتركه فارغًا واضغط **اكتب بالذكاء الاصطناعي**. تظهر «كتب يولياس ردًا. راجعه ثم أرسله.»، وتظهر المسودة في المحادثة لتراجعها.",
          "أضف ملفات أو صورًا أو GIF أو إيموجي أو تسجيلًا صوتيًا بالأدوات تحت النص (انظر أدناه).",
          "اضغط **إرسال**. تظهر «تم الإرسال.» ويظهر ردك في المحادثة.",
        ] },
        { p: "يُرسل الرد من بريدك المتصل، في سلسلة البريد نفسها مع الرسائل السابقة. وإذا تعذر إرساله يبقى مسودة في المحادثة." },
        { h3: "عندما يجهّز يولياس ردًا" },
        { p: "تظهر بطاقة «رد AI جاهز · راجعه قبل الإرسال». اضغط **مراجعة المسودة** لتقرأه كاملًا. وإذا اقترح يولياس إجابة لا مسودة كاملة، يضع **مراجعة المسودة** النص في خانة الرد لتعدله وترسله." },

        { h2: "أدوات الرد" },
        { p: "تعرض خانة الرد أدوات قناة المحادثة. وفي البريد تتاح الأدوات الخمس كلها، وكل ما تضيفه يُرسل مرفقًا بالرسالة." },
        { table: { head: ["الأداة", "ما تفعله"], rows: [
          ["إرفاق ملف", "أي ملف عدا البرامج والسكربتات (‎.exe و‎.bat و‎.cmd و‎.com و‎.scr و‎.js و‎.vbs و‎.jar و‎.msi و‎.ps1 و‎.sh و‎.apk)."],
          ["إضافة صورة", "تفتح صورك."],
          ["إضافة GIF", "تفتح ملفات ‎.gif لديك."],
          ["إيموجي", "لوحة من 20 إيموجي، يُضاف المختار في آخر النص."],
          ["تسجيل صوتي", "يسجل من الميكروفون. اضغط **إيقاف التسجيل** فيُرفق التسجيل كملف صوتي."],
        ] } },
        { p: "حتى 5 ملفات في الرد الواحد، وحجم كل ملف حتى 10 ميجا. ويظهر كل ملف مضاف تحت النص مع **إزالة**، وأثناء الرفع يظهر **جارٍ الرفع…**." },

        { h2: "ضع تاجًا على محادثة" },
        { ol: [
          "افتح المحادثة.",
          "اكتب في **إضافة تاج** تحت الاسم، حتى 40 حرفًا، واضغط Enter. وتُقترح التاجات المستخدمة في مساحة العمل أثناء الكتابة.",
          "لإزالة تاج اضغط علامة X عليه.",
          "لعرض كل المحادثات التي تحمل تاجًا اختره من فلتر **التاج**.",
        ] },
        { p: "التاج مرتبط بالشخص، فيتبع المحادثة في كل التبويبات." },

        { h2: "تابع حملة مباشرة" },
        { p: "بعد الموافقة على حملة تُفتح المحادثات وفي أعلاها شريط لهذه الحملة: «يكتب x · أُرسل y من z»، وعدد ما لم يُرسل إن وُجد. ويتحدث الشريط أثناء الكتابة والإرسال، ويزيله **عرض كل المحادثات**." },

        { h2: "أمثلة" },
        { ul: [
          "**مراجعة الصباح**: افتح **محتاج تدخلك**، ورد على كل محادثة أو اضغط **تم**، ثم صفِّ على **نية عالية** وتأكد أن لكل منها اجتماعًا أو خطوة تالية.",
          "**أسئلة السعر**: ضع تاج «الأسعار» على كل محادثة عن السعر، ثم أضف الإجابة إلى معرفة الشركة ليجيب يولياس عن القادم منها.",
          "**إرسال عرض سعر**: افتح المحادثة، واضغط **R**، واكتب سطرين، وأرفق ملف PDF، ثم أرسل.",
        ] },

        { h2: "الصلاحيات والمتطلبات" },
        { ul: [
          "الرد يحتاج بريدًا متصلًا من **التكاملات**، وبدونه تظهر «اربط بريدًا من التكاملات لترد من يولياس.» ويبقى **إرسال** معطلًا.",
          "المدير والمعلن يردان ويضعان التاجات ويوافقان ويغلقان المحادثات، والمحلل يقرأ فقط.",
          "التسجيل الصوتي يحتاج إذن الميكروفون في متصفحك.",
          "لا يرد يولياس وحده إلا والحملة تعمل والردود التلقائية مفعّلة.",
        ] },

        { h2: "ملاحظات مهمة" },
        { ul: [
          "إذا طلب الشخص عدم التواصل تُستبدل خانة الرد بعبارة «طلب هذا العميل عدم التواصل معه.»",
          "لا يعد يولياس أبدًا بأسعار أو خصومات أو مواعيد أو شروط غير موجودة في معرفة الشركة.",
          "فتح الرسائل لا يغيّر نية الشراء ولا درجة العميل.",
        ] },

        { h2: "حل المشكلات" },
        { table: { head: ["المشكلة", "ما تفعله"], rows: [
          ["زر **إرسال** معطل", "اربط بريدًا من التكاملات، واكتب شيئًا أو أرفق ملفًا."],
          ["محادثة لا تظهر", "تظهر فقط المحادثات التي أُرسل فيها شيء أو وصل منها شيء. امسح البحث وفلاتر العرض ونية الشراء والتاج والحملة، وراجع **منتهية**."],
          ["«حجم الملف حتى 10 ميجا.»", "اضغط الملف أو أرسل رابطًا."],
          ["«لا يمكن إرسال هذا النوع من الملفات.»", "ملفات البرامج والسكربتات مرفوضة. اضغطها في ملف zip أو حوّل صيغتها."],
          ["«حتى 5 ملفات في الرد الواحد.»", "احذف ملفًا، أو أرسل الباقي في رد ثانٍ."],
          ["«اسمح للميكروفون في متصفحك لتسجيل الصوت.»", "اسمح بالميكروفون ليولياس من إعدادات الموقع في متصفحك، ثم حاول مجددًا."],
          ["لم يرد يولياس على رد", "الحملة متوقفة أو انتهت، أو الردود التلقائية مغلقة، أو الإجابة غير موجودة في معرفة الشركة، أو بلغت المحادثة 4 ردود. والمحادثة في **محتاج تدخلك**."],
          ["نية الشراء تبدو خاطئة", "صحح نوع الرد من **تغيير التصنيف**."],
        ] } },

        { h2: "مقالات ذات صلة" },
        { ul: [
          "[Yolias AI](/help-center/yolias-ai)",
          "[معرفة الشركة](/help-center/company-knowledge)",
          "[الاجتماعات وصفحة الحجز](/help-center/deals-and-meetings)",
          "[العمل مع العملاء](/help-center/prospects-workspace)",
        ] },
      ],
    },
  },

  "awaiting-data-source": {
    en: {
      title: "A campaign waiting to start",
      summary: "Why a search can wait for a data source, what happens while it waits, and how to get people into the campaign now.",
      updated: "2026-11-05",
      blocks: [
        { p: "Every audience that finds new people runs a search in the background. A search needs a data source that covers its kind of search. When no such source is available, the search keeps everything it needs and waits. This article explains what you see, what it costs, and what you can do." },

        { h2: "What \"Waiting to start\" means" },
        { p: "Yolias has understood the targeting and created the search, but no data source for this kind of search is available on Yolias at that moment. The search doesn't fail and doesn't lose anything: the targeting, the number of people asked for and the campaign link all stay. It starts by itself once a source is available." },
        { p: "There are three kinds of search, each with its own source:" },
        { table: { head: ["Kind of search", "Used by", "Source it needs"], rows: [
          ["Companies and their decision makers", "New targeting, saved targeting, and people searches", "A company data source"],
          ["Local businesses", "Searches for shops, clinics, restaurants and other places on the map", "A local business (maps) source"],
          ["Companies similar to ones you name", "Lookalike audiences", "A lookalike-companies source"],
        ] } },
        { p: "Custom audiences never wait: they use people you already have, and no search runs." },

        { h2: "Where you see it" },
        { ul: [
          "**In a Yolias AI conversation**: the search card reads **Search ready · Waiting to start**, and its latest line reads \"This search is waiting to start. Results appear here as soon as they are found.\"",
          "**On a campaign**: an audience whose search waits brings no new people. Its row in the campaign's Audiences tab stays without new leads, and **Leads** doesn't grow for that campaign.",
        ] },

        { h2: "How it starts" },
        { p: "Yolias checks waiting searches in the background, every minute. When a source for the search's kind becomes available, the search is queued and starts finding people. People then appear in **Leads** and the campaign writes to them as usual. You don't need to do anything." },
        { p: "Pausing the campaign also pauses its waiting searches. Resuming the campaign schedules them again; if the source is still missing, they go back to waiting." },

        { h2: "What it costs" },
        { ul: [
          "When a search starts, it reserves its share of your month's leads, so two searches can't use the same leads.",
          "Nothing is used while the search waits. A lead is used only for each person or company actually delivered.",
          "What isn't used is released when the search ends.",
        ] },

        { h2: "Get people into the campaign now" },
        { p: "Once a campaign runs, its existing audiences are locked: \"This campaign is running: its audiences' targeting can't change. Add a new audience instead.\" So you add an audience that doesn't need the missing source." },
        { ol: [
          "Open the campaign, then **Edit campaign** (or **Edit** in the campaign's menu on **Campaigns**).",
          "Go to the **Audience** step and press **Add audience**.",
          "Choose one that doesn't depend on the missing source: **Use a saved audience** with a custom audience (from customers, meetings, interested people, a previous campaign or a CSV file), or new targeting if the waiting audience was a lookalike or a local business search.",
          "Check the **Audience** box: a custom audience shows its number of people and how many can be emailed.",
          "Press **Save changes**.",
        ] },
        { p: "A custom audience adds its people right away: they join the campaign, appear in its leads, and receive the first email in the campaign's sending hours. The waiting audience stays in the campaign and starts by itself later." },
        { p: "If you see \"“{name}” had nobody to add (everyone was already contacted, or asked not to be).\", the custom audience holds only people the campaign can't write to. Pick another source." },

        { h2: "Other reasons a search waits" },
        { table: { head: ["What you see", "Why", "What happens"], rows: [
          ["\"Today's budget is spent. Yolias continues tomorrow.\"", "The workspace's budget for the day is used.", "The search continues the next day."],
          ["\"Yolias moved this audience's budget to audiences with better results. It is checked again tomorrow.\"", "This audience brought weaker results or cost more than the cap.", "It is checked again the next day."],
          ["**Paused · Leads used up**", "Your month's leads are used.", "It continues by itself after you buy more leads or upgrade."],
          ["**Paused**", "You or a teammate paused the campaign.", "Resume the campaign."],
        ] } },

        { h2: "Permissions" },
        { ul: [
          "Admins and Advertisers can edit a campaign and add audiences. Analysts can see the state only.",
          "Data sources are run by Yolias. There is nothing to connect in your workspace to end the wait.",
        ] },

        { h2: "Troubleshooting" },
        { table: { head: ["Problem", "What to do"], rows: [
          ["I can't change the waiting audience", "It is locked because the campaign runs. Add a new audience."],
          ["The new audience waits too", "It uses the same kind of search. Use a custom audience, or a different kind of search."],
          ["The campaign has no people at all", "Check that each audience shows people in the **Audience** box, and that the campaign isn't paused."],
          ["Leads still don't grow after the wait ended", "The campaign may be over its daily budget or out of leads. Read the search card or the campaign's latest activity."],
        ] } },

        { h2: "Related articles" },
        { ul: [
          "[Audiences](/help-center/audiences)",
          "[Creating a campaign](/help-center/creating-a-campaign)",
          "[When Yolias AI can't read a request](/help-center/search-needs-attention)",
        ] },
      ],
    },
    ar: {
      title: "حملة تنتظر البدء",
      summary: "لماذا قد ينتظر البحث مصدر بيانات، وما الذي يحدث أثناء الانتظار، وكيف تُدخل أشخاصًا إلى الحملة الآن.",
      updated: "2026-11-05",
      blocks: [
        { p: "كل جمهور يبحث عن أشخاص جدد يشغّل بحثًا في الخلفية، والبحث يحتاج مصدر بيانات يغطي نوعه. وعندما لا يتوفر هذا المصدر يحتفظ البحث بكل ما يحتاجه وينتظر. يشرح هذا المقال ما تراه، وتكلفته، وما يمكنك فعله." },

        { h2: "ماذا تعني «بانتظار البدء»" },
        { p: "فهم يولياس الاستهداف وأنشأ البحث، لكن لا يتوفر في يولياس في هذه اللحظة مصدر بيانات لهذا النوع من البحث. البحث لم يفشل ولم يفقد شيئًا: يبقى الاستهداف وعدد الأشخاص المطلوب وارتباطه بالحملة كما هي، ويبدأ وحده بمجرد توفر المصدر." },
        { p: "هناك ثلاثة أنواع من البحث، لكل منها مصدره:" },
        { table: { head: ["نوع البحث", "يستخدمه", "المصدر الذي يحتاجه"], rows: [
          ["شركات وصنّاع القرار فيها", "الاستهداف الجديد والاستهداف المحفوظ والبحث عن أشخاص", "مصدر بيانات الشركات"],
          ["أنشطة محلية", "البحث عن المتاجر والعيادات والمطاعم وغيرها على الخريطة", "مصدر الأنشطة المحلية (الخرائط)"],
          ["شركات مشابهة لشركات تسميها", "الجماهير المشابهة", "مصدر الشركات المشابهة"],
        ] } },
        { p: "أما الجمهور المخصص فلا ينتظر أبدًا، لأنه يستخدم أشخاصًا لديك بالفعل ولا يشغّل بحثًا." },

        { h2: "أين تراها" },
        { ul: [
          "**في محادثة مع Yolias AI**: تظهر على بطاقة البحث **البحث جاهز · بانتظار البدء**، وآخر سطر فيها: «هذا البحث في انتظار البدء. تظهر النتائج هنا فور العثور عليها.»",
          "**في الحملة**: الجمهور الذي ينتظر بحثه لا يأتي بأشخاص جدد، فيبقى سطره في تبويب الجماهير بالحملة دون عملاء جدد، ولا يزيد عدد عملاء هذه الحملة في **العملاء**.",
        ] },

        { h2: "كيف يبدأ" },
        { p: "يفحص يولياس البحوث المنتظرة في الخلفية كل دقيقة. وعندما يتوفر مصدر لنوع البحث يدخل البحث في الدور ويبدأ إيجاد الأشخاص، فيظهرون في **العملاء** وتكتب لهم الحملة كالمعتاد. لا تحتاج إلى فعل شيء." },
        { p: "إيقاف الحملة مؤقتًا يوقف بحوثها المنتظرة أيضًا، واستئنافها يعيد جدولتها، فإن كان المصدر ما زال غير متوفر عادت إلى الانتظار." },

        { h2: "التكلفة" },
        { ul: [
          "عند بدء البحث يحجز نصيبه من عملاء شهرك، حتى لا يستخدم بحثان العملاء أنفسهم.",
          "لا يُستهلك شيء أثناء الانتظار، ويُحتسب العميل فقط مقابل كل شخص أو شركة تُسلَّم فعلًا.",
          "وما لم يُستخدم يُعاد إلى رصيدك عند انتهاء البحث.",
        ] },

        { h2: "أدخل أشخاصًا إلى الحملة الآن" },
        { p: "بعد تشغيل الحملة تُقفل جماهيرها الحالية: «هذه الحملة تعمل: لا يمكن تغيير استهداف جماهيرها. أضف جمهورًا جديدًا بدلًا من ذلك.» لذلك تضيف جمهورًا لا يعتمد على المصدر الناقص." },
        { ol: [
          "افتح الحملة ثم **تعديل الحملة** (أو **تعديل** من قائمة الحملة في صفحة **الحملات**).",
          "انتقل إلى خطوة **الجمهور** واضغط **إضافة جمهور**.",
          "اختر جمهورًا لا يعتمد على المصدر الناقص: **استخدام جمهور محفوظ** مع جمهور مخصص (من العملاء أو الاجتماعات أو المهتمين أو حملة سابقة أو ملف CSV)، أو استهدافًا جديدًا إذا كان الجمهور المنتظر مشابهًا أو بحثًا عن أنشطة محلية.",
          "راجع مربع **الجمهور**: يعرض الجمهور المخصص عدد أشخاصه ومن يمكن مراسلتهم بالبريد.",
          "اضغط **حفظ التعديلات**.",
        ] },
        { p: "يضيف الجمهور المخصص أشخاصه فورًا: ينضمون إلى الحملة ويظهرون في عملائها ويتلقون الرسالة الأولى في ساعات الإرسال المحددة لها. ويبقى الجمهور المنتظر في الحملة ويبدأ وحده لاحقًا." },
        { p: "إذا ظهرت «لم يكن في «{name}» أحد للإضافة (كلهم تم التواصل معهم من قبل أو طلبوا عدم التواصل).» فالجمهور المخصص لا يضم إلا أشخاصًا لا تستطيع الحملة مراسلتهم، فاختر مصدرًا آخر." },

        { h2: "أسباب أخرى لانتظار البحث" },
        { table: { head: ["ما تراه", "السبب", "ما يحدث"], rows: [
          ["«انتهت ميزانية اليوم. يكمل يولياس غدًا.»", "استُخدمت ميزانية مساحة العمل لهذا اليوم.", "يكمل البحث في اليوم التالي."],
          ["«نقل يولياس ميزانية هذا الجمهور إلى جماهير نتائجها أفضل. يُراجع مرة أخرى غدًا.»", "جاء هذا الجمهور بنتائج أضعف أو تجاوزت تكلفته الحد.", "يُراجع في اليوم التالي."],
          ["**متوقفة · نفد رصيد العملاء**", "استُخدم عملاء شهرك.", "يكمل وحده بعد شراء عملاء إضافيين أو ترقية الخطة."],
          ["**متوقفة مؤقتاً**", "أوقفت الحملة أنت أو أحد زملائك.", "استأنف الحملة."],
        ] } },

        { h2: "الصلاحيات" },
        { ul: [
          "المدير والمعلن يعدّلان الحملة ويضيفان الجماهير، والمحلل يرى الحالة فقط.",
          "مصادر البيانات يديرها يولياس، ولا يوجد ما تربطه في مساحة عملك لإنهاء الانتظار.",
        ] },

        { h2: "حل المشكلات" },
        { table: { head: ["المشكلة", "ما تفعله"], rows: [
          ["لا أستطيع تعديل الجمهور المنتظر", "هو مقفل لأن الحملة تعمل. أضف جمهورًا جديدًا."],
          ["الجمهور الجديد ينتظر أيضًا", "يستخدم نوع البحث نفسه. استخدم جمهورًا مخصصًا أو نوع بحث مختلفًا."],
          ["الحملة بلا أي أشخاص", "تأكد أن مربع **الجمهور** يعرض أشخاصًا لكل جمهور، وأن الحملة غير متوقفة."],
          ["انتهى الانتظار ولا يزيد العملاء", "ربما تجاوزت الحملة ميزانية اليوم أو نفد رصيد العملاء. راجع بطاقة البحث أو آخر نشاط في الحملة."],
        ] } },

        { h2: "مقالات ذات صلة" },
        { ul: [
          "[الجماهير](/help-center/audiences)",
          "[إنشاء حملة](/help-center/creating-a-campaign)",
          "[عندما لا يقرأ Yolias AI طلبًا](/help-center/search-needs-attention)",
        ] },
      ],
    },
  },

  "search-needs-attention": {
    en: {
      title: "When Yolias AI can't read a request",
      summary: "What the Search Needs Attention card means, what each message on it says, and how to get the request through.",
      updated: "2026-11-05",
      blocks: [
        { p: "Before a search finds anyone, Yolias AI turns the request into search criteria: who, where, what size, which roles. When that step fails, the search shows a card titled **Search Needs Attention** instead of results. Your request is kept. This article lists every message the card can show and what to do about each." },

        { h2: "What the card shows" },
        { ul: [
          "The title **Search Needs Attention**.",
          "One line saying what went wrong (see the table below).",
          "\"Your request is saved. You can retry or edit it above and send again.\"",
          "**Try again**. While it works it reads **Retrying…**.",
        ] },
        { p: "Nothing was searched and no leads were used. The request stays as the first message of the conversation." },

        { h2: "The messages and what to do" },
        { table: { head: ["Message", "What it means", "What to do"], rows: [
          ["Yolias AI isn’t available right now. Try again in a few minutes.", "The AI service wasn't reachable.", "Wait a few minutes, then **Try again**."],
          ["Yolias AI is busy right now. Please try again in a moment.", "Too many requests at once.", "Wait a moment, then **Try again**."],
          ["Yolias AI returned an incomplete answer. Please try again.", "The answer came back cut or unusable.", "**Try again**. If it repeats, make the request shorter and more specific."],
          ["Yolias AI couldn’t process this request. Try rephrasing it.", "The request couldn't be turned into criteria.", "Rephrase it as a new message (see below)."],
          ["Yolias AI request failed. Please try again.", "Any other failure of the step.", "**Try again**."],
          ["Yolias AI credentials are invalid.", "A problem on the Yolias side.", "Contact Yolias support. Retrying won't help until it is fixed."],
          ["Couldn’t start the search.", "The criteria were ready but the search couldn't be created.", "**Try again**. If you have no leads left, buy more first."],
        ] } },

        { h2: "Try again" },
        { ol: [
          "Open the conversation that shows the card.",
          "Press **Try again**.",
          "Yolias AI reads the request again. When it succeeds, the card becomes **Search setup**: \"Here is what Yolias understood. Check it, fill in anything missing, then start the search.\"",
          "Check the fields (what you are looking for, industries, countries, cities, size, roles, how many leads), then press **Start search**.",
        ] },
        { p: "Each retry counts as one of your plan's daily searches: 5 on Free, 50 on Pro, 100 on Growth and 200 on Scale. The count resets at 00:00 UTC. A retry reads the text of the request only; attach a file again in a new message if the request depended on it." },
        { p: "If pressing **Try again** changes nothing, you have reached today's searches, or your role is Analyst. Retry after 00:00 UTC, or ask an Admin or Advertiser." },
        { h3: "When the setup can't start" },
        { ul: [
          "\"The search didn’t start: top up credit or choose a plan first.\" with **Top up or choose a plan**.",
          "\"The search didn’t start: you have no leads left.\" with **Buy more leads**. The setup stays open, so press **Start search** again after buying.",
        ] },

        { h2: "Rephrase the request" },
        { p: "The original request can't be edited in place. Write the corrected request as a new message in the conversation. A request Yolias AI can read names:" },
        { ul: [
          "who: an industry or a kind of business;",
          "where: countries or cities;",
          "how big: a number of employees;",
          "who to reach: the roles.",
        ] },
        { p: "Instead of \"find me customers\", write: \"Real estate developers in Riyadh with 20 to 200 employees, the head of sales.\" Instead of \"restaurants\", write: \"Restaurants and cafes in Dubai Marina, the owner or the general manager.\"" },

        { h2: "Limits on a request" },
        { table: { head: ["Message", "Limit"], rows: [
          ["Keep the request under 4,000 characters.", "4,000 characters per request."],
          ["Tell Yolias who you want to sell to.", "A request needs text or a file."],
          ["Attach up to 3 files.", "3 files per request."],
          ["{name} is larger than 4 MB.", "4 MB for a PDF or text file, 10 MB for an image."],
          ["{name} can’t be read yet. Attach it as PDF, CSV, TXT or an image.", "PDF, CSV, TXT and PNG, JPEG or WebP images."],
          ["{name} is too long to read. Trim it or attach a summary.", "About 200,000 characters of text per file."],
        ] } },
        { p: "Sending the same request twice within two minutes opens the search already started, so a double click or a dropped connection never starts it twice." },

        { h2: "When the search belongs to a campaign" },
        { p: "Each campaign audience that finds new people starts its own search. If that search can't start, the campaign builder shows: \"Yolias couldn't start finding people for “{name}”. Edit its targeting on the campaign page.\" Because a running campaign's audiences are locked, open the campaign, choose **Edit campaign**, press **Add audience**, set the targeting again (a location, an industry and job titles), and press **Save changes**." },

        { h2: "Messages in a Yolias AI chat" },
        { table: { head: ["Message", "What to do"], rows: [
          ["Yolias AI couldn’t answer. Your message is saved; send again to retry.", "Send the message again."],
          ["Yolias AI isn’t connected yet. Your message is saved.", "Send again in a few minutes."],
          ["You’re sending messages too fast. Wait a moment and try again.", "Wait, then send."],
          ["You’ve reached today’s Yolias AI message limit for your plan. It resets at 00:00 UTC.", "Continue after 00:00 UTC, or upgrade."],
          ["Your workspace needs an active plan to use Yolias AI.", "Choose a plan or top up."],
          ["The connection dropped. Check your connection and send again.", "Check your connection and send again."],
        ] } },

        { h2: "Related articles" },
        { ul: [
          "[Yolias AI](/help-center/yolias-ai)",
          "[Audiences](/help-center/audiences)",
          "[A campaign waiting to start](/help-center/awaiting-data-source)",
        ] },
      ],
    },
    ar: {
      title: "عندما لا يقرأ Yolias AI طلبًا",
      summary: "ما معنى بطاقة «البحث يحتاج انتباهك»، وما تقوله كل رسالة عليها، وكيف تمرر الطلب.",
      updated: "2026-11-05",
      blocks: [
        { p: "قبل أن يجد البحث أحدًا يحوّل Yolias AI الطلب إلى معايير بحث: من، وأين، وبأي حجم، وأي المناصب. وإذا فشلت هذه الخطوة تظهر بطاقة بعنوان **البحث يحتاج انتباهك** بدل النتائج، ويبقى طلبك محفوظًا. يسرد هذا المقال كل رسالة قد تظهر على البطاقة وما تفعله مع كل منها." },

        { h2: "ما تعرضه البطاقة" },
        { ul: [
          "العنوان **البحث يحتاج انتباهك**.",
          "سطر يوضح ما حدث (انظر الجدول أدناه).",
          "«تم حفظ طلبك. يمكنك إعادة المحاولة أو تعديله بالأعلى وإرساله مرة أخرى.»",
          "زر **حاول مرة أخرى**، ويظهر عليه **جارٍ إعادة المحاولة…** أثناء العمل.",
        ] },
        { p: "لم يُنفَّذ أي بحث ولم يُستهلك أي عميل، ويبقى الطلب أول رسالة في المحادثة." },

        { h2: "الرسائل وما تفعله" },
        { table: { head: ["الرسالة", "معناها", "ما تفعله"], rows: [
          ["يولياس AI غير متاح الآن. حاول مرة أخرى بعد دقائق.", "تعذر الوصول إلى خدمة الذكاء الاصطناعي.", "انتظر دقائق ثم اضغط **حاول مرة أخرى**."],
          ["يولياس AI مشغول حاليًا. حاول بعد قليل.", "طلبات كثيرة في وقت واحد.", "انتظر قليلًا ثم **حاول مرة أخرى**."],
          ["أعاد يولياس AI إجابة غير مكتملة. حاول مرة أخرى.", "عادت الإجابة ناقصة أو غير صالحة.", "**حاول مرة أخرى**، وإن تكرر فاجعل الطلب أقصر وأدق."],
          ["تعذّر على يولياس AI معالجة هذا الطلب. جرّب صياغته بشكل مختلف.", "لم يمكن تحويل الطلب إلى معايير.", "أعد صياغته في رسالة جديدة (انظر أدناه)."],
          ["فشل طلب يولياس AI. حاول مرة أخرى.", "أي فشل آخر في هذه الخطوة.", "**حاول مرة أخرى**."],
          ["بيانات اعتماد يولياس AI غير صالحة.", "مشكلة من جهة يولياس.", "تواصل مع دعم يولياس، فإعادة المحاولة لن تفيد قبل إصلاحها."],
          ["تعذّر بدء البحث.", "المعايير جاهزة لكن تعذر إنشاء البحث.", "**حاول مرة أخرى**، وإن نفد رصيد العملاء فاشترِ عملاء أولًا."],
        ] } },

        { h2: "أعد المحاولة" },
        { ol: [
          "افتح المحادثة التي تظهر فيها البطاقة.",
          "اضغط **حاول مرة أخرى**.",
          "يقرأ Yolias AI الطلب من جديد، وعند النجاح تتحول البطاقة إلى **إعداد البحث**: «هذا ما فهمه يولياس من طلبك. راجعه وأكمل الناقص، ثم ابدأ البحث.»",
          "راجع الحقول (عمّ تبحث، والمجالات، والدول، والمدن، والحجم، والمناصب، وعدد العملاء)، ثم اضغط **ابدأ البحث**.",
        ] },
        { p: "كل إعادة محاولة تُحسب بحثًا من بحوث خطتك اليومية: 5 في الخطة المجانية، و50 في Pro، و100 في Growth، و200 في Scale، ويتجدد العدد الساعة 00:00 بتوقيت UTC. وإعادة المحاولة تقرأ نص الطلب فقط، فإذا كان الطلب يعتمد على ملف فأرفقه مجددًا في رسالة جديدة." },
        { p: "إذا لم يتغير شيء بعد الضغط على **حاول مرة أخرى** فقد استنفدت بحوث اليوم أو أن دورك محلل. أعد المحاولة بعد 00:00 بتوقيت UTC، أو اطلب ذلك من مدير أو معلن." },
        { h3: "عندما لا يبدأ إعداد البحث" },
        { ul: [
          "«لم يبدأ البحث: اشحن رصيدك أو اختر خطة أولًا.» ومعها **اشحن رصيدك أو اختر خطة**.",
          "«لم يبدأ البحث: لا يتبقى لديك عملاء.» ومعها **شراء عملاء**. ويبقى الإعداد مفتوحًا، فاضغط **ابدأ البحث** مجددًا بعد الشراء.",
        ] },

        { h2: "أعد صياغة الطلب" },
        { p: "لا يمكن تعديل الطلب الأصلي في مكانه، فاكتب الطلب المصحح كرسالة جديدة في المحادثة. والطلب الذي يقرؤه Yolias AI بسهولة يذكر:" },
        { ul: [
          "من: مجالًا أو نوع نشاط؛",
          "أين: دولًا أو مدنًا؛",
          "بأي حجم: عدد الموظفين؛",
          "من تريد الوصول إليه: المناصب.",
        ] },
        { p: "بدل «جد لي عملاء» اكتب: «مطورون عقاريون في الرياض من 20 إلى 200 موظف، مدير المبيعات.» وبدل «مطاعم» اكتب: «مطاعم ومقاهٍ في دبي مارينا، المالك أو المدير العام.»" },

        { h2: "حدود الطلب" },
        { table: { head: ["الرسالة", "الحد"], rows: [
          ["اجعل الطلب أقل من 4,000 حرف.", "4,000 حرف للطلب."],
          ["أخبر يولياس لمن تريد أن تبيع.", "يحتاج الطلب إلى نص أو ملف."],
          ["أرفق 3 ملفات كحد أقصى.", "3 ملفات للطلب."],
          ["حجم {name} أكبر من 4 ميجابايت.", "4 ميجابايت لملف PDF أو نص، و10 ميجابايت للصورة."],
          ["لا يمكن قراءة {name} بعد. أرفقه بصيغة PDF أو CSV أو TXT أو صورة.", "PDF وCSV وTXT وصور PNG وJPEG وWebP."],
          ["الملف {name} طويل جدًا للقراءة. اختصره أو أرفق ملخصًا.", "نحو 200,000 حرف من النص للملف."],
        ] } },
        { p: "إرسال الطلب نفسه مرتين خلال دقيقتين يفتح البحث الذي بدأ بالفعل، فالنقر المزدوج أو انقطاع الاتصال لا يبدأ البحث مرتين." },

        { h2: "عندما يتبع البحث حملة" },
        { p: "كل جمهور في حملة يبحث عن أشخاص جدد يبدأ بحثه الخاص. وإذا تعذر بدء هذا البحث يعرض بناء الحملة: «تعذّر على يولياس بدء إيجاد أشخاص لـ «{name}». عدّل استهدافه من صفحة الحملة.» ولأن جماهير الحملة العاملة مقفلة، افتح الحملة واختر **تعديل الحملة**، واضغط **إضافة جمهور**، واضبط الاستهداف من جديد (موقع ومجال ومسميات وظيفية)، ثم اضغط **حفظ التعديلات**." },

        { h2: "رسائل محادثة Yolias AI" },
        { table: { head: ["الرسالة", "ما تفعله"], rows: [
          ["تعذّر على Yolias AI الرد. تم حفظ رسالتك؛ أرسل مرة أخرى للمحاولة.", "أرسل الرسالة مرة أخرى."],
          ["Yolias AI غير متصل بعد. تم حفظ رسالتك.", "أرسل مجددًا بعد دقائق."],
          ["ترسل رسائل بسرعة كبيرة. انتظر قليلًا ثم حاول مجددًا.", "انتظر ثم أرسل."],
          ["وصلت إلى الحد اليومي لرسائل Yolias AI في خطتك. يتجدد الحد الساعة 00:00 بتوقيت UTC.", "تابع بعد 00:00 بتوقيت UTC أو رقِّ خطتك."],
          ["تحتاج مساحة العمل إلى خطة فعّالة لاستخدام Yolias AI.", "اختر خطة أو اشحن رصيدك."],
          ["انقطع الاتصال. تحقّق من اتصالك ثم أرسل مرة أخرى.", "تحقق من اتصالك وأرسل مجددًا."],
        ] } },

        { h2: "مقالات ذات صلة" },
        { ul: [
          "[Yolias AI](/help-center/yolias-ai)",
          "[الجماهير](/help-center/audiences)",
          "[حملة تنتظر البدء](/help-center/awaiting-data-source)",
        ] },
      ],
    },
  },
};
