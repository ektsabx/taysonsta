// Facebook's standard events, grouped by the website objective they serve (D-274).
// Shared by the server (lib/pixel.ts) and the campaign builder.
export const PURCHASE_EVENTS = ["Purchase", "InitiateCheckout", "AddPaymentInfo", "AddToCart", "AddToWishlist", "ViewContent", "Search", "CustomizeProduct", "StartTrial", "Subscribe", "Donate"] as const;
export const LEAD_EVENTS = ["Lead", "CompleteRegistration", "Activated", "Contact", "SubmitApplication", "Schedule", "FindLocation", "StartTrial", "Subscribe"] as const;
