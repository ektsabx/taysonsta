import type { Localized } from "./types";

// The founder's note on the home page (owner brief 2026-10-19). Customer
// logos, the customer count and reviews were removed (owner, 2026-10-28):
// nothing about customers is shown until the owner asks for it again.

/**
 * A message from the founder on the home page (owner brief 2026-10-19):
 * photo, name, job title and a short note. Shown only once filled in; the
 * photo goes in public/brand/team/.
 */
export const founderNote: { name: string; title: Localized<string>; photo: string; message: Localized<string> } | null = {
  name: "Youseef Waleed",
  title: { en: "Founder", ar: "المؤسس" },
  photo: "/brand/team/youseef-waleed.jpg",
  message: {
    en: "I lived this problem myself: hours every week building lists, guessing who the right decision maker was, and writing messages that never got a reply. I built Yolias so you can skip that part and spend your time talking to the customers who actually need what you sell.",
    ar: "عشتُ هذه المشكلة بنفسي: ساعات كل أسبوع في بناء القوائم، وتخمين من هو صاحب القرار الصحيح، وكتابة رسائل لا يرد عليها أحد. بنيتُ يولياس لتتجاوز هذا الجزء وتقضي وقتك في الحديث مع العملاء الذين يحتاجون فعلًا ما تبيعه.",
  },
};
