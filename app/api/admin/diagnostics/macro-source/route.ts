import { fetchMacroSourceDiagnostic } from "@/lib/jina-macro-source-diagnostic";
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
  const authorized = acceptsResearchAuthorization(
    request.headers.get("authorization"),
    [process.env.RESEARCH_UPDATE_TOKEN, process.env.CRON_SECRET],
  );

  if (!authorized && !isPreview) {
    return json({ error: "Unauthorized macro source diagnostic." }, 401);
  }

  const jinaApiKey = previewJinaKey || (authorized ? process.env.JINA_API_KEY : undefined);

  try {
    const result = await fetchMacroSourceDiagnostic({ jinaApiKey });

    return json({
      ...result,
      configuration: {
        jinaApiKeyConfigured: Boolean(jinaApiKey?.trim()),
        previewPoc: isPreview && !authorized,
        credentialSource: previewJinaKey ? "one-time-preview-request" : authorized ? "environment" : "none",
      },
      persistence: "none",
      reasoning: "none",
    }, result.ok ? 200 : 502);
  } catch (error) {
    return json({
      error: "Macro source diagnostic failed before a usable Jina response was returned.",
      detail: error instanceof Error ? error.message : String(error),
      configuration: {
        jinaApiKeyConfigured: Boolean(jinaApiKey?.trim()),
        previewPoc: isPreview && !authorized,
        credentialSource: previewJinaKey ? "one-time-preview-request" : authorized ? "environment" : "none",
      },
      persistence: "none",
      reasoning: "none",
    }, 502);
  }
}
