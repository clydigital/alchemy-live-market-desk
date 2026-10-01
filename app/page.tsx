import Link from "next/link";
import { redirect } from "next/navigation";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import OverviewWorkspace from "@/components/live-desk/OverviewWorkspace";
import DailyAssetStateBoard from "@/components/live-desk/DailyAssetStateBoard";
import EconomicReleaseReminder, { type OverviewEconomicRelease } from "@/components/live-desk/EconomicReleaseReminder";
import MacroTrendMonitor from "@/components/live-desk/MacroTrendMonitor";
import MarketRegimeStrip from "@/components/live-desk/MarketRegimeStrip";
import MarketMotionOverview from "@/components/live-desk/MarketMotionOverview";
import NarrativeSpine from "@/components/live-desk/NarrativeSpine";
import RateRegimeOverview from "@/components/live-desk/RateRegimeOverview";
import { Badge, Panel, formatDeskDate } from "@/components/live-desk/LiveDeskUi";
import { getEconomicCalendar, type EconomicCalendarEvent } from "@/lib/calendar";
import { getDeskData, type MacroRelease } from "@/lib/data";
import { buildDailyAssetState } from "@/lib/daily-asset-state";
import { getDossierV2PresentationSelection } from "@/lib/dossier-v2/presentation-reader";
import { legacyTabRedirect } from "@/lib/live-desk/routes";
import { getMarketData } from "@/lib/market";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { getCurrentMarketMotion, marketMotionAttention, selectMarketMotionForOverview } from "@/lib/market-motion";
import { selectLegacyStoriesForLive } from "@/lib/hybrid-publication";
import { getStoryRecordLayer } from "@/lib/persistence/read";
import { getRelatedStoriesForRelease } from "@/lib/release-story-links";
import { buildRegimeProjection, classifyRegimeStory } from "@/lib/regimes";
import { getRegimeDefinition } from "@/lib/regimes";
import { getFourSlotResearchHealth } from "@/lib/research-schedule-health";
import { getStableStoryFallbackImage } from "@/lib/story-fallback-images";
import { getStoryHeaderImages } from "@/lib/story-images";
import { deriveStoryTags } from "@/lib/story-tags";
import { deriveStoryScorecard } from "@/lib/story-scorecard";
import { buildStoryBreakdown } from "@/lib/story-breakdown";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const HIGH_IMPACT_RELEASE = /nonfarm|payroll|employment situation|unemployment|average hourly|consumer price|\bcpi\b|producer price|\bppi\b|personal consumption|personal income and outlays|\bpce\b|fomc|rate decision|monetary.policy|gross domestic|\bgdp\b|retail sales|\bism\b|\bpmi\b|jolts|adp|jobless claims/i;
const RELEASE_LINGER_MS = 48 * 60 * 60 * 1000;

// This verified near-term release fills a temporary gap in the connected calendar
// feed. A live calendar record with an actual value always supersedes it below.
const VERIFIED_IMMEDIATE_RELEASES: OverviewEconomicRelease[] = [
  {
    id: "bls-employment-situation-2026-07",
    event: "US Nonfarm Payrolls",
    date: "2026-08-07",
    timeLabel: "08:30 ET · 20:30 MYT",
    referencePeriod: "July 2026",
    status: "Scheduled",
    actual: null,
    forecast: "80K Reuters median",
    previous: "57K",
    revisedPrevious: null,
    decidingQuestion: "Does payroll growth stay firm enough to reinforce Fed tightening risk, and do revisions, unemployment, wages and participation confirm the headline?",
    affectedAssets: ["DXY", "US2Y", "US10Y", "XAUUSD", "SPX", "NDX"],
    sourceName: "U.S. Bureau of Labor Statistics",
    sourceUrl: "https://www.bls.gov/news.release/empsit.htm",
  },
];

function dateKey(value: string | null | undefined) {
  return value?.slice(0, 10) || "";
}

function malaysiaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function dayDistance(date: string, anchor: string) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${anchor}T00:00:00Z`)) / 86_400_000);
}

function nthSunday(year: number, monthIndex: number, nth: number) {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return 1 + ((7 - firstDay) % 7) + ((nth - 1) * 7);
}

function normaliseMytTime(date: string, label: string) {
  const clean = label.trim();
  if (!clean) return "Time awaiting confirmation";
  if (/MYT|Kuala Lumpur/i.test(clean)) return clean;

  const et = clean.match(/(\d{1,2}):(\d{2})\s*ET/i);
  if (et) {
    const year = Number(date.slice(0, 4));
    const monthIndex = Number(date.slice(5, 7)) - 1;
    const day = Number(date.slice(8, 10));
    const eventDay = Date.UTC(year, monthIndex, day);
    const dstStart = Date.UTC(year, 2, nthSunday(year, 2, 2));
    const dstEnd = Date.UTC(year, 10, nthSunday(year, 10, 1));
    const offset = eventDay >= dstStart && eventDay < dstEnd ? 12 : 13;
    const hour = (Number(et[1]) + offset) % 24;
    return `${clean} · ${String(hour).padStart(2, "0")}:${et[2]} MYT`;
  }

  if (/^\d{1,2}:\d{2}$/.test(clean)) return `${clean} MYT`;
  return clean;
}

function releaseMomentMs(item: OverviewEconomicRelease) {
  const myt = item.timeLabel.match(/(?:^|·|\s)(\d{1,2}):(\d{2})\s*MYT/i);
  if (myt) {
    return Date.parse(`${item.date}T${String(Number(myt[1])).padStart(2, "0")}:${myt[2]}:00+08:00`);
  }
  return Date.parse(`${item.date}T23:59:59+08:00`);
}

function isReleased(item: OverviewEconomicRelease) {
  return Boolean(item.actual) || /released|published|complete/i.test(item.status || "");
}

function isFreshReleased(item: OverviewEconomicRelease, now = Date.now()) {
  if (!isReleased(item)) return false;
  const eventMs = releaseMomentMs(item);
  return Number.isFinite(eventMs) && eventMs <= now && now - eventMs <= RELEASE_LINGER_MS;
}

function releasePriority(name: string) {
  if (/nonfarm|payroll|employment situation/i.test(name)) return 0;
  if (/consumer price|\bcpi\b|fomc|rate decision|monetary.policy/i.test(name)) return 1;
  if (/producer price|\bppi\b|personal consumption|\bpce\b|retail sales|\bism\b|\bpmi\b/i.test(name)) return 2;
  return 3;
}

function macroReleaseCandidate(release: MacroRelease): OverviewEconomicRelease | null {
  if (!HIGH_IMPACT_RELEASE.test(release.release_name)) return null;
  const releaseDate = dateKey(release.release_date);
  if (!releaseDate) return null;
  const released = Boolean(release.actual) || /released|published|complete/i.test(release.status);
  return {
    id: release.id,
    event: release.release_name,
    date: releaseDate,
    timeLabel: normaliseMytTime(releaseDate, release.release_time_label),
    referencePeriod: release.reference_period,
    status: released ? "Released" : "Scheduled",
    actual: release.actual,
    forecast: release.consensus,
    previous: release.previous,
    revisedPrevious: release.revised_previous,
    decidingQuestion: release.watch_question,
    affectedAssets: release.affected_assets || [],
    sourceName: release.agency,
    sourceUrl: release.source_url,
  };
}

function calendarReleaseCandidate(event: EconomicCalendarEvent): OverviewEconomicRelease | null {
  if (!HIGH_IMPACT_RELEASE.test(event.event) && event.category !== "Central bank") return null;
  return {
    id: event.id,
    event: event.event,
    date: event.date,
    timeLabel: normaliseMytTime(event.date, event.timeLabel),
    referencePeriod: event.referencePeriod,
    status: event.status,
    actual: event.actual,
    forecast: event.consensus,
    previous: event.previous,
    revisedPrevious: event.revisedPrevious ?? null,
    decidingQuestion: event.decidingQuestion,
    affectedAssets: event.affectedAssets,
    sourceName: event.sourceName,
    sourceUrl: event.sourceUrl,
  };
}

function weeklyHighImpactReleases(macroReleases: MacroRelease[], calendar: EconomicCalendarEvent[]) {
  const today = malaysiaDateKey();
  const now = Date.now();
  const candidates = [
    ...macroReleases.map(macroReleaseCandidate),
    ...calendar.map(calendarReleaseCandidate),
    ...VERIFIED_IMMEDIATE_RELEASES,
  ].filter((item): item is OverviewEconomicRelease => Boolean(item))
    .filter((item) => {
      const eventMs = releaseMomentMs(item);
      if (Number.isFinite(eventMs) && eventMs <= now) return isFreshReleased(item, now);
      const distance = dayDistance(item.date, today);
      return distance >= 0 && distance <= 8;
    });

  candidates.sort((a, b) => {
    const aFresh = isFreshReleased(a, now);
    const bFresh = isFreshReleased(b, now);
    if (aFresh !== bFresh) return aFresh ? -1 : 1;
    if (aFresh && bFresh) return releaseMomentMs(b) - releaseMomentMs(a);

    const aDistance = dayDistance(a.date, today);
    const bDistance = dayDistance(b.date, today);
    if (aDistance !== bDistance) return aDistance - bDistance;
    const priority = releasePriority(a.event) - releasePriority(b.event);
    if (priority) return priority;
    const aRichness = [a.actual, a.forecast, a.previous, a.revisedPrevious].filter(Boolean).length;
    const bRichness = [b.actual, b.forecast, b.previous, b.revisedPrevious].filter(Boolean).length;
    return bRichness - aRichness;
  });

  return candidates;
}

function scheduleSystemDetail(slot: ReturnType<typeof getFourSlotResearchHealth>["slots"][number]) {
  if (slot.status === "complete") {
    return `Completed ${formatDeskDate(slot.completedAt)}. ${slot.updatesPublished} Story update(s) published. ${slot.warningCount} warning(s). Next ${formatDeskDate(slot.nextAt)}.`;
  }
  if (slot.status === "running") {
    return `Run started around ${formatDeskDate(slot.expectedAt)} and is still in progress. Next scheduled ${formatDeskDate(slot.nextAt)}.`;
  }
  if (slot.status === "blocked") {
    return `The ${formatDeskDate(slot.expectedAt)} run was blocked. ${slot.warningCount} warning(s) recorded. Next scheduled ${formatDeskDate(slot.nextAt)}.`;
  }
  if (slot.status === "failed") {
    return `The ${formatDeskDate(slot.expectedAt)} run failed. ${slot.warningCount} warning(s) recorded. Next scheduled ${formatDeskDate(slot.nextAt)}.`;
  }
  return `No matching run was recorded for ${formatDeskDate(slot.expectedAt)}. Next scheduled ${formatDeskDate(slot.nextAt)}.`;
}

export default async function Page({ searchParams }: PageProps) {
  const query = await searchParams;
  const tabValue = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const legacyTarget = legacyTabRedirect(tabValue);

  if (legacyTarget) redirect(legacyTarget);
  if (tabValue) redirect(`/legacy?tab=${encodeURIComponent(tabValue)}`);

  const [data, market, monitor, recordLayer, calendar, dossierSelection, motionRecords] = await Promise.all([
    getDeskData(),
    getMarketData(),
    getMarketMonitor(),
    getStoryRecordLayer(),
    getEconomicCalendar(),
    getDossierV2PresentationSelection(),
    getCurrentMarketMotion({ limit: 50 }).catch(() => []),
  ]);
  const marketContextCount = data.marketObservations.length;
  const mainBreadth = market.breadth.find((item) => item.id === "large-cap") || market.breadth[0];
  const benchmark = market.series.find((series) => series.symbol === "^GSPC");
  const storyById = new Map(data.stories.map((story) => [story.id, story]));
  const marketMotion = selectMarketMotionForOverview(motionRecords).map((item) => {
    const story = item.primary_story_id ? storyById.get(item.primary_story_id) : null;
    const regime = item.primary_regime_slug ? getRegimeDefinition(item.primary_regime_slug) : null;
    const attention = marketMotionAttention(item);
    return {
      attentionTier: attention.tier,
      attentionScore: attention.score,
      writingPotential: attention.writingPotential,
      attentionReasons: attention.reasons,
      id: item.id,
      headline: item.headline,
      category: item.category,
      lifecycleState: item.lifecycle_state,
      verificationState: item.verification_state,
      whatHappened: item.what_happened,
      marketReaction: item.market_reaction,
      whyInteresting: item.why_interesting,
      bigPictureBridge: item.big_picture_bridge,
      nextTest: item.next_test,
      tickers: item.tickers,
      occurredAt: item.occurred_at,
      sourceName: item.source_name,
      sourceUrl: item.source_url,
      storyTitle: story?.title || null,
      storyHref: story ? `/stories/${story.slug}` : null,
      regimeLabel: regime?.shortTitle || null,
      regimeHref: regime ? `/regimes/${regime.slug}` : null,
    };
  });
  const upcomingReleases = weeklyHighImpactReleases(data.macroReleases, calendar);
  const immediateRelease = upcomingReleases[0] || null;
  const scheduleHealth = getFourSlotResearchHealth(data.researchRuns);
  const dailyAssetState = buildDailyAssetState({ monitor, presentation: dossierSelection.presentation });
  const reasoningInvestigation = dossierSelection.presentation?.watchNext[0] || null;
  const reasoningTone = reasoningInvestigation?.divergence === "MATERIAL"
    ? "risk" as const
    : reasoningInvestigation?.divergence === "PARTIAL" || reasoningInvestigation?.reactionCalibration.requiresReview
      ? "warn" as const
      : reasoningInvestigation?.divergence === "NONE"
        ? "ready" as const
        : "default" as const;
  const regimes = buildRegimeProjection({
    stories: data.stories,
    events: recordLayer.events,
    versions: recordLayer.thesisVersions,
    newsThreads: data.newsThreads,
    statements: data.statements,
    dossier: dossierSelection.presentation,
  });

  const latestVersionByStory = new Map<string, (typeof recordLayer.thesisVersions)[number]>();
  for (const version of recordLayer.thesisVersions) {
    const current = latestVersionByStory.get(version.story_id);
    if (!current || version.version_number > current.version_number || (
      version.version_number === current.version_number && version.effective_at > current.effective_at
    )) latestVersionByStory.set(version.story_id, version);
  }
  const latestEventByStory = new Map<string, (typeof recordLayer.events)[number]>();
  for (const event of recordLayer.events) {
    if (!latestEventByStory.has(event.story_id)) latestEventByStory.set(event.story_id, event);
  }
  const storyRows = selectLegacyStoriesForLive(data.stories, recordLayer.events, recordLayer.thesisVersions);
  const persistentStoryRows = storyRows.filter((story) => (
    classifyRegimeStory(story, latestVersionByStory.get(story.id) || null).maturity === "durable"
  ));
  const releaseStories = getRelatedStoriesForRelease(immediateRelease, persistentStoryRows, 3);
  const storyImages = await getStoryHeaderImages(persistentStoryRows.map((story) => story.id), data.sources);
  const stories = persistentStoryRows.map((story) => {
    const image = storyImages.get(story.id);
    const fallback = getStableStoryFallbackImage(story.id);
    const currentVersion = latestVersionByStory.get(story.id) || null;
    const latestEvent = latestEventByStory.get(story.id);
    const latestLegacyUpdate = !recordLayer.available ? data.updates.find((update) => update.story_id === story.id) : null;
    const breakdown = buildStoryBreakdown({
      story,
      version: currentVersion,
      event: latestEvent
        ? { headline: latestEvent.headline, detail: latestEvent.detail, at: latestEvent.event_at }
        : latestLegacyUpdate
          ? { headline: latestLegacyUpdate.headline, detail: latestLegacyUpdate.detail, at: latestLegacyUpdate.observed_at || latestLegacyUpdate.created_at }
          : null,
    });
    return {
      id: story.id,
      slug: story.slug,
      title: currentVersion?.title || story.title,
      thesis: currentVersion?.thesis || story.thesis,
      status: currentVersion?.status || story.article_verdict || story.status,
      confidence: currentVersion?.confidence ?? story.confidence,
      breakdown,
      scorecard: deriveStoryScorecard({
        confidence: story.confidence,
        sourceQuality: story.source_quality,
        novelty: story.novelty,
        persistence: story.persistence,
        traderRelevance: story.trader_relevance,
        status: story.status,
        nextCatalyst: story.next_catalyst,
      }),
      assets: currentVersion?.assets?.length ? currentVersion.assets : story.assets || [],
      tags: deriveStoryTags(story, 6),
      imageUrl: image?.imageUrl || fallback.dataUri,
      fallbackImageUrl: fallback.dataUri,
      imageKind: image?.kind || "fallback" as const,
      imageSourceUrl: image?.articleUrl || null,
      imageSourceTitle: image?.articleTitle || null,
      imagePublisher: image?.publisher || null,
    };
  }).sort((left, right) => right.scorecard.priority - left.scorecard.priority || right.confidence - left.confidence);

  const changes = recordLayer.available
    ? recordLayer.events.slice(0, 6).map((event) => {
      const story = storyById.get(event.story_id);
      return {
        id: event.id,
        headline: event.headline,
        detail: event.detail,
        date: formatDeskDate(event.event_at),
        storyTitle: story?.title || null,
        updateType: event.event_type,
        recordHref: story ? `/stories/${story.slug}#event-${event.id}` : `/whats-new#record-${event.id}`,
      };
    })
    : data.updates.slice(0, 6).map((update) => {
      const story = storyById.get(update.story_id);
      return {
        id: update.id,
        headline: update.headline,
        detail: update.detail,
        date: formatDeskDate(update.observed_at || update.created_at),
        storyTitle: story?.title || null,
        updateType: update.update_type,
        recordHref: story ? `/stories/${story.slug}#event-${update.id}` : `/whats-new#record-${update.id}`,
      };
    });

  const latestRecordAt = recordLayer.available
    ? recordLayer.events[0]?.event_at
    : data.updates[0]?.observed_at || data.updates[0]?.created_at;

  const scheduleSystems = scheduleHealth.slots.map((slot) => ({
    title: `${slot.label}: ${slot.status}`,
    detail: scheduleSystemDetail(slot),
    tone: slot.status === "complete"
      ? "ready" as const
      : slot.status === "running" || slot.status === "blocked"
        ? "warn" as const
        : "risk" as const,
  }));

  const systems = [
    ...scheduleSystems,
    {
      title: marketContextCount ? "Market context loaded" : "Market context is updating",
      detail: marketContextCount
        ? `${marketContextCount} market observations are available to the desk.`
        : "Current market observations have not returned yet. Research records remain available while prices refresh.",
      tone: marketContextCount ? "ready" as const : "warn" as const,
    },
    {
      title: stories.length ? `${stories.length} Stories mapped` : "Story map is updating",
      detail: stories.length
        ? `Story records retain their thesis, confidence, assets and controlled market-theme tags. ${recordLayer.available ? "Immutable event links are active." : "Dated update links are active."}`
        : "No Story records were returned. The Overview does not insert illustrative replacements.",
      tone: stories.length ? "ready" as const : "risk" as const,
    },
  ];

  return (
    <LiveDeskShell
      activePath="/"
      title="Overview"
      description="Current research health, persistent Story state and exact record access in one operational view."
      meta={(
        <>
          <span className={styles.metaLabel}>Latest material record</span><br />
          {formatDeskDate(latestRecordAt)}
        </>
      )}
    >
      <div style={{ display: "grid", gap: 24 }}>
        <RateRegimeOverview selection={dossierSelection} />
        {dossierSelection.presentation ? (
          <NarrativeSpine dossier={dossierSelection.presentation} regimes={regimes} surface="live" />
        ) : null}
        <MarketMotionOverview items={marketMotion} />
        <MarketRegimeStrip regimes={regimes} />
        {reasoningInvestigation ? (
          <Panel
            title="Expected vs actual"
            description="Highest-priority canonical investigation from the current Dossier. This block reads existing reasoning; it does not create a second interpretation."
            action={(
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Badge tone={reasoningTone}>{reasoningInvestigation.divergence}</Badge>
                <Link className={styles.link} href="/dossier">Open Dossier</Link>
              </div>
            )}
          >
            <div className={styles.recordList}>
              <article className={styles.record}>
                <div className={styles.inlineMeta}>
                  <span className={styles.meta}>What changed</span>
                  <Badge>{reasoningInvestigation.journey.transition.replaceAll("_", " ")}</Badge>
                </div>
                <h3>{reasoningInvestigation.question}</h3>
                <p>{reasoningInvestigation.observedReaction || "No comparable post-event market reaction has been admitted yet."}</p>
              </article>

              <div className={styles.gridTwo}>
                <article className={styles.record}>
                  <span className={styles.meta}>Expected</span>
                  <p>{reasoningInvestigation.expectedReaction || "No preserved pre-event expectation is available yet."}</p>
                </article>
                <article className={styles.record}>
                  <span className={styles.meta}>Actual</span>
                  <p>{reasoningInvestigation.observedReaction || "Reaction evidence is not yet comparable enough to state an actual-versus-expected verdict."}</p>
                </article>
              </div>

              <div className={styles.gridTwo}>
                <article className={styles.record}>
                  <div className={styles.inlineMeta}>
                    <span className={styles.meta}>Biggest contradiction</span>
                    <Badge tone={reasoningTone}>{reasoningInvestigation.divergence}</Badge>
                  </div>
                  <p>{reasoningInvestigation.divergence === "UNRESOLVED"
                    ? "No evidence-backed divergence verdict yet; the exact reaction evidence is incomplete or non-comparable."
                    : reasoningInvestigation.divergence === "NONE"
                      ? "No material contradiction in the measured reaction window."
                      : reasoningInvestigation.currentExplanation}</p>
                </article>
                <article className={styles.record}>
                  <span className={styles.meta}>Current explanation</span>
                  <p>{reasoningInvestigation.currentExplanation}</p>
                </article>
              </div>

              {reasoningInvestigation.candidateExplanations.length ? (
                <article className={styles.record}>
                  <span className={styles.meta}>Candidate mechanisms</span>
                  <div className={styles.recordList}>
                    {reasoningInvestigation.candidateExplanations.slice(0, 3).map((candidate) => (
                      <div key={`${reasoningInvestigation.id}:candidate:${candidate.rank}`}>
                        <strong>#{candidate.rank} · {candidate.confidence}</strong>
                        <p>{candidate.explanation}</p>
                        <small>
                          Evidence for {candidate.evidenceForRefs.length} · against {candidate.evidenceAgainstRefs.length}
                        </small>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}

              <article className={styles.record}>
                <span className={styles.meta}>Investigate next</span>
                <p>{reasoningInvestigation.researchNext}</p>
              </article>
            </div>
          </Panel>
        ) : null}
        <EconomicReleaseReminder releases={upcomingReleases} relatedStories={releaseStories} />
        <DailyAssetStateBoard
          state={dailyAssetState}
          dollarLiquidity={dossierSelection.presentation?.dollarLiquidity ?? null}
          policyLiquidityInteraction={dossierSelection.presentation?.policyLiquidityInteraction ?? null}
        />
        <MacroTrendMonitor observations={data.macroObservations} release={immediateRelease} />
        <OverviewWorkspace
          stories={stories}
          changes={changes}
          systems={systems}
          metrics={{
            stories: data.stories.length,
            sources: data.sources.length,
            evidence: data.evidence.length,
            charts: data.charts.length,
          }}
          pulse={{
            score: Number.isFinite(market.pulseWeek) ? market.pulseWeek : null,
            lastWeekScore: null,
            label: "This week",
            benchmarkMove: benchmark?.change5d ?? null,
            above50: mainBreadth?.current.above50 ?? null,
            above200: mainBreadth?.current.above200 ?? null,
          }}
        />
      </div>
    </LiveDeskShell>
  );
}
