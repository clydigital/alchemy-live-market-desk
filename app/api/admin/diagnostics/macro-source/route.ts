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
  const isPreview = process.env.VERCEL_ENV === "preview";
  const authorized = acceptsResearchAuthorization(
    request.headers.get("authorization"),
    [process.env.RESEARCH_UPDATE_TOKEN, process.env.CRON_SECRET],
  );

  // This branch-only POC is read-only and has no persistence or reasoning side effects.
  // Preview may call Jina Reader unauthenticated so schema fidelity can be tested without
  // putting a credential in source control or requiring a production secret change.
  if (!authorized && !isPreview) {
    return json({ error: "Unauthorized macro source diagnostic." }, 401);
  }

  try {
    const result = await fetchMacroSourceDiagnostic({
      jinaApiKey: authorized ? process.env.JINA_API_KEY : undefined,
    });

    return json({
      ...result,
      configuration: {
        jinaApiKeyConfigured: authorized && Boolean(process.env.JINA_API_KEY?.trim()),
        previewUnauthenticatedPoc: isPreview && !authorized,
      },
      persistence: "none",
      reasoning: "none",
    }, result.ok ? 200 : 502);
  } catch (error) {
    return json({
      error: "Macro source diagnostic failed before a usable Jina response was returned.",
      detail: error instanceof Error ? error.message : String(error),
      configuration: {
        jinaApiKeyConfigured: authorized && Boolean(process.env.JINA_API_KEY?.trim()),
        previewUnauthenticatedPoc: isPreview && !authorized,
      },
      persistence: "none",
      reasoning: "none",
    }, 502);
  }
}
