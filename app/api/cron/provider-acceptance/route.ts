import { acceptsResearchAuthorization } from "@/lib/research-auth";
import { providerAcceptanceReceipt } from "@/lib/provider-acceptance";
import { fetchBeaSnapshot } from "@/lib/providers/bea";
import { readFredSeries } from "@/lib/providers/fred-api-v1";
import { readFmpRecords } from "@/lib/providers/fmp-rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Vercel Cron supplies CRON_SECRET; no client, model, or canonical write. */
export async function GET(request: Request) {
  if (!acceptsResearchAuthorization(request.headers.get("authorization"), [process.env.CRON_SECRET])) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const [nominal10Y, breakeven10Y, earningsCalendar, bea] = await Promise.all([
    readFredSeries("DGS10", { limit: 3 }),
    readFredSeries("T10YIE", { limit: 3 }),
    readFmpRecords({ endpoint: "earnings-calendar", from, to }),
    fetchBeaSnapshot(process.env.BEA_API_KEY),
  ]);
  // Only inspect *presence* in this server process. Never echo keys or
  // confuse the project-level inventory with team Shared Environment Variables.
  const visible = (...names: string[]) => names.some(name => Boolean(process.env[name]?.trim()));
  const receipt = providerAcceptanceReceipt({
    runtimeKeys: {
      fred: visible("FRED_API", "FRED_API_KEY"),
      fmp: visible("FMP_API", "FMP_API_KEY"),
      bea: visible("BEA_API_KEY"),
    },
    at: now.toISOString(), nominal10Y, breakeven10Y, earningsCalendar, bea,
  });
  console.info(JSON.stringify(receipt));
  const ready = nominal10Y.state === "ready" && breakeven10Y.state === "ready"
    && earningsCalendar.state === "ready" && bea.state === "ready";
  return Response.json(receipt, {
    status: ready ? 200 : 502,
    headers: { "Cache-Control": "no-store" },
  });
}
