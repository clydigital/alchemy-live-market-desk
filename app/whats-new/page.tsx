import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, formatDeskDate, Panel } from "@/components/live-desk/LiveDeskUi";
import WhatsNewWorkspace, { type WhatsNewDelta, type WhatsNewTopic } from "@/components/live-desk/WhatsNewWorkspace";
import { getDeskData } from "@/lib/data";
import { getCurrentMarketMotion, marketMotionAttention, marketMotionEffectiveState } from "@/lib/market-motion";
import { getStoryRecordLayer } from "@/lib/persistence/read";
import type { StoryEvent, StoryThesisVersion } from "@/lib/persistence/contracts";
import { getRegimeDefinition, routeStoryToRegimes, routeTextToRegimes, type RegimeRoute } from "@/lib/regimes";
import { buildStoryBreakdown } from "@/lib/story-breakdown";
import { presentationAge, readerFacingText } from "@/lib/presentation-hygiene";

export const dynamic = "force-dynamic";

type RawWhatsNewDelta = Omit<WhatsNewDelta, "ageState" | "ageLabel">;

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
  if (/\b(?:USOIL|UKOIL|WTI|BRENT|ULSD|XAUUSD|XAGUSD|XAU|XAG|GOLD|SILVER|DIESEL_CRACK|GASOLINE_CRACK|LNG)\b/.test(assets)) return "Commodities";
  if (/\b(?:DXY|USDJPY|GBPJPY|AUDJPY|EURUSD|GBPUSD|USDCHF|USDCAD|EURJPY|[A-Z]{3}JPY)\b/.test(assets)) return "FX";
  if (/\b(?:US02Y|US05Y|US10Y|US30Y|TLT|IEF|SHY)\b/.test(assets)) return "Macro";
  if (/\b(?:SPX|NASDAQ|NDX|QQQ|RSP|SOXX|SMH|NIKKEI|KOSPI|HSI|AAPL|MSFT|AMZN|GOOGL|META|NVDA|AMD|TSLA|BABA|MU|WDC|SNDK)\b/.test(assets)) return "Stocks";

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
  // Event-specific market content should win over a broader parent Story title.
  // This prevents a Treasury/rates development under an oil-linked Story from
  // being mislabeled as Commodities simply because the durable parent mentions oil.
  if (/\b(?:treasur(?:y|ies)|yield|rates?|long end|buyback|term premium|duration)\b/i.test(eventHeadline)) return "Macro";
  const story = storyTitle || "";
  if (/\b(?:oil|crude|physical normalisation|physical disruption|energy disruption)\b/i.test(story)) return "Commodities";
  if (/\b(?:yen|carry|forex|currency|intervention)\b/i.test(story)) return "FX";
  if (/\b(?:fed|inflation|rates?|long end|treasur(?:y|ies)|macro)\b/i.test(story)) return "Macro";
  if (/\b(?:earnings|mag7 guidance|guidance dispersion)\b/i.test(story)) return "Earnings";
  if (/\b(?:ai|market breadth|equity|stocks?)\b/i.test(story)) return "Stocks";
  if (/\b(?:iran|hormuz|war|geopolitics?|conflict)\b/i.test(story)) return "Geopolitics";
  return classifyTopic(eventHeadline, `${storyThesis || ""} ${eventDetail || ""}`, (assets || []).join(" "));
}

