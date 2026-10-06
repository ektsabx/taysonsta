import type { Currency } from "@/types/database";

// Provider-agnostic payment contracts (final spec phase 3). Product code
// talks to lib/payments; each provider is an adapter behind it (Paymob now,
// Stripe later), like the Intelligence Layer's providers (rule 11).

export interface CheckoutRequest {
  /** Our payments.id — the provider echoes it back as the merchant reference. */
  paymentId: string;
  amount: number;
  currency: Currency;
  description: string;
  customer: { email: string; name: string | null; phone?: string | null; country?: string | null };
  /** Where the provider sends the customer back. */
  returnUrl: string;
  /** Server-to-server callback (webhook). */
  notifyUrl: string;
}

export interface CheckoutSession {
  redirectUrl: string;
  /** The provider's order / intention id, stored on the payment. */
  providerRef: string;
}

export interface PaymentOutcome {
  providerRef: string | null;
  merchantRef: string | null;
  providerTxn: string;
  status: "succeeded" | "failed" | "pending" | "refunded";
  /** Minor units (cents / piasters) as charged. */
  amountMinor: number;
  currency: string;
  reason: string | null;
}
