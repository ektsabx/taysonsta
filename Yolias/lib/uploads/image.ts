// Image uploads (D-182): PNG, JPEG or WebP, up to 10 MB (10 × 1024 × 1024
// bytes), everywhere Yolias takes an image. The browser checks first for
// quick feedback; the server checks again on the real bytes (file
// signature), never trusting the file name or the type the browser sends.

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
export type ImageType = "image/png" | "image/jpeg" | "image/webp";

/** The real type from the first bytes, or null if it isn't PNG, JPEG or WebP. */
export function sniffImageType(b: Uint8Array): ImageType | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

/** Quick check in the browser (the server repeats it on the bytes). */
export function checkImageFile(f: { size: number; type: string }): "type" | "size" | null {
  if (!IMAGE_ACCEPT.split(",").includes(f.type)) return "type";
  if (f.size > IMAGE_MAX_BYTES) return "size";
  if (f.size === 0) return "type";
  return null;
}

/** Server check of an uploaded file: its real type, or the reason it's refused. */
export async function verifyImageFile(f: Blob): Promise<{ ok: true; type: ImageType } | { ok: false; error: "type" | "size" }> {
  if (f.size === 0) return { ok: false, error: "type" };
  if (f.size > IMAGE_MAX_BYTES) return { ok: false, error: "size" };
  const type = sniffImageType(new Uint8Array(await f.slice(0, 16).arrayBuffer()));
  return type ? { ok: true, type } : { ok: false, error: "type" };
}
