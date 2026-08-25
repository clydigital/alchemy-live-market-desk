import { NextResponse } from "next/server";

import { retrieveSupadataVideo } from "@/lib/supadata";

const CANARY_VIDEO_ID = "4yJp-WUKaU8";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ ok: false, error: "preview_only" }, { status: 404 });
  }

  const apiKey = process.env.SUPADATA_API_KEY?.trim() || "";
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "missing_supadata_api_key" }, { status: 503 });
  }

  try {
    const retrieval = await retrieveSupadataVideo(CANARY_VIDEO_ID, apiKey, { timeoutMs: 8_000 });
    return NextResponse.json({
      ok: true,
      videoId: CANARY_VIDEO_ID,
      provider: "supadata",
      mode: retrieval.transcript.metadata.mode ?? null,
      transcriptSource: retrieval.transcript.metadata.transcriptSource ?? null,
      language: retrieval.transcript.language,
      segmentCount: retrieval.transcript.segments.length,
      textLength: retrieval.transcript.text.length,
      durationSeconds: retrieval.transcript.durationSeconds,
      httpStatus: retrieval.transcript.httpStatus,
      billableRequests: retrieval.transcript.metadata.billableRequests ?? null,
    });
  } catch (error) {
    const candidate = error as {
      code?: unknown;
      httpStatus?: unknown;
      retryable?: unknown;
      message?: unknown;
    };
    return NextResponse.json({
      ok: false,
      videoId: CANARY_VIDEO_ID,
      errorCode: typeof candidate.code === "string" ? candidate.code : "unknown",
      httpStatus: typeof candidate.httpStatus === "number" ? candidate.httpStatus : null,
      retryable: typeof candidate.retryable === "boolean" ? candidate.retryable : null,
      message: typeof candidate.message === "string" ? candidate.message.slice(0, 300) : "Supadata canary failed.",
    }, { status: 502 });
  }
}
