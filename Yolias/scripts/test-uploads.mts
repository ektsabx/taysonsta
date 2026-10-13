// Image uploads (D-182): npm run test:uploads
// PNG, JPEG and WebP up to 10 MB are accepted by their real bytes; other
// files, renamed files, a declared type that doesn't match and anything over
// 10 MB are refused — by the app's server checks and by Storage itself.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { IMAGE_MAX_BYTES, checkImageFile, sniffImageType, verifyImageFile } from "@/lib/uploads/image.ts";
import { AttachmentError, readAttachments } from "@/lib/attachments.ts";
import type { Database } from "@/types/database.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
assert.match(url, /127\.0\.0\.1|localhost/, "local database only");
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0]);
const text = new TextEncoder().encode("<svg onload=alert(1)>not an image</svg>");
const big = (head: Uint8Array, size: number) => { const b = new Uint8Array(size); b.set(head); return b; };

assert.equal(sniffImageType(png), "image/png");
assert.equal(sniffImageType(jpg), "image/jpeg");
assert.equal(sniffImageType(webp), "image/webp");
assert.equal(sniffImageType(gif), null, "GIF isn't accepted");
assert.equal(sniffImageType(text), null);
assert.equal(checkImageFile({ size: 100, type: "image/gif" }), "type");
assert.equal(checkImageFile({ size: IMAGE_MAX_BYTES + 1, type: "image/png" }), "size");
assert.equal(checkImageFile({ size: IMAGE_MAX_BYTES, type: "image/webp" }), null, "exactly 10 MB is allowed");

assert.deepEqual(await verifyImageFile(new Blob([png], { type: "text/plain" })), { ok: true, type: "image/png" }, "type from bytes, not from the browser");
assert.deepEqual(await verifyImageFile(new Blob([text], { type: "image/png" })), { ok: false, error: "type" }, "a declared image type isn't trusted");
assert.deepEqual(await verifyImageFile(new Blob([big(jpg, IMAGE_MAX_BYTES + 1)], { type: "image/jpeg" })), { ok: false, error: "size" });
assert.deepEqual(await verifyImageFile(new Blob([big(jpg, IMAGE_MAX_BYTES)], { type: "image/jpeg" })), { ok: true, type: "image/jpeg" });

// Composer attachments (sent to Yolias AI).
const file = (b: Uint8Array, name: string, type: string) => new File([b as Uint8Array<ArrayBuffer>], name, { type });
const ok = await readAttachments([file(png, "shot.png", "image/png"), file(webp, "renamed.txt", "text/plain")]);
assert.deepEqual(ok.map((a) => [a.kind, a.mediaType]), [["image", "image/png"], ["image", "image/webp"]]);
await assert.rejects(readAttachments([file(gif, "a.gif", "image/gif")]), AttachmentError);
await assert.rejects(readAttachments([file(text, "fake.png", "image/png")]), AttachmentError);
await assert.rejects(readAttachments([file(big(png, IMAGE_MAX_BYTES + 1), "huge.png", "image/png")]), AttachmentError);

// Storage refuses what the buckets don't allow, even when called directly.
const uid = crypto.randomUUID();
const tooBig = await db.storage.from("avatars").upload(`${uid}/x.png`, big(png, IMAGE_MAX_BYTES + 1024), { contentType: "image/png" });
assert.ok(tooBig.error, "over 10 MB refused by Storage");
const wrongType = await db.storage.from("avatars").upload(`${uid}/x.gif`, gif, { contentType: "image/gif" });
assert.ok(wrongType.error, "GIF refused by Storage");
const good = await db.storage.from("bug-screenshots").upload(`${uid}/ok.png`, png, { contentType: "image/png" });
assert.ok(!good.error, "PNG accepted");
await db.storage.from("bug-screenshots").remove([`${uid}/ok.png`]);
console.log("✓ uploads: PNG/JPEG/WebP by real bytes, GIF and disguised files refused, 10 MB limit in the app and in Storage");
