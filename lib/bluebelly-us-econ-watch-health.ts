import type {UsEconStatWatch} from "./bluebelly-us-econ-stat-watch.ts";

/** Operational receipt only. Never rewrites canonical evidence or portfolios. */
export function buildUsEconWatchHealthReceipt(watch:UsEconStatWatch,now=new Date()){
 const critical=watch.warnings.filter(item=>
  item.startsWith("OVERDUE_HIGH_IMPACT_ACTUAL:")||
  item.startsWith("OFFICIAL_RELEASE_CONFLICT:")||
  item==="CANONICAL_MACRO_SOURCE_UNAVAILABLE"||
  item==="NO_US_ECON_SOURCE_COVERAGE");
 const status=critical.length?"CRITICAL":watch.warnings.length?"DEGRADED":"HEALTHY";
 return {
  kind:"bluebelly_us_econ_watch_health",
  checkedAt:now.toISOString(),
  state:status,
  sourceStatus:watch.status,
  verifiedRecent:watch.countVerified,
  pendingRecent:watch.countPending,
  upcomingCount:watch.upcoming.length,
  provider:watch.consensusProvider,
  lastMetricRetrievedAt:watch.lastMetricRetrievedAt,
  warningCodes:watch.warnings,
  criticalCount:critical.length,
  sourceClocksNotEquivalentToCheckClock:true,
  canonicalRegimeUnchanged:true,
 } as const;
}
