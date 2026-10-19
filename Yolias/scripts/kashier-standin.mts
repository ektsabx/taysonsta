// A local stand-in for Kashier's APIs (D-235), shared by the payment tests.
// Nothing is charged and nothing leaves this machine: lib/payments/kashier.ts
// is pointed at it with KASHIER_API_URL / KASHIER_FEP_URL. It checks the same
// headers and hashes Kashier checks, so a wrong key or hash fails here too.
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export const KASHIER = { merchantId: "MID-1234-567", apiKey: "local-kashier-api-key", secretKey: "local-kashier-secret-key" };

const hmac = (text: string, key = KASHIER.apiKey) => createHmac("sha256", key).update(text).digest("hex");

export interface StandIn {
  base: string;
  sessions: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  /** What GET …/sessions/{id}/payment answers, per session id. */
  sessionState: Map<string, Record<string, unknown>>;
  /** Cards saved per customer reference. */
  cards: Map<string, { cardToken: string; number: string; brand: string }>;
  /** The next token charge is declined. */
  declineNext: { on: boolean };
  close: () => void;
}

export async function startKashierStandIn(): Promise<StandIn> {
  let seq = Date.now() % 1e9;
  const s: Omit<StandIn, "base" | "close"> = { sessions: [], orders: [], sessionState: new Map(), cards: new Map(), declineNext: { on: false } };
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const u = new URL(req.url ?? "/", "http://x");
      const json = (code: number, v: unknown) => res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(v));
      const authed = req.headers.authorization === KASHIER.secretKey && req.headers["api-key"] === KASHIER.apiKey;
      if (req.method === "POST" && u.pathname === "/v3/payment/sessions") {
        if (!authed) return json(401, { message: "unauthorized" });
        const b = JSON.parse(body) as Record<string, unknown>;
        s.sessions.push(b);
        const id = `sess_${++seq}`;
        return json(201, { _id: id, sessionUrl: `https://payments.kashier.io/session/${id}?mode=test` });
      }
      const m = u.pathname.match(/^\/v3\/payment\/sessions\/([^/]+)\/payment$/);
      if (req.method === "GET" && m) {
        if (!authed) return json(401, { message: "unauthorized" });
        return json(200, { data: s.sessionState.get(m[1]) ?? { paymentStatus: "PENDING" } });
      }
      if (req.method === "GET" && u.pathname === "/v3/cards/customer") {
        const ref = u.searchParams.get("customerReference") ?? "";
        if (req.headers["kashier-hash"] !== hmac(`/?tokenization=${KASHIER.merchantId}.${ref}`)) return json(403, { status: "FAILURE" });
        const c = s.cards.get(ref);
        return json(200, { status: "SUCCESS", response: { paymentMethods: c ? [{ type: "CARD", customer: { reference: ref }, card: { cardToken: c.cardToken, number: c.number, brand: c.brand, expiry: { month: "12", year: "30" } } }] : [] } });
      }
      if (req.method === "POST" && u.pathname === "/v3/orders/") {
        const b = JSON.parse(body) as { order: { reference: string; amount: string; currency: string }; customer: { reference: string }; paymentMethod: { card: { cardToken: string } } };
        if (req.headers["kashier-hash"] !== hmac(`/?payment=${KASHIER.merchantId}.${b.order.reference}.${b.order.amount}.${b.order.currency}.${b.customer.reference}`)) return json(403, { status: "FAILURE", messages: { en: "bad hash" } });
        s.orders.push(b as unknown as Record<string, unknown>);
        const known = [...s.cards.values()].some((c) => c.cardToken === b.paymentMethod.card.cardToken);
        if (!known || s.declineNext.on) {
          s.declineNext.on = false;
          return json(200, { status: "FAILURE", response: { status: "FAILURE", message: "Do not honour" }, messages: { en: "Do not honour" } });
        }
        return json(200, { status: "SUCCESS", response: { status: "SUCCESS", transactionId: `TX-${++seq}`, orderId: `KO-${seq}` } });
      }
      json(404, {});
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.KASHIER_API_URL = base;
  process.env.KASHIER_FEP_URL = base;
  return { ...s, base, close: () => server.close() };
}

/** RFC 3986 encoding, written out here so the test doesn't reuse the code it checks. */
const enc = (v: string) => encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** A webhook body signed the way Kashier signs it. */
export function signedWebhook(event: string, data: Record<string, unknown>, key = KASHIER.apiKey) {
  const keys = Object.keys(data).sort();
  const full = { ...data, signatureKeys: keys, hash: "internal-kashier-hash" };
  const signature = hmac(keys.map((k) => `${k}=${enc(String(data[k]))}`).join("&"), key);
  return { body: JSON.stringify({ event, data: full }), signature };
}
