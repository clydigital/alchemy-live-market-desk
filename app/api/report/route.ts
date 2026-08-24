import { getCanonicalPublicationResponse } from "@/lib/intelligence/publication-feed-route";
import { composeAlchemyReportHtml, ReportComposerError } from "@/lib/report-composer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const editionId = new URL(request.url).searchParams.get("edition");
  const publicationResponse = await getCanonicalPublicationResponse(editionId);
  const source = await publicationResponse.json();
  try {
    return new Response(composeAlchemyReportHtml(source), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Alchemy-Report-Contract": "alchemy-report-composer/v1",
      },
    });
  } catch (error) {
    if (!(error instanceof ReportComposerError)) throw error;
    return Response.json({
      error: "canonical_report_unavailable",
      detail: error.message,
    }, {
      status: 409,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
