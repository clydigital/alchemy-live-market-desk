/**
 * Explicit dated fallbacks from the BLS original November 2026 schedule.
 * Verified against https://www.bls.gov/schedule/2026/11_sched_list.htm on
 * 22 October 2026. Do not extrapolate from monthly recurrence; prefer live
 * official tables/ICS when they become available, and never manufacture an
 * Actual, consensus, previous, or source-published clock.
 *
 * These expire naturally when the reader and seed window move past the date.
 */
import type { EconomicCalendarEvent } from "./calendar.ts";

const sourceUrl = "https://www.bls.gov/schedule/2026/11_sched_list.htm";
type OriginalRelease = {
  id: string; date: string; event: string; referencePeriod: string;
  category: EconomicCalendarEvent["category"]; timeLabel: string;
  question: string; assets: string[];
};
const releases: OriginalRelease[] = [
  {
    id: "us-bls-2026-11-03-jolts-september-2026",
    date: "2026-11-03", timeLabel: "10:00 ET",
    event: "Job Openings and Labor Turnover Survey for September 2026",
    referencePeriod: "September 2026", category: "Labour",
    question: "Do job openings and quits alter labour and Fed expectations?",
    assets: ["USD", "US02Y", "SPX"],
  },
  {
    id: "us-bls-2026-11-06-employment-situation-october-2026",
    date: "2026-11-06", timeLabel: "08:30 ET",
    event: "Employment Situation for October 2026",
    referencePeriod: "October 2026", category: "Labour",
    question: "Do payrolls, unemployment and wages change expectations for Fed policy?",
    assets: ["USD", "US02Y", "SPX", "GOLD"],
  },
  {
    id: "us-bls-2026-11-10-cpi-october-2026",
    date: "2026-11-10", timeLabel: "08:30 ET",
    event: "Consumer Price Index for October 2026",
    referencePeriod: "October 2026", category: "Inflation",
    question: "Do headline and core CPI change front-end yields and Fed expectations?",
    assets: ["USD", "US02Y", "SPX", "GOLD"],
  },
  {
    id: "us-bls-2026-11-13-ppi-october-2026",
    date: "2026-11-13", timeLabel: "08:30 ET",
    event: "Producer Price Index for October 2026",
    referencePeriod: "October 2026", category: "Inflation",
    question: "Do upstream price pressures reinforce or contradict the CPI signal?",
    assets: ["USD", "US02Y", "SPX", "GOLD"],
  },
];

export const verifiedNovember2026BlsSchedules: EconomicCalendarEvent[] = releases.map(row => ({
  id: row.id, date: row.date, timeLabel: row.timeLabel,
  country: "United States", g7Markets: ["United States"],
  event: row.event, category: row.category, impact: "High",
  referencePeriod: row.referencePeriod,
  status: "Scheduled",
  actual: null, consensus: null, previous: null, alchemyExpectation: null,
  decidingQuestion: row.question, affectedAssets: row.assets,
  sourceName: "U.S. Bureau of Labor Statistics", sourceUrl,
  sourceKind: "official-schedule",
}));
