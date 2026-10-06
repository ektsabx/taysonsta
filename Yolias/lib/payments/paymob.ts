import { createHmac, timingSafeEqual } from "node:crypto";
import type { Currency } from "@/types/database";
import type { CheckoutRequest, PaymentOutcome } from "./types";

// Paymob adapter, pure parts (unit-tested). Verified against Paymob's docs
// (developers.paymob.com): Intention API → Unified Checkout redirect; the
// "transaction processed" callback (POST JSON {type, obj}) and the
// "transaction response" redirect (GET query) are signed with HMAC-SHA512
// over 20 fields, delivered as the `hmac` query parameter.

export interface PaymobConfig {
  baseUrl: string;                                  // https://accept.paymob.com (Egypt) or the account's region
  publicKey: string;
  secretKey: string;
  hmacSecret: string;
  /** Integration ids (payment methods) per currency. */
  integrations: Partial<Record<Currency, number[]>>;
}

/** POST /v1/intention/ body. Amounts are in minor units (cents / piasters). */
export function intentionBody(req: CheckoutRequest, cfg: Pick<PaymobConfig, "integrations">) {
  const amount = toMinor(req.amount);
  const [first, ...rest] = (req.customer.name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    amount,
    currency: req.currency,
    payment_methods: cfg.integrations[req.currency] ?? [],
    items: [{ name: req.description.slice(0, 50), amount, description: req.description.slice(0, 255), quantity: 1 }],
    // Paymob requires these billing fields; "NA" is its documented placeholder for unknown values.
    billing_data: {
      first_name: first || "NA",
      last_name: rest.join(" ") || "NA",
      email: req.customer.email,
      phone_number: req.customer.phone || "NA",
      country: req.customer.country || "NA",
    },
    special_reference: req.paymentId,
    notification_url: req.notifyUrl,
    redirection_url: req.returnUrl,
  };
}

export function checkoutUrl(baseUrl: string, publicKey: string, clientSecret: string): string {
  const u = new URL("/unifiedcheckout/", baseUrl);
  u.searchParams.set("publicKey", publicKey);
  u.searchParams.set("clientSecret", clientSecret);
  return u.toString();
}

export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

const HMAC_KEYS = [
  "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction", "id", "integration_id",
  "is_3d_secure", "is_auth", "is_capture", "is_refunded", "is_standalone_payment", "is_voided", "order.id", "owner",
  "pending", "source_data.pan", "source_data.sub_type", "source_data.type", "success",
] as const;

type Obj = Record<string, unknown>;

function pick(obj: Obj, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Obj)[k] : undefined), obj);
}

const str = (v: unknown) => (v === undefined || v === null ? "" : typeof v === "boolean" ? String(v) : String(v));

/** The string Paymob signs, from the POST callback's `obj`. */
export function hmacStringFromTransaction(obj: Obj): string {
  return HMAC_KEYS.map((k) => str(pick(obj, k))).join("");
}

/** The string Paymob signs, from the GET redirect's query (flat keys; `order` instead of `order.id`). */
export function hmacStringFromQuery(q: URLSearchParams): string {
  return HMAC_KEYS.map((k) => q.get(k === "order.id" ? "order" : k) ?? "").join("");
}

export function signPaymob(data: string, secret: string): string {
  return createHmac("sha512", secret).update(data).digest("hex");
}

export function hmacMatches(data: string, secret: string, received: string | null): boolean {
  if (!received || !secret) return false;
  const want = Buffer.from(signPaymob(data, secret), "utf8");
  const got = Buffer.from(received.toLowerCase(), "utf8");
  return want.length === got.length && timingSafeEqual(want, got);
}

function outcome(get: (k: string) => unknown, orderId: unknown, merchantRef: unknown): PaymentOutcome {
  const yes = (k: string) => str(get(k)) === "true";
  const status: PaymentOutcome["status"] =
    yes("is_refunded") || yes("is_voided") ? "refunded" : yes("pending") ? "pending" : yes("success") ? "succeeded" : "failed";
  const msg = str(get("data.message")) || str(get("data_message")) || str(get("txn_response_code"));
  return {
    providerRef: str(orderId) || null,
    merchantRef: str(merchantRef) || null,
    providerTxn: str(get("id")),
    status,
    amountMinor: Number(get("amount_cents")),
    currency: str(get("currency")),
    reason: status === "failed" ? msg || null : null,
  };
}

/** Normalised result of a POST "transaction processed" callback. */
export function outcomeFromTransaction(obj: Obj): PaymentOutcome {
  return outcome((k) => pick(obj, k), pick(obj, "order.id"), pick(obj, "order.merchant_order_id") ?? pick(obj, "special_reference"));
}

/** Normalised result of the GET redirect back to Yolias. */
export function outcomeFromQuery(q: URLSearchParams): PaymentOutcome {
  return outcome((k) => q.get(k) ?? undefined, q.get("order"), q.get("merchant_order_id"));
}
