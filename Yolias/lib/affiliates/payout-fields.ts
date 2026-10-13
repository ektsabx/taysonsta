// Yolias Partners payout details (D-210): each payout method asks for its own
// fields instead of one free-text box. The details are stored on the
// affiliate as readable "Label: value" lines (English labels), which is what
// the finance team reads in the Admin when sending a payout, and parsed back
// here to fill the form. Pure: used by the form and by the server action.

export type PayoutFieldKey = "email" | "holder" | "bank" | "account" | "swift" | "country" | "phone" | "instapay" | "details";
export interface PayoutField { key: PayoutFieldKey; kind: "email" | "text" | "tel" | "textarea"; required: boolean; ltr?: boolean }

const LABELS: Record<PayoutFieldKey, string> = {
  email: "Email", holder: "Account holder", bank: "Bank name", account: "IBAN / account number", swift: "SWIFT / BIC",
  country: "Bank country", phone: "Wallet phone number", instapay: "InstaPay address", details: "Details",
};

const FIELDS: Record<string, PayoutField[]> = {
  paypal: [{ key: "email", kind: "email", required: true, ltr: true }],
  wise: [{ key: "email", kind: "email", required: true, ltr: true }, { key: "holder", kind: "text", required: true }],
  bank_transfer: [
    { key: "holder", kind: "text", required: true },
    { key: "bank", kind: "text", required: true },
    { key: "account", kind: "text", required: true, ltr: true },
    { key: "swift", kind: "text", required: false, ltr: true },
    { key: "country", kind: "text", required: true },
  ],
  instapay: [{ key: "instapay", kind: "text", required: true, ltr: true }, { key: "holder", kind: "text", required: true }],
  vodafone_cash: [{ key: "phone", kind: "tel", required: true, ltr: true }, { key: "holder", kind: "text", required: true }],
};

/** The fields a payout method asks for; a method the Admin added without a known shape gets one details box. */
export function payoutFields(method: string): PayoutField[] {
  return FIELDS[method] ?? [{ key: "details", kind: "textarea", required: true }];
}

export type PayoutValues = Partial<Record<PayoutFieldKey, string>>;

export function serializePayout(method: string, values: PayoutValues): string {
  return payoutFields(method)
    .map((f) => [f, (values[f.key] ?? "").replace(/\s+/g, " ").trim()] as const)
    .filter(([, v]) => v)
    .map(([f, v]) => (f.key === "details" ? v : `${LABELS[f.key]}: ${v}`))
    .join("\n");
}

export function parsePayout(method: string, details: string | null): PayoutValues {
  const fields = payoutFields(method);
  if (!details) return {};
  if (fields.length === 1 && fields[0].key === "details") return { details };
  const out: PayoutValues = {};
  for (const line of details.split("\n")) {
    const i = line.indexOf(": ");
    if (i < 0) continue;
    const f = fields.find((x) => LABELS[x.key] === line.slice(0, i));
    if (f) out[f.key] = line.slice(i + 2);
  }
  return out;
}

/** Server-side check of the submitted fields. */
export function checkPayout(method: string, values: PayoutValues): { ok: true; details: string } | { ok: false; field: PayoutFieldKey } {
  for (const f of payoutFields(method)) {
    const v = (values[f.key] ?? "").trim();
    if (f.required && !v) return { ok: false, field: f.key };
    if (v.length > 300 && f.key !== "details") return { ok: false, field: f.key };
    if (v && f.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return { ok: false, field: f.key };
    if (v && f.kind === "tel" && !/^\+?[0-9 ()-]{7,20}$/.test(v)) return { ok: false, field: f.key };
  }
  const details = serializePayout(method, values);
  return details.length >= 3 && details.length <= 1000 ? { ok: true, details } : { ok: false, field: payoutFields(method)[0].key };
}
