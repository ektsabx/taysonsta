import "server-only";

/** No payment provider yet: plans can only be activated when this is on (local/dev). */
export function billingTestMode(): boolean {
  return process.env.BILLING_TEST_MODE === "true";
}
