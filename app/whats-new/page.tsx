import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, formatDeskDate, Panel } from "@/components/live-desk/LiveDeskUi";
import WhatsNewWorkspace, { type WhatsNewDelta, type WhatsNewTopic } from "@/components/live-desk/WhatsNewWorkspace";
import { getDeskData } from "@/lib/data";
import { getStoryRecordLayer } from "@/lib/persistence/read";
import type { StoryEvent, StoryThesisVersion } from "@/lib/persistence/contracts";

export const dynamic = "force-dynamic";

const TOPIC_PATTERNS: Array<[WhatsNewTopic, RegExp]> = [
  ["Crypto", /\b(?:crypto|bitcoin|btc|ethereum|eth|stablecoin|blockchain|token)\b/i],
  ["Commodities", /\b(?:oil|brent|wti|crude|gold|silver|copper|commodit(?:y|ies)|energy|lng|gasoline|diesel|xau|xag|refining|crack spread)\b/i],
  ["FX", /\b(?:forex|fx|usd|jpy|eur|gbp|aud|cad|chf|dxy|yen|dollar|sterling|currency|currencies|carry trade|intervention)\b/i],
  ["Macro", /\b(?:cpi|ppi|inflation|payrolls?|nfp|employment|unemployment|labour|labor|gdp|pmi|ism|fed|fomc|boj|ecb|central bank|rates?|yields?|treasur(?:y|ies)|productivity|macro|growth data)\b/i],
  ["Stocks", /\b(?:stock|stocks|equity|equities|nasdaq|s&p|spx|soxx|smh|nikkei|kospi|dow|shares?|semiconductors?|technology|tech|ai|artificial intelligence|megacap|mag7|amd|nvidia|nvda|microsoft|msft|meta|alphabet|googl|amazon|amzn|tesla|tsla)\b/i],
  ["Earnings", /\b(?:earnings|eps|quarterly results?|results season|investor day)\b/i],
  ["Geopolitics", /\b(?:iran|hormuz|war|military|missile|strike|sanctions?|ceasefire|diplomacy|diplomatic|geopolitics?|tariffs?|trade war|election|retaliation|conflict)\b/i],
];

const HUMAN_EVENT_LABELS: Record<string, string> = {
  thesis_revision: "Thesis revised",
  headline_update: "Story updated",
  evidence_update: "Evidence added",
  contradiction: "Contradiction",
  confirmation: "Confirmed",
  invalidation: "Invalidated",
  catalyst: "Catalyst",
  archive: "Archived",
  reopen: "Reopened",
  correction: "Corrected",
  source_update: "Source updated",
};

function humanEventLabel(kind: string) {
  return HUMAN_EVENT_LABELS[kind] || kind.replaceAll("_", " ");
}

function classifyTopic(primary: string, secondary = "", assetText = ""): WhatsNewTopic {
  for (const [topic, pattern] of TOPIC_PATTERNS) {
    if (pattern.test(primary)) return topic;
  }

  const assets = assetText.toUpperCase();
  if (/\b(?:BTCUSD|ETHUSD|BTC|ETH|COIN|MSTR)\b/.test(assets)) return "Crypto";
  if (/\b(?:USOIL|UKOIL|WTI|BRENT|XAUUSD|XAGUSD|XAU|XAG|GOLD|SILVER|DIESEL_CRACK|GASOLINE_CRACK|LNG)\b/.test(assets)) return "Commodities";
  if (/\b(?:DXY|USDJPY|GBPJPY|AUDJPY|EURUSD|GBPUSD|USDCHF|USDCAD|EURJPY|[A-Z]{3}JPY)\b/.test(assets)) return "FX";
  if (/\b(?:US02Y|US05Y|US10Y|US30Y|TLT|IEF|SHY)\b/.test(assets)) return "Macro";
  if (/\b(?:SPX|NASDAQ|NDX|QQQ|RSP|SOXX|SMH|NIKKEI|KOSPI|AAPL|MSFT|AMZN|GOOGL|META|NVDA|AMD|TSLA|BABA|MU|WDC|SNDK)\b/.test(assets)) return "Stocks";

  for (const [topic, pattern] of TOPIC_PATTERNS) {
    if (pattern.test(secondary)) return topic;
  }
  return "Other";
}