function regimeLinks(routes: RegimeRoute[]) {
  const seen = new Set<string>();
  return routes.flatMap((route) => {
    const regime = getRegimeDefinition(route.regime);
    if (!regime) return [];
    const key = `${regime.slug}:${route.subgroup}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ slug: regime.slug, label: regime.shortTitle, subgroup: route.subgroup }];
  });
}

function versionKey(storyId: string, versionNumber: number) {
  return `${storyId}:${versionNumber}`;
}

function isHumanChangeReason(reason: string | null | undefined) {
  return Boolean(readerFacingText(reason));
}

function humaniseStoryEvent(
  event: StoryEvent,
  storyTitle: string | null | undefined,
  versionByEventId: Map<string, StoryThesisVersion>,
  versionByStoryAndNumber: Map<string, StoryThesisVersion>,
) {
  if (event.event_type !== "thesis_revision") {
    return {
      title: readerFacingText(event.headline) || storyTitle || humanEventLabel(event.event_type),
      detail: readerFacingText(event.detail) || `Story record updated: ${humanEventLabel(event.event_type).toLowerCase()}.`,
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
  const readerReason = isHumanChangeReason(version.change_reason) ? readerFacingText(version.change_reason) : null;
  const reason = readerReason ? ` WHY IT CHANGED: ${readerReason}` : "";

  return {
    title,
    detail: `${now}${before}${reason}`.trim() || event.detail || "The Story thesis was revised.",
  };
}

export default async function WhatsNewPage() {
  const [data, recordLayer, motionRecords] = await Promise.all([getDeskData(), getStoryRecordLayer(), getCurrentMarketMotion({ includeExpired: true, limit: 100 }).catch(() => [])]);
  const storyById = new Map(data.stories.map((story) => [story.id, story]));
  const versionByEventId = new Map(
    recordLayer.thesisVersions
      .filter((version) => version.event_id)
      .map((version) => [version.event_id as string, version]),
  );
  const versionByStoryAndNumber = new Map(
    recordLayer.thesisVersions.map((version) => [versionKey(version.story_id, version.version_number), version]),
  );
  const latestVersionByStory = new Map<string, StoryThesisVersion>();
  for (const version of recordLayer.thesisVersions) {
    const current = latestVersionByStory.get(version.story_id);
    if (!current || version.version_number > current.version_number || (
      version.version_number === current.version_number && version.effective_at > current.effective_at
    )) latestVersionByStory.set(version.story_id, version);
  }

  const motionDeltas: RawWhatsNewDelta[] = motionRecords.map((item) => {
    const story = item.primary_story_id ? storyById.get(item.primary_story_id) : null;
    const fullText = [
      item.headline,
      item.what_happened,
      item.market_reaction || "",
      item.why_interesting,
      item.big_picture_bridge,
      item.next_test || "",
      ...item.tickers,
    ].join(" ");
    const routed = routeTextToRegimes(fullText, 2);
    const routes = item.primary_regime_slug
      ? [...routed].sort((left, right) => Number(right.regime === item.primary_regime_slug) - Number(left.regime === item.primary_regime_slug))
      : routed;
    const effectiveState = marketMotionEffectiveState(item);
    const attention = marketMotionAttention(item);
    return {
      id: item.id,
      kind: effectiveState === "PROMOTED"
        ? `${attention.tier === "PRIMARY" ? "Primary" : "Secondary"} promoted motion`
        : effectiveState === "EXPIRED"
          ? "Expired motion"
          : `${attention.tier === "PRIMARY" ? "Primary" : "Secondary"} motion`,
      stream: "Motion" as const,
      topic: classifyTopic(
        `${item.category} ${item.headline}`,
        `${item.what_happened} ${item.why_interesting} ${item.big_picture_bridge}`,
        item.tickers.join(" "),
      ),
      title: item.headline,
      detail: item.market_reaction || item.what_happened,
      dateLabel: formatDeskDate(item.occurred_at),
      timestamp: item.occurred_at,
      href: item.source_url,
      external: true,
      verification: item.verification_state,
      storyTitle: story?.title || null,
      regimes: regimeLinks(routes),
      hybridHref: null,
      interpretationState: item.primary_story_id || item.primary_regime_slug ? "observed_pending" as const : null,
      breakdown: null,
      motion: {
        whatHappened: item.what_happened,
        marketReaction: item.market_reaction,
        whyInteresting: item.why_interesting,
        bigPictureBridge: item.big_picture_bridge,
        nextTest: item.next_test,
        lifecycleState: effectiveState,
      },
    };
  });

  const storyDeltas: RawWhatsNewDelta[] = recordLayer.available
    ? recordLayer.events.map((event) => {
      const story = storyById.get(event.story_id);
      const currentVersion = story ? latestVersionByStory.get(story.id) : null;
      const currentTitle = currentVersion?.title || story?.title;
      const human = humaniseStoryEvent(event, currentTitle, versionByEventId, versionByStoryAndNumber);
      const routes = story ? routeStoryToRegimes(story, currentVersion) : [];
      const breakdown = story ? buildStoryBreakdown({
        story,
        version: currentVersion,
        event: { headline: human.title, detail: human.detail, at: event.event_at },
      }) : null;
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
        storyTitle: currentTitle || null,
        regimes: regimeLinks(routes),
        hybridHref: `/hybrid-output?event=${encodeURIComponent(event.id)}`,
        interpretationState: "interpreted" as const,
        breakdown,
      };
    })
    : data.updates.map((update) => {
      const story = storyById.get(update.story_id);
      const currentVersion = story ? latestVersionByStory.get(story.id) : null;
      const currentTitle = currentVersion?.title || story?.title;
      const timestamp = update.observed_at || update.created_at;
      const routes = story ? routeStoryToRegimes(story, currentVersion) : [];
      const breakdown = story ? buildStoryBreakdown({
        story,
        version: currentVersion,
        event: { headline: update.headline, detail: update.detail, at: timestamp },
      }) : null;
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
        storyTitle: currentTitle || null,
        regimes: regimeLinks(routes),
        hybridHref: story ? `/hybrid-output?story=${encodeURIComponent(story.slug)}` : null,
        interpretationState: "interpreted" as const,
        breakdown,
      };
    });

  const now = new Date();
  const deltas: WhatsNewDelta[] = [
    ...motionDeltas,
    ...storyDeltas,
    ...data.statements.map((statement) => {
      const routes = routeTextToRegimes(
        `${statement.speaker} ${statement.topic} ${statement.market_interpretation || ""} ${statement.quote_excerpt || ""} ${(statement.affected_assets || []).join(" ")}`,
        1,
      );
      return {
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
        regimes: regimeLinks(routes),
        hybridHref: null,
        interpretationState: routes.length ? "observed_pending" as const : null,
        breakdown: null,
      };
    }),
    ...data.newsThreads.map((thread) => {
      const routes = routeTextToRegimes(
        `${thread.category || ""} ${thread.headline} ${thread.current_view || ""} ${thread.summary || ""} ${(thread.affected_assets || []).join(" ")}`,
        1,
      );
      return {
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
        regimes: regimeLinks(routes),
        hybridHref: null,
        interpretationState: routes.length ? "observed_pending" as const : null,
        breakdown: null,
      };
    }),
  ]
    .sort((a, b) => Date.parse(b.timestamp || "") - Date.parse(a.timestamp || ""))
    .slice(0, 60)
    .map((delta) => ({ ...delta, ...presentationAge(delta.timestamp, now) }));

  return (
    <LiveDeskShell
      activePath="/whats-new"
      title="What’s New"
      description="Chronological market motion plus canonical Story deltas: what just happened, why it matters, which Regime it touches, and whether the interpretation is still pending."
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
          title="Motion + delta stream"
          description="Fresh Motion sits beside canonical Story history. Headlines remain hooks until verification and evidence justify promotion into a durable Story or investigation."
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
