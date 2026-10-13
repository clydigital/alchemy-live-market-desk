import { acceptsResearchAuthorization } from "@/lib/research-auth";
import { readFredSeries } from "@/lib/providers/fred-api-v1";
import { readFmpRecords } from "@/lib/providers/fmp-rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Explicit, read-only pilot: no canonical evidence or research write. */
export async function GET(request: Request) {
  if (!acceptsResearchAuthorization(request.headers.get("authorization"), [
    process.env.CRON_SECRET,
    process.env.RESEARCH_API_KEY,
  ])) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const to = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);

  const [nominal10Y, breakeven10Y, earningsCalendar] = await Promise.all([
    readFredSeries("DGS10", { limit: 3 }),
    readFredSeries("T10YIE", { limit: 3 }),
    readFmpRecords({
      endpoint: "earnings-calendar",
      from,
      to,
    }),
  ]);

  return Response.json({
    mode: "sensor_only",
    canonicalEvidenceWritten: false,
    fred: { nominal10Y, breakeven10Y },
    fmp: { earningsCalendar },
  }, { headers: { "Cache-Control": "no-store" } });
}
