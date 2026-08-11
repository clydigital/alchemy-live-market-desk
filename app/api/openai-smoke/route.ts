import { NextResponse } from "next/server";

import { runStructuredStage } from "@/lib/intelligence/openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") return NextResponse.json({ error: "Not available in production." }, { status: 404 });
  const result = await runStructuredStage<{ ok: boolean; label: string }>({
    stageKey: "smoke",
    instructions: "Return the requested structured object. Do not add any other content.",
    input: { task: "Confirm structured output transport." },
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "label"],
      properties: {
        ok: { type: "boolean" },
        label: { type: "string" },
      },
    },
    modelKind: "fast",
    maxOutputTokens: 300,
  });
  return NextResponse.json({ ok: result.data.ok, label: result.data.label, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });
}
