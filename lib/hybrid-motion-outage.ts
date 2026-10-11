import {
  selectMarketMotionForOverview,
  type MarketMotionRecord,
} from "./market-motion.ts";

export const HYBRID_CURRENT_VERIFIED_MOTION_LIMIT = 4;
export const HYBRID_CURRENT_LEAD_MOTION_LIMIT = 4;
export const HYBRID_OUTAGE_CALENDAR_MAX_AGE_HOURS = 72;
export const HYBRID_OUTAGE_CATALYST_HORIZON_DAYS = 14;

export type HybridMotionSplit = {
  verified: MarketMotionRecord[];
  leads: MarketMotionRecord[];
};
/**
 * Motion is not System 2. "VERIFIED" is a source-verification status, never
 * an accepted Story/Regime conclusion. LEAD, REPORTED, PARTIAL etc may not be
 * presented as established current facts. Read-only exact-event dedup reused.
 */
export function splitCurrentHybridMarketMotion(
  records: MarketMotionRecord[],
  now: Date,
): HybridMotionSplit {
  const ranked = selectMarketMotionForOverview(records, now);
  return {
    verified: ranked.filter(item =>
      item.verification_state === "VERIFIED"
      && /^https:\/\//.test(item.source_url)
    ).slice(0, HYBRID_CURRENT_VERIFIED_MOTION_LIMIT),
    leads: ranked.filter(item =>
      item.verification_state === "LEAD"
      || item.verification_state === "REPORTED"
      || item.verification_state === "PARTIAL"
      || item.verification_state === "UNRESOLVED"
    ).slice(0, HYBRID_CURRENT_LEAD_MOTION_LIMIT),
  };
}

export type OutageCatalyst = {
  label: string;
  kind: "MACRO" | "EARNINGS" | "GEOPOLITICAL";
  time: string;
};
/**
 * Read only latest published edition's *dated future* event calendar; it is
 * labelled as that edition, not independently updated, and must be withheld
 * if the edition is old or its event timestamps are unparseable.
 */
export function latestEditionOutageCatalysts(input: {
  payload: Record<string, unknown> | null | undefined;
  publishedAt: string | null | undefined;
  now: Date;
}): OutageCatalyst[] {
  const published = Date.parse(input.publishedAt ?? "");
  const now = input.now.getTime();
  if (!Number.isFinite(published) || published > now || now - published >
      HYBRID_OUTAGE_CALENDAR_MAX_AGE_HOURS * 3_600_000) return [];

  const upcoming = input.payload?.upcoming;
  if (!upcoming || typeof upcoming !== "object" || Array.isArray(upcoming)) return [];
  const root = upcoming as Record<string, unknown>;
  const lists: Array<{
    field: string;
    kind: OutageCatalyst["kind"];
    labelField: string;
  }> = [
    {field:"economicCalendar",kind:"MACRO",labelField:"event"},
    {field:"earnings",kind:"EARNINGS",labelField:"company"},
    {field:"geopoliticalClock",kind:"GEOPOLITICAL",labelField:"event"},
  ];
  const found: OutageCatalyst[] = [];
  for (const list of lists) {
    const items = root[list.field];
    if (!Array.isArray(items)) continue;
    for (const raw of items.slice(0,20)) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const value = raw as Record<string,unknown>;
      const label = value[list.labelField], time = value.time;
      if (typeof label !== "string" || !label.trim() || typeof time !== "string") continue;
      const ts = Date.parse(time);
      if (!Number.isFinite(ts) || ts < now
        || ts - now > HYBRID_OUTAGE_CATALYST_HORIZON_DAYS * 86_400_000) continue;
      found.push({label:label.trim().slice(0,180),kind:list.kind,time:new Date(ts).toISOString()});
    }
  }
  return found.sort((a,b)=>a.time.localeCompare(b.time)
    || a.kind.localeCompare(b.kind)
    || a.label.localeCompare(b.label)).slice(0,6);
}
