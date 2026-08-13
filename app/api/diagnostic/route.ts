import { NextResponse } from "next/server";
import { getMarketMonitor, loadExtras } from "@/lib/market-monitor";
import { getMarketMonitor as getPublicMarketMonitor } from "@/lib/market-monitor-public";
import { getMarketData } from "@/lib/market";
import { getGlobalFlowMonitor } from "@/lib/global-flow-monitor";

export const dynamic = "force-dynamic";

const fetchStats: Array<{
  url: string;
  durationMs: number;
  status: number;
  ok: boolean;
  type: string;
}> = [];

let originalFetch: typeof globalThis.fetch | null = null;

function classifyUrl(url: string): string {
  if (url.includes("api.nasdaq.com")) return "Nasdaq";
  if (url.includes("home.treasury.gov")) return "Treasury";
  if (url.includes("data-api.ecb.europa.eu")) return "ECB";
  if (url.includes("eia.gov")) return "EIA";
  if (url.includes("fred.stlouisfed.org")) return "FRED";
  if (url.includes("straits.live")) return "Straits (Global Flow)";
  return "Other";
}

function instrumentFetch() {
  if (originalFetch) return;
  originalFetch = globalThis.fetch;
  globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === "string" ? input : (input as any).url || String(input);
    const type = classifyUrl(url);
    const start = Date.now();
    try {
      const response = await originalFetch!(input, init);
      const durationMs = Date.now() - start;
      fetchStats.push({
        url,
        durationMs,
        status: response.status,
        ok: response.ok,
        type,
      });
      return response;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      fetchStats.push({
        url,
        durationMs,
        status: 0,
        ok: false,
        type,
      });
      throw err;
    }
  };
}

function restoreFetch() {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
}

export async function GET() {
  // Test/dev gated: Only accessible in development
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Forbidden in production", { status: 403 });
  }

  instrumentFetch();
  fetchStats.length = 0;

  try {
    // First run (Cold cache)
    const firstDataStart = Date.now();
    const firstData = await getMarketData();
    const firstDataDuration = Date.now() - firstDataStart;

    const firstExtrasStart = Date.now();
    const firstExtras = await loadExtras();
    const firstExtrasDuration = Date.now() - firstExtrasStart;

    const firstMonitorStart = Date.now();
    const firstMonitor = await getPublicMarketMonitor();
    const firstMonitorDuration = Date.now() - firstMonitorStart;

    const firstFlowStart = Date.now();
    const firstFlow = await getGlobalFlowMonitor();
    const firstFlowDuration = Date.now() - firstFlowStart;

    // Second run (Warm cache)
    const secondDataStart = Date.now();
    const secondData = await getMarketData();
    const secondDataDuration = Date.now() - secondDataStart;

    const secondExtrasStart = Date.now();
    const secondExtras = await loadExtras();
    const secondExtrasDuration = Date.now() - secondExtrasStart;

    const secondMonitorStart = Date.now();
    const secondMonitor = await getPublicMarketMonitor();
    const secondMonitorDuration = Date.now() - secondMonitorStart;

    const secondFlowStart = Date.now();
    const secondFlow = await getGlobalFlowMonitor();
    const secondFlowDuration = Date.now() - secondFlowStart;

    const summary: Record<string, {
      requests: number;
      success: number;
      failures: number;
      elapsedTotal: number;
      details: Array<{ url: string; duration: number; ok: boolean }>;
    }> = {};

    for (const stat of fetchStats) {
      if (!summary[stat.type]) {
        summary[stat.type] = { requests: 0, success: 0, failures: 0, elapsedTotal: 0, details: [] };
      }
      const s = summary[stat.type];
      s.requests++;
      if (stat.ok) {
        s.success++;
      } else {
        s.failures++;
      }
      s.elapsedTotal += stat.durationMs;
      s.details.push({ url: stat.url, duration: stat.durationMs, ok: stat.ok });
    }

    restoreFetch();

    return NextResponse.json({
      success: true,
      metrics: {
        firstRun: {
          getMarketDataDuration: firstDataDuration,
          loadExtrasDuration: firstExtrasDuration,
          getMarketMonitorDuration: firstMonitorDuration,
          getGlobalFlowMonitorDuration: firstFlowDuration,
          rows: firstMonitor.rows.length,
          contradictions: firstMonitor.contradictions.length,
          researchTriggers: firstMonitor.researchTriggers.length,
        },
        secondRun: {
          getMarketDataDuration: secondDataDuration,
          loadExtrasDuration: secondExtrasDuration,
          getMarketMonitorDuration: secondMonitorDuration,
          getGlobalFlowMonitorDuration: secondFlowDuration,
          rows: secondMonitor.rows.length,
          contradictions: secondMonitor.contradictions.length,
          researchTriggers: secondMonitor.researchTriggers.length,
        },
      },
      providers: summary,
      firstMonitorRows: firstMonitor.rows.map(r => ({ id: r.id, symbol: r.symbol, last: r.last, attentionScore: r.attentionScore })),
    });
  } catch (error: any) {
    restoreFetch();
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