function classifyStoryTopic(
  storyTitle: string | null | undefined,
  eventHeadline: string,
  storyThesis: string | null | undefined,
  eventDetail: string | null | undefined,
  assets: string[] | null | undefined,
): WhatsNewTopic {
  const story = storyTitle || "";
  if (/\b(?:oil|crude|physical normalisation|physical disruption|energy disruption)\b/i.test(story)) return "Commodities";
  if (/\b(?:yen|carry|forex|currency|intervention)\b/i.test(story)) return "FX";
  if (/\b(?:fed|inflation|rates?|long end|treasur(?:y|ies)|macro)\b/i.test(story)) return "Macro";
  if (/\b(?:earnings|mag7 guidance|guidance dispersion)\b/i.test(story)) return "Earnings";
  if (/\b(?:ai|market breadth|equity|stocks?)\b/i.test(story)) return "Stocks";
  if (/\b(?:iran|hormuz|war|geopolitics?|conflict)\b/i.test(story)) return "Geopolitics";
  return classifyTopic(eventHeadline, `${storyThesis || ""} ${eventDetail || ""}`, (assets || []).join(" "));
}

function versionKey(storyId: string, versionNumber: number) {
  return `${storyId}:${versionNumber}`;
}

function isHumanChangeReason(reason: string | null | undefined) {
  if (!reason) return false;
  return !/^(?:story_updated|story update|thesis-bearing story field changed|thesis bearing story field changed)$/i.test(reason.trim());
}

function humaniseStoryEvent(
  event: StoryEvent,
  storyTitle: string | null | undefined,
  versionByEventId: Map<string, StoryThesisVersion>,
  versionByStoryAndNumber: Map<string, StoryThesisVersion>,
) {
  if (event.event_type !== "thesis_revision") {
    return {
      title: event.headline,
      detail: event.detail || "No additional detail was stored for this Story event.",
    };
  }

  const version = versionByEventId.get(event.id);
  if (!version) {
    return {
      title: storyTitle || event.headline,
      detail: event.detail || "The Story thesis changed, but the full version record is not available in this view.",
    };
  }

  const previous = versionByStoryAndNumber.get(versionKey(version.story_id, version.version_number - 1));
  const title = version.title || storyTitle || event.headline;
  const now = version.thesis ? `NOW: ${version.thesis}` : "";
  const before = previous?.thesis ? ` PREVIOUSLY: ${previous.thesis}` : "";
  const reason = isHumanChangeReason(version.change_reason) ? ` WHY IT CHANGED: ${version.change_reason}` : "";

  return {
    title,
    detail: `${now}${before}${reason}`.trim() || event.detail || "The Story thesis was revised.",
  };
}

