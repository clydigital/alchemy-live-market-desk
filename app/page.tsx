import { redirect } from "next/navigation";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import OverviewWorkspace from "@/components/live-desk/OverviewWorkspace";
import type { OverviewEconomicRelease } from "@/components/live-desk/EconomicReleaseReminder";
import { formatDeskDate } from "@/components/live-desk/LiveDeskUi";
import { getEconomicCalendar, type EconomicCalendarEvent } from "@/lib/calendar";
import { getDeskData, type MacroRelease } from "@/lib/data";
import { legacyTabRedirect } from "@/lib/live-desk/routes";
import { getMarketData } from "@/lib/market";
import { getStoryRecordLayer } from "@/lib/persistence/read";
import { getStableStoryFallbackImage } from "@/lib/story-fallback-images";
import { getStoryHeaderImages } from "@/lib/story-images";
import { deriveStoryTags } from "@/lib/story-tags";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const HIGH_IMPACT_RELEASE = /nonfarm|payroll|employment situation|unemployment|average hourly|consumer price|\bcpi\b|producer price|\bppi\b|personal consumption|\bpce\b|fomc|rate decision|monetary.policy|gross domestic|\bgdp\b|retail sales|\bism\b|\bpmi\b|jolts|adp|jobless claims/i;

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
    revisedPrevious: null,
    decidingQuestion: event.decidingQuestion,
    affectedAssets: event.affectedAssets,
    sourceName: event.sourceName,
    sourceUrl: event.sourceUrl,
  };
}

function immediateEconomicRelease(macroReleases: MacroRelease[], calendar: EconomicCalendarEvent[]) {
  const today = malaysiaDateKey();
  const candidates = [
    ...macroReleases.map(macroReleaseCandidate),
    ...calendar.map(calendarReleaseCandidate),
    ...VERIFIED_IMMEDIATE_RELEASES,
  ].filter((item): item is OverviewEconomicRelease => Boolean(item))
    .filter((item) => {
      const distance = dayDistance(item.date, today);
      return distance >= -1 && distance <= 8;
    });

  candidates.sort((a, b) => {
    const aDistance = dayDistance(a.date, today);
    const bDistance = dayDistance(b.date, today);
    const aFutureRank = aDistance >= 0 ? aDistance : 20 + Math.abs(aDistance);
    const bFutureRank = bDistance >= 0 ? bDistance : 20 + Math.abs(bDistance);
    if (aFutureRank !== bFutureRank) return aFutureRank - bFutureRank;
    const priority = releasePriority(a.event) - releasePriority(b.event);
    if (priority) return priority;
    if (a.status !== b.status) return a.status === "Released" ? -1 : 1;
    const aRichness = [a.actual, a.forecast, a.previous, a.revisedPrevious].filter(Boolean).length;
    const bRichness = [b.actual, b.forecast, b.previous, b.revisedPrevious].filter(Boolean).length;
    return bRichness - aRichness;
  });

  return candidates[0] || null;
}

export default async function Page({ searchParams }: PageProps) {
  const query = await searchParams;
  const tabValue = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const legacyTarget = legacyTabRedirect(tabValue);

  if (legacyTarget) redirect(legacyTarget);
  if (tabValue) redirect(`/legacy?tab=${encodeURIComponent(tabValue)}`);

  const [data, market, recordLayer, calendar] = await Promise.all([
    getDeskData(),
    getMarketData(),
    getStoryRecordLayer(),
    getEconomicCalendar(),
  ]);
  const latestRun = data.researchRuns[0];
  const marketContextCount = data.marketObservations.length;
  const mainBreadth = market.breadth.find((item) => item.id === "large-cap") || market.breadth[0];
  const benchmark = market.series.find((series) => series.symbol === "^GSPC");
  const storyById = new Map(data.stories.map((story) => [story.id, story]));
  const immediateRelease = immediateEconomicRelease(data.macroReleases, calendar);

  const storyRows = data.stories.slice(0, 12);
  const storyImages = await getStoryHeaderImages(storyRows.map((story) => story.id), data.sources);
  const stories = storyRows.map((story) => {
    const image = storyImages.get(story.id);
    const fallback = getStableStoryFallbackImage(story.id);
    return {
      id: story.id,
      slug: story.slug,
      title: story.title,
      thesis: story.thesis,
      status: story.article_verdict || story.status,
      confidence: story.confidence,
      assets: story.assets || [],
      tags: deriveStoryTags(story, 6),
      imageUrl: image?.imageUrl || fallback.dataUri,
      fallbackImageUrl: fallback.dataUri,
      imageKind: image?.kind || "fallback" as const,
      imageSourceUrl: image?.articleUrl || null,
      imageSourceTitle: image?.articleTitle || null,
      imagePublisher: image?.publisher || null,
    };
  });

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

  const systems = [
    latestRun ? {
      title: `${latestRun.schedule_slot} run: ${latestRun.status}`,
      detail: `Scheduled ${formatDeskDate(latestRun.scheduled_for)}. ${latestRun.updates_published} Story updates published. ${latestRun.warnings.length} warning(s) recorded.`,
      tone: latestRun.status === "completed" ? "ready" as const : latestRun.status === "failed" ? "risk" as const : "warn" as const,
    } : {
      title: "Research-run status is updating",
      detail: "The latest private run record is not currently available. Story and evidence records remain accessible.",
      tone: "warn" as const,
    },
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
      <OverviewWorkspace
        stories={stories}
        changes={changes}
        systems={systems}
        immediateRelease={immediateRelease}
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
    </LiveDeskShell>
  );
}
