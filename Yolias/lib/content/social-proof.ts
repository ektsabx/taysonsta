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

/**
 * Customer reviews ("Loved by marketers around the world"). Real reviews
 * only, with the person's permission to show their name (and photo).
 */
export interface Testimonial {
  name: string;
  /** Job title and company, only when confirmed. */
  role?: Localized<string>;
  quote: Localized<string>;
  /** Optional photo in public/brand/testimonials/, used with permission. */
  photo?: string;
}
export const testimonials: Testimonial[] = [];
