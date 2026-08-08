import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, formatDeskDate, Panel } from "@/components/live-desk/LiveDeskUi";
import WhatsNewWorkspace, { type WhatsNewDelta, type WhatsNewTopic } from "@/components/live-desk/WhatsNewWorkspace";
import { getDeskData } from "@/lib/data";
import { getStoryRecordLayer } from "@/lib/persistence/read";

export const dynamic = "force-dynamic";

const TOPIC_PATTERNS: Array<[WhatsNewTopic, RegExp]> = [
  ["Crypto", /\b(?:crypto|bitcoin|btc|ethereum|eth|stablecoin|blockchain|token)\b/i],
  ["Commodities", /\b(?:oil|brent|wti|crude|gold|silver|copper|commodit(?:y|ies)|energy|lng|gasoline|diesel|xau|xag|refining|crack spread)\b/i],
  ["FX", /\b(?:forex|fx|usd|jpy|eur|gbp|aud|cad|chf|dxy|yen|dollar|sterling|currency|currencies|carry trade|intervention)\b/i],
  ["Earnings", /\b(?:earnings|revenue|eps|guidance|margin|cash flow|investor day|quarterly results?|results season)\b/i],
  ["Macro", /\b(?:cpi|ppi|inflation|payrolls?|nfp|employment|unemployment|labour|labor|gdp|pmi|ism|fed|fomc|boj|ecb|central bank|rates?|yields?|treasur(?:y|ies)|productivity|macro|growth data)\b/i],
  ["Stocks", /\b(?:stock|stocks|equity|equities|nasdaq|s&p|spx|soxx|nikkei|kospi|dow|shares?|semiconductors?|technology|tech|ai|artificial intelligence|megacap|mag7)\b/i],
  ["Geopolitics", /\b(?:iran|hormuz|war|military|missile|strike|sanctions?|ceasefire|diplomacy|diplomatic|geopolitics?|tariffs?|trade war|election|retaliation|conflict)\b/i],
];

function classifyTopic(primary: string, secondary = "", assetText = ""): WhatsNewTopic {
  // Headline/title/category text decides first. This prevents a stray word in a
  // long explanation from turning a tech Story into geopolitics, for example.
  for (const [topic, pattern] of TOPIC_PATTERNS) {
    if (pattern.test(primary)) return topic;
  }

  // Assets are useful when the headline is generic, but deliberately sit below
  // the headline so USDJPY inside an oil Story does not override an oil title.
  const assets = assetText.toUpperCase();
  if (/\b(?:BTCUSD|ETHUSD|BTC|ETH|COIN|MSTR)\b/.test(assets)) return "Crypto";
  if (/\b(?:USOIL|UKOIL|WTI|BRENT|XAUUSD|XAGUSD|XAU|XAG|GOLD|SILVER|DIESEL_CRACK|GASOLINE_CRACK|LNG)\b/.test(assets)) return "Commodities";
  if (/\b(?:DXY|USDJPY|GBPJPY|AUDJPY|EURUSD|GBPUSD|USDCHF|USDCAD|EURJPY|[A-Z]{3}JPY)\b/.test(assets)) return "FX";
  if (/\b(?:SPX|NASDAQ|NDX|QQQ|RSP|SOXX|SMH|NIKKEI|KOSPI|AAPL|MSFT|AMZN|GOOGL|META|NVDA|AMD|TSLA|BABA|MU|WDC|SNDK)\b/.test(assets)) return "Stocks";
  if (/\b(?:US02Y|US05Y|US10Y|US30Y|TLT|IEF|SHY)\b/.test(assets)) return "Macro";

  for (const [topic, pattern] of TOPIC_PATTERNS) {
    if (pattern.test(secondary)) return topic;
  }
  return "Other";
}

export default async function WhatsNewPage() {
  const [data, recordLayer] = await Promise.all([getDeskData(), getStoryRecordLayer()]);
  const storyById = new Map(data.stories.map((story) => [story.id, story]));

  const storyDeltas: WhatsNewDelta[] = recordLayer.available
    ? recordLayer.events.map((event) => {
      const story = storyById.get(event.story_id);
      return {
        id: event.id,
        kind: event.event_type,
        stream: "Story" as const,
        topic: classifyTopic(
          `${story?.title || ""} ${event.headline}`,
          `${story?.thesis || ""} ${event.detail || ""}`,
          (story?.assets || []).join(" "),
        ),
        title: event.headline,
        detail: event.detail || "No additional detail was stored for this Story event.",
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
        kind: update.update_type,
        stream: "Story" as const,
        topic: classifyTopic(
          `${story?.title || ""} ${update.headline}`,
          `${story?.thesis || ""} ${update.detail || ""}`,
          (story?.assets || []).join(" "),
        ),
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
      kind: "statement",
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
