import "server-only";
import type { StrategyAttachment } from "@/lib/ai/strategy";

export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;

const imageTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const textExt = /\.(csv|txt|md|tsv)$/i;

export type AttachmentErrorCode = "fileTooLarge" | "fileTooLong" | "fileUnsupported" | "tooManyFiles";

/** Carries a dictionary key (strategy.errors.*) plus its placeholder values. */
export class AttachmentError extends Error {
  constructor(public code: AttachmentErrorCode, public vars: Record<string, string | number>) {
    super(code);
  }
}

// Turns uploaded ICP files / screenshots into content Yolias AI can read.
export async function readAttachments(files: File[]): Promise<StrategyAttachment[]> {
  const real = files.filter((f) => f.size > 0);
  if (real.length > MAX_ATTACHMENTS) throw new AttachmentError("tooManyFiles", { count: MAX_ATTACHMENTS });

  const out: StrategyAttachment[] = [];
  for (const f of real) {
    if (f.size > MAX_ATTACHMENT_BYTES) throw new AttachmentError("fileTooLarge", { name: f.name });
    const buf = Buffer.from(await f.arrayBuffer());
    if (imageTypes.has(f.type)) {
      out.push({ name: f.name, mediaType: f.type, data: buf.toString("base64"), kind: "image" });
    } else if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
      out.push({ name: f.name, mediaType: "application/pdf", data: buf.toString("base64"), kind: "pdf" });
    } else if (f.type.startsWith("text/") || textExt.test(f.name)) {
      const text = buf.toString("utf8");
      if (text.length > MAX_TEXT_CHARS) throw new AttachmentError("fileTooLong", { name: f.name });
      out.push({ name: f.name, mediaType: "text/plain", data: text, kind: "text" });
    } else {
      throw new AttachmentError("fileUnsupported", { name: f.name });
    }
  }
  return out;
}
