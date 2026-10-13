"use client";

// Large photos sent to Yolias AI are made smaller in the browser first
// (AI providers limit image size): longest side 2400 px, WebP. Files that
// are already small enough are sent unchanged.

const TARGET_BYTES = 4 * 1024 * 1024;

export async function shrinkForAi(file: File): Promise<File> {
  if (file.size <= TARGET_BYTES || typeof createImageBitmap !== "function") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    for (const q of [0.85, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", q));
      if (blob && blob.size <= TARGET_BYTES) return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
    }
  } catch {
    // Keep the original; the server applies the 10 MB limit.
  }
  return file;
}
