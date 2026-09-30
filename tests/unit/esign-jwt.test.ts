import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { pemToPkcs8, signJwtRS256 } from "@/lib/bos/esign/jwt";

// Master upgrade Phase 14 (docs/bos/30 §19): DocuSign JWT grant signing —
// PKCS#8 and PKCS#1 keys, verified with Node's crypto.
test("RS256 JWT verifies with the public key for PKCS#8 and PKCS#1 PEMs", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  for (const type of ["pkcs8", "pkcs1"] as const) {
    const pem = privateKey.export({ type, format: "pem" }).toString();
    const jwt = await signJwtRS256({ iss: "ik", sub: "user", aud: "account-d.docusign.com", iat: 1, exp: 2, scope: "signature impersonation" }, pem);
    const [h, b, s] = jwt.split(".");
    assert.deepEqual(JSON.parse(Buffer.from(h, "base64url").toString()), { alg: "RS256", typ: "JWT" });
    assert.equal(JSON.parse(Buffer.from(b, "base64url").toString()).scope, "signature impersonation");
    const v = createVerify("RSA-SHA256");
    v.update(`${h}.${b}`);
    assert.equal(v.verify(publicKey, Buffer.from(s, "base64url")), true, type);
  }
});

test("escaped newlines (as pasted into a single-line field) and bad keys", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString().replace(/\n/g, "\\n");
  assert.ok(pemToPkcs8(pem).length > 100);
  assert.throws(() => pemToPkcs8("not a key"));
  assert.throws(() => pemToPkcs8("-----BEGIN EC PRIVATE KEY-----\nAAAA\n-----END EC PRIVATE KEY-----"));
});