export default async function WhatsNewPage() {
  const [data, recordLayer] = await Promise.all([getDeskData(), getStoryRecordLayer()]);
  const storyById = new Map(data.stories.map((story) => [story.id, story]));
  const versionByEventId = new Map(
    recordLayer.thesisVersions
      .filter((version) => version.event_id)
      .map((version) => [version.event_id as string, version]),
  );
  const versionByStoryAndNumber = new Map(
    recordLayer.thesisVersions.map((version) => [versionKey(version.story_id, version.version_number), version]),
  );

  const storyDeltas: WhatsNewDelta[] = recordLayer.available
    ? recordLayer.events.map((event) => {
      const story = storyById.get(event.story_id);
      const human = humaniseStoryEvent(event, story?.title, versionByEventId, versionByStoryAndNumber);
      return {
        id: event.id,
        kind: humanEventLabel(event.event_type),
        stream: "Story" as const,
        topic: classifyStoryTopic(story?.title, human.title, story?.thesis, human.detail, story?.assets),
        title: human.title,
        detail: human.detail,
        dateLabel: formatDeskDate(event.event_at),
        timestamp: event.event_at,
        href: story ? `/stories/${story.slug}#event-${event.id}` : null,
        external: false,
        verification: event.impact,
        storyTitle: story?.title || null,
      };
    })
    : data.updates.map((update) => {
      const story = storyById.get(update.story_id);
      const timestamp = update.observed_at || update.created_at;
      return {
        id: update.id,
        kind: humanEventLabel(update.update_type),
        stream: "Story" as const,
        topic: classifyStoryTopic(story?.title, update.headline, story?.thesis, update.detail, story?.assets),
        title: update.headline,
        detail: update.detail || "No additional detail was stored for this update.",
        dateLabel: formatDeskDate(timestamp),
        timestamp,
        href: story ? `/stories/${story.slug}#event-${update.id}` : null,
        external: false,
        verification: "Dated Story update",
        storyTitle: story?.title || null,
      };
    });

  const deltas: WhatsNewDelta[] = [
    ...storyDeltas,
    ...data.statements.map((statement) => ({
      id: statement.id,
      kind: "Statement",
      stream: "Statement" as const,
      topic: classifyTopic(
        `${statement.topic} ${statement.speaker}`,
        `${statement.market_interpretation || ""} ${statement.quote_excerpt || ""}`,
      ),
      title: `${statement.speaker}: ${statement.topic}`,
      detail: statement.market_interpretation || statement.quote_excerpt,
      dateLabel: formatDeskDate(statement.statement_date),
      timestamp: statement.statement_date,
      href: statement.source_url || null,
      external: true,
      verification: statement.verification_status,
      storyTitle: null,
    })),
    ...data.newsThreads.map((thread) => ({
      id: thread.id,
      kind: thread.category || thread.source_type,
      stream: "News" as const,
      topic: classifyTopic(
        `${thread.category || ""} ${thread.headline}`,
        `${thread.current_view || ""} ${thread.summary || ""}`,
      ),
      title: thread.headline,
      detail: thread.current_view || thread.summary,
      dateLabel: formatDeskDate(thread.published_at),
      timestamp: thread.published_at,
      href: thread.source_url || null,
      external: true,
      verification: thread.source_type,
      storyTitle: null,
    })),
  ].sort((a, b) => Date.parse(b.timestamp || "") - Date.parse(a.timestamp || "")).slice(0, 60);

  return (
    <LiveDeskShell
      activePath="/whats-new"
      title="What’s New"
      description="Material Story changes, verified statements and relevant news records, grouped visually by the market they belong to."
      meta={`${deltas.length} recent records shown`}
    >
      <div className={styles.grid}>
        <DataState
          state={recordLayer.available ? "ready" : "warn"}
          title={recordLayer.available ? "Append-only Story events active" : "Dated Story update links active"}
          detail={recordLayer.available
            ? "The delta stream is reading immutable Story events and links each item to its exact place in the Story timeline."
            : "The stream links current dated updates to exact Story anchors. Immutable event history will take over after the approved persistence migration is applied."}
        />

        <Panel
          title="Current delta stream"
          description="Two-column scan of recent market changes. Topic icons separate FX, stocks, macro, geopolitics and other desks at a glance."
          action={<Badge tone={recordLayer.available ? "ready" : "default"}>{recordLayer.available ? "Versioned events" : "Current events"}</Badge>}
        >
          {deltas.length ? (
            <WhatsNewWorkspace deltas={deltas} />
          ) : (
            <DataState state="risk" title="Recent records are updating" detail="No update, statement or news records are available at the moment. This is not treated as proof that the market was quiet." />
          )}
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
