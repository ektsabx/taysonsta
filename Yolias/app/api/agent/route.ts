import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { AgentNotConfiguredError, AgentTurnSchema, runAgent } from "@/lib/agent/run";

const BodySchema = z.object({
  conversationId: z.string().uuid().nullish(),
  messages: z.array(AgentTurnSchema).min(1).max(40).refine((m) => m.at(-1)?.role === "user", "last turn must be the user's"),
});

// Yolias AI agent: one assistant turn for the signed-in user's workspace.
// Authorization lives in the tools (lib/agent), not in this route or the prompt.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    const { reply, iterations } = await runAgent(
      { session, db: await createClient(), conversationId: body.data.conversationId ?? null },
      body.data.messages,
    );
    return NextResponse.json({ reply, iterations });
  } catch (e) {
    if (e instanceof AgentNotConfiguredError) return NextResponse.json({ error: "notConfigured" }, { status: 503 });
    console.error("agent failed", e);
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
