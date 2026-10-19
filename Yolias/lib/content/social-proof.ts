import type { Localized } from "./types";

// Social proof on the website (2026-10-12). Every section below renders only
// when real, approved data is filled in here; nothing is shown otherwise.
// Rules (owner's brief): real logos used with permission only, no invented
// companies, numbers, reviews or endorsements.

/**
 * Customer logos under the pricing cards ("Trusted by businesses that are
 * serious about growth."). Put the file in public/brand/customers/ and add
 * it only with the customer's written permission. Width/height are the
 * file's real size (no layout shift).
 */
export const trustLogos: { name: string; src: string; width: number; height: number }[] = [];

/**
 * The customer count on the home page. Fill it in only after checking the
 * production numbers, and say what is counted (registered accounts, active
 * users, paying customers or companies), e.g.
 * { label: "10,000+", basis: { en: "registered accounts", ar: "حساب مسجّل" }, checkedOn: "2026-10-12" }.
 */
export const customerCount: { label: string; basis: Localized<string>; checkedOn: string } | null = null;

/** Public Product Hunt page of Yolias, once it exists. */
export const PRODUCT_HUNT_URL: string | null = null;

/** Customer reviews: removed from the site for now (owner, 2026-10-19). */
export interface Testimonial {
  name: string;
  /** Job title and company, only when confirmed. */
  role?: Localized<string>;
  quote: Localized<string>;
  /** Optional photo in public/brand/testimonials/, used with permission. */
  photo?: string;
  /** Star rating the customer gave (1–5), when it comes from a real review. */
  rating?: number;
}
export const testimonials: Testimonial[] = [];

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
    ar: "عشتُ هذه المشكلة بنفسي: ساعات كل أسبوع في بناء القوائم، وتخمين من هو صاحب القرار الصحيح، وكتابة رسائل لا يرد عليها أحد. بنيتُ يولـياس لتتجاوز هذا الجزء وتقضي وقتك في الحديث مع العملاء الذين يحتاجون فعلًا ما تبيعه.",
  },
};
