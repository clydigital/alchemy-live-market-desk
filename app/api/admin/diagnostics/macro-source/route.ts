import { fetchMacroSourceDiagnostic } from "@/lib/jina-macro-source-diagnostic";
import { acceptsResearchAuthorization } from "@/lib/research-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const authorized = acceptsResearchAuthorization(
    request.headers.get("authorization"),
    [process.env.RESEARCH_UPDATE_TOKEN, process.env.CRON_SECRET],
  );

  if (!authorized) {
    return json({ error: "Unauthorized macro source diagnostic." }, 401);
  }

  try {
    const result = await fetchMacroSourceDiagnostic({
      jinaApiKey: process.env.JINA_API_KEY,
    });

    return json({
      ...result,
      configuration: {
        jinaApiKeyConfigured: Boolean(process.env.JINA_API_KEY?.trim()),
      },
      persistence: "none",
      reasoning: "none",
    }, result.ok ? 200 : 502);
  } catch (error) {
    return json({
      error: "Macro source diagnostic failed before a usable Jina response was returned.",
      detail: error instanceof Error ? error.message : String(error),
      configuration: {
        jinaApiKeyConfigured: Boolean(process.env.JINA_API_KEY?.trim()),
      },
      persistence: "none",
      reasoning: "none",
    }, 502);
  }
}
