import { NextResponse } from "next/server";

import { getEconomicCalendar } from "@/lib/calendar";
import { getForwardEarningsEvents, type ForwardEarningsResult } from "@/lib/forward-earnings-sources";
import { buildPresenterCalendar } from "@/lib/presenter-calendar";

// A public, read-only event projection. The Dossier is neither read nor mutated.
export const dynamic = "force-dynamic";

export async function GET() {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  };
  const now = new Date();
  const [macroResult, earningsResult] = await Promise.allSettled([
    getEconomicCalendar(),
    getForwardEarningsEvents({ now }),
  ]);
  const macroFailed = macroResult.status === "rejected";
  const macro = macroResult.status === "fulfilled" ? macroResult.value : [];
  const earnings: ForwardEarningsResult = earningsResult.status === "fulfilled"
    ? earningsResult.value
    : { events: [], coverage: "unavailable", warning: "Earnings source failed; no earnings results inferred." };
  const calendar = buildPresenterCalendar(macro, earnings, now, macroFailed);
  return NextResponse.json(calendar, { status: 200, headers });
}
