// RS256 JWT signing with Web Crypto (works in Node and Workers) for provider
// service-account grants such as DocuSign JWT. Accepts PKCS#8
// ("BEGIN PRIVATE KEY") or PKCS#1 ("BEGIN RSA PRIVATE KEY") PEM keys; PKCS#1
// is wrapped into PKCS#8 because Web Crypto only imports the latter.

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const enc = new TextEncoder();

function derLength(n: number): number[] {
  if (n < 0x80) return [n];
  const out: number[] = [];
  while (n > 0) { out.unshift(n & 0xff); n >>= 8; }
  return [0x80 | out.length, ...out];
}

function der(tag: number, content: Uint8Array | number[]): Uint8Array {
  const c = content instanceof Uint8Array ? [...content] : content;
  return Uint8Array.from([tag, ...derLength(c.length), ...c]);
}

export function pemToPkcs8(pem: string): Uint8Array {
  const m = pem.replace(/\\n/g, "\n").match(/-----BEGIN ([A-Z ]+)-----([\s\S]+?)-----END \1-----/);
  if (!m) throw new Error("Invalid PEM private key");
  const bytes = Uint8Array.from(atob(m[2].replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  if (m[1] === "PRIVATE KEY") return bytes;
  if (m[1] !== "RSA PRIVATE KEY") throw new Error(`Unsupported key type: ${m[1]}`);
  // PrivateKeyInfo ::= SEQUENCE { version 0, AlgorithmIdentifier rsaEncryption, OCTET STRING pkcs1 }
  const version = der(0x02, [0x00]);
  const algId = der(0x30, [...der(0x06, [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]), 0x05, 0x00]);
  return der(0x30, [...version, ...algId, ...der(0x04, bytes)]);
}

export async function signJwtRS256(claims: Record<string, unknown>, pem: string): Promise<string> {
  const key = await crypto.subtle.importKey("pkcs8", pemToPkcs8(pem) as BufferSource, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const head = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const body = b64url(enc.encode(JSON.stringify(claims)));
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${head}.${body}`)));
  return `${head}.${body}.${b64url(sig)}`;
}
