import { normaliseMarketEvent, type MarketEventV1 } from "@/lib/market-events";

export type MarketEventRow = {
  event_key: string;
  event_type: MarketEventV1["eventType"];
  title: string;
  start_at: string | null;
  end_at: string | null;
  time_label: string | null;
  time_precision: MarketEventV1["timePrecision"];
  status: MarketEventV1["status"];
  verification_state: MarketEventV1["verificationState"];
  participants: string[];
  geography: string[];
  affected_assets: string[];
  linked_story_ids: string[];
  linked_story_slugs: string[];
  decisive_variable: string;
  transmission: string;
  expected_stage: string | null;
  expectation: string | null;
  source_name: string;
  source_url: string;
  source_urls: string[];
  source_record_refs: string[];
  first_seen_at: string;
  last_verified_at: string;
  updated_at: string;
  payload: MarketEventV1;
};

export function marketEventToRow(event: MarketEventV1): MarketEventRow {
  return {
    event_key: event.id,
    event_type: event.eventType,
    title: event.title,
    start_at: event.startAt,
    end_at: event.endAt,
    time_label: event.timeLabel,
    time_precision: event.timePrecision,
    status: event.status,
    verification_state: event.verificationState,
    participants: event.participants,
    geography: event.geography,
    affected_assets: event.affectedAssets,
    linked_story_ids: event.linkedStoryIds,
    linked_story_slugs: event.linkedStorySlugs,
    decisive_variable: event.decisiveVariable,
    transmission: event.transmission,
    expected_stage: event.expectedStage,
    expectation: event.expectation,
    source_name: event.sourceName,
    source_url: event.sourceUrl,
    source_urls: event.sourceUrls,
    source_record_refs: event.sourceRecordRefs,
    first_seen_at: event.firstSeenAt,
    last_verified_at: event.lastVerifiedAt,
    updated_at: event.updatedAt,
    payload: event,
  };
}

export function marketEventFromRow(row: Partial<MarketEventRow>): MarketEventV1 | null {
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  return normaliseMarketEvent({
    ...payload,
    id: row.event_key || (payload as MarketEventV1).id,
    eventType: row.event_type || (payload as MarketEventV1).eventType,
    title: row.title || (payload as MarketEventV1).title,
    startAt: row.start_at || (payload as MarketEventV1).startAt,
    endAt: row.end_at || (payload as MarketEventV1).endAt,
    timeLabel: row.time_label || (payload as MarketEventV1).timeLabel,
    timePrecision: row.time_precision || (payload as MarketEventV1).timePrecision,
    status: row.status || (payload as MarketEventV1).status,
    verificationState: row.verification_state || (payload as MarketEventV1).verificationState,
    participants: row.participants || (payload as MarketEventV1).participants,
    geography: row.geography || (payload as MarketEventV1).geography,
    affectedAssets: row.affected_assets || (payload as MarketEventV1).affectedAssets,
    linkedStoryIds: row.linked_story_ids || (payload as MarketEventV1).linkedStoryIds,
    linkedStorySlugs: row.linked_story_slugs || (payload as MarketEventV1).linkedStorySlugs,
    decisiveVariable: row.decisive_variable || (payload as MarketEventV1).decisiveVariable,
    transmission: row.transmission || (payload as MarketEventV1).transmission,
    expectedStage: row.expected_stage || (payload as MarketEventV1).expectedStage,
    expectation: row.expectation || (payload as MarketEventV1).expectation,
    sourceName: row.source_name || (payload as MarketEventV1).sourceName,
    sourceUrl: row.source_url || (payload as MarketEventV1).sourceUrl,
    sourceUrls: row.source_urls || (payload as MarketEventV1).sourceUrls,
    sourceRecordRefs: row.source_record_refs || (payload as MarketEventV1).sourceRecordRefs,
    firstSeenAt: row.first_seen_at || (payload as MarketEventV1).firstSeenAt,
    lastVerifiedAt: row.last_verified_at || (payload as MarketEventV1).lastVerifiedAt,
    updatedAt: row.updated_at || (payload as MarketEventV1).updatedAt,
  });
}
