import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { sttConfigured, transcribe } from "@/lib/stt";

const MAX_BYTES = 10 * 1024 * 1024;

// Voice search fallback: audio → text. The text goes back into the search box
// and is parsed like typed input. Signed-in users only.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "failed" }, { status: 401 });
  if (!sttConfigured()) return NextResponse.json({ error: "notConfigured" }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: "noSpeech" }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "failed" }, { status: 413 });
  const lang = form?.get("lang");

  try {
    const text = await transcribe(audio, lang === "ar" || lang === "en" ? lang : undefined, session?.workspace.id);
    if (!text) return NextResponse.json({ error: "noSpeech" }, { status: 422 });
    return NextResponse.json({ text });
  } catch (e) {
    console.error("transcribe failed", e);
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
