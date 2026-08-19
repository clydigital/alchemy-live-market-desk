import {
  buildMacroSnapshot,
  compareMacroSnapshots,
  fetchMacroSourceDiagnostic,
  fetchMacroSourceText,
  summarizeMacroSnapshot,
} from "@/lib/jina-macro-source-diagnostic";
import { acceptsResearchAuthorization } from "@/lib/research-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isPreview = process.env.VERCEL_ENV === "preview";
  const previewJinaKey = isPreview ? url.searchParams.get("jinaKey")?.trim() : undefined;
  const compareLive = isPreview && url.searchParams.get("compare") === "1";
  const authorized = acceptsResearchAuthorization(
    request.headers.get("authorization"),
    [process.env.RESEARCH_UPDATE_TOKEN, process.env.CRON_SECRET],
  );

  if (!authorized && !previewJinaKey) {
    return json({ error: "Unauthorized macro source diagnostic." }, 401);
  }

  const jinaApiKey = previewJinaKey || process.env.JINA_API_KEY;

  try {
    if (compareLive) {
      const captureA = await fetchMacroSourceText({ jinaApiKey });
      const captureB = await fetchMacroSourceText({ jinaApiKey });
      const snapshotA = buildMacroSnapshot(captureA.text);
      const snapshotB = buildMacroSnapshot(captureB.text);
      const comparison = compareMacroSnapshots(snapshotA, snapshotB);

      return json({
        ok: captureA.ok && captureB.ok,
        readerStatuses: [captureA.readerStatus, captureB.readerStatus],
        authenticatedReader: captureA.usedAuthenticatedReader && captureB.usedAuthenticatedReader,
        captureA: summarizeMacroSnapshot(snapshotA),
        captureB: summarizeMacroSnapshot(snapshotB),
        comparison: {
          ...comparison,
          changes: comparison.changes.slice(0, 100),
        },
        persistence: "none",
        reasoning: "none",
        previewHarness: true,
      }, captureA.ok && captureB.ok ? 200 : 502);
    }

    const result = await fetchMacroSourceDiagnostic({ jinaApiKey });
    return json({
      ...result,
      configuration: {
        jinaApiKeyConfigured: Boolean(jinaApiKey?.trim()),
        previewHarness: Boolean(previewJinaKey),
      },
      persistence: "none",
      reasoning: "none",
    }, result.ok ? 200 : 502);
  } catch (error) {
    return json({
      error: "Macro source diagnostic failed before a usable Jina response was returned.",
      detail: error instanceof Error ? error.message : String(error),
      persistence: "none",
      reasoning: "none",
    }, 502);
  }
}
