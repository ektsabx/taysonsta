// Creates or reprices the six Polar plan products now (D-191), with the token
// saved in Admin → Integrations → Polar (read from this database's Vault).
// Prints the environment and the product names only, never a key:
//   npx tsx --conditions=react-server --tsconfig tsconfig.json scripts/polar-products.mts
import { loadPolar, productKeys } from "@/lib/payments/polar.ts";
import { ensurePolarProducts } from "@/lib/payments/polar-products.ts";
import { createPolar } from "@polar-sh/sdk/2026-10";

const cfg = await loadPolar();
if (!cfg) {
  console.log("Polar is not connected: no token in Admin → Integrations → Polar.");
  process.exit(1);
}
const r = await ensurePolarProducts(cfg);
console.log(`environment: ${cfg.environment}`);
if (!r.ok) {
  console.log("sync failed (check that the token matches the environment and has products:write).");
  process.exit(1);
}
console.log(`created: ${r.created}, repriced: ${r.repriced}`);
const polar = createPolar({ accessToken: cfg.accessToken, environment: cfg.environment });
for (const k of productKeys) {
  const p = await polar.products.get(r.cfg.products[k]!);
  const price = p.prices.find((x) => (x as { amount_type?: string; is_archived?: boolean }).amount_type === "fixed" && !(x as { is_archived?: boolean }).is_archived) as { price_amount?: number } | undefined;
  console.log(`${k.padEnd(15)} ${p.name}: $${((price?.price_amount ?? 0) / 100).toLocaleString("en-US")}/${p.recurring_interval}`);
}
