import "server-only";
import { NextResponse, type NextRequest } from "next/server";

import { BLUEBELLY_PRESENTATION_HOST, blueDeskHostAccess } from "@/lib/blue-desk-host";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { getOriginalPressNews } from "@/lib/blue-desk-original-press-news-server";
import { combineQualifiedNews } from "@/lib/blue-desk-qualified-news";
import {
  BLUEBELLY_PUBLIC_NEWS_VERSION,
  projectBluebellyPublicNews,
} from "@/lib/bluebelly-public-news-v1";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=60",
  "X-Content-Type-Options": "nosniff",
};

const PRIVATE_FAILURE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

/**
 * Public-reader contract only: not a legacy feed proxy, Dossier API, or
 * machine research endpoint. Strict hostname/path check is repeated here
 * independent of middleware so preview/legacy hosts cannot inherit access.
 */
export async function GET(request: NextRequest) {
  const hostname = (request.headers.get("host") || request.nextUrl.hostname)
    .trim().toLowerCase().replace(/:443$/, "");
  if (request.nextUrl.pathname !== "/api/blue-desk/v1/public-news" ||
    hostname !== BLUEBELLY_PRESENTATION_HOST ||
    blueDeskHostAccess(request.nextUrl.pathname, hostname) !== "public") {
    return new NextResponse(null, { status: 404, headers: PRIVATE_FAILURE_HEADERS });
  }

  const now = new Date();
  const [motionResult, officialResult] = await Promise.allSettled([
    getCurrentVerifiedMarketMotion({ limit: 24 }),
    getOriginalPressNews(now, 12),
  ]);

  if (motionResult.status === "rejected" && officialResult.status === "rejected") {
    return NextResponse.json({
      contractVersion: BLUEBELLY_PUBLIC_NEWS_VERSION,
      generatedAt: now.toISOString(),
      coverage: "unavailable",
      items: [],
    }, { status: 503, headers: PRIVATE_FAILURE_HEADERS });
  }

  const verifiedMotions = motionResult.status === "fulfilled"
    ? selectVerifiedNewsBriefs(motionResult.value, now, 12) : [];
  const officialPress = officialResult.status === "fulfilled" ? officialResult.value : [];
  const eligible = combineQualifiedNews(verifiedMotions, officialPress, 12);
  const items = projectBluebellyPublicNews(eligible, now, 12);
  const coverage = motionResult.status === "rejected" || officialResult.status === "rejected"
    ? "partial" : "complete";

  return NextResponse.json({
    contractVersion: BLUEBELLY_PUBLIC_NEWS_VERSION,
    generatedAt: now.toISOString(),
    coverage,
    items,
  }, { headers: HEADERS });
}
