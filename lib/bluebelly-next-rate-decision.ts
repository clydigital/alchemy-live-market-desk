import type { PresenterCalendarEvent } from "./presenter-calendar.ts";

type RateSeries = { id: string; symbol: string; frequency: string; sourceName: string; sourceUrl: string; points: readonly { time: number; close: number }[] };
export const FEDWATCH_URL = "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html";
export const FOMC_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";

export function nextFomcDecision(events: readonly PresenterCalendarEvent[], now: Date) {
  return events.filter(e => e.kind === "economic" && e.status === "scheduled" && e.verificationState === "official" &&
    /\bFOMC\b.*\bdecision\b/i.test(e.title) && e.scheduledAt && Date.parse(e.scheduledAt) > +now)
    .sort((a,b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!))[0] ?? null;
}

export function buildFedRateWatch(rows: readonly RateSeries[], now: Date) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return [{id:"us2y",symbol:"DGS2",label:"US 2Y yield",description:"Policy expectations proxy"},
    {id:"fed-funds-effective",symbol:"DFF",label:"Effective Fed funds",description:"Observed overnight rate"}].map(spec => {
    const series = rows.find(r => r.id === spec.id && r.frequency === "daily" && (r.symbol === spec.symbol || (spec.symbol === "DGS2" && r.symbol === "US2Y" && r.sourceName === "U.S. Department of the Treasury")));
    const dates = new Map<string, number>();
    let conflict = false;
    for (const p of series?.points ?? []) {
      if (!Number.isFinite(p.time) || !Number.isFinite(p.close)) continue;
      const date = new Date(p.time * 1000);
      if (!Number.isFinite(+date)) continue;
      const day = date.toISOString().slice(0,10);
      if (day >= today) continue; // completed source dates only
      if (dates.has(day) && dates.get(day) !== p.close) conflict = true;
      dates.set(day,p.close);
    }
    const points = conflict ? [] : [...dates].sort(([a],[b])=>a.localeCompare(b));
    const latest = points.at(-1), prior = points.at(-2);
    const valid = !!latest && Date.parse(today)-Date.parse(latest[0]) <= 7*86400000;
    const matched = valid && !!prior && Date.parse(latest![0])-Date.parse(prior[0]) <= (spec.symbol === "DFF" ? 1 : 4)*86400000;
    const fredUrl = `https://fred.stlouisfed.org/series/${spec.symbol}`;
    const treasury = series?.symbol === "US2Y";
    return {...spec,asOf:latest?.[0]??null,level:valid?latest![1]:null,
      changeBp:matched?Math.round((latest![1]-prior![1])*1000)/10:null,
      priorDate:matched?prior![0]:null,sourceUrl:treasury?series!.sourceUrl:fredUrl,sourceName:treasury?"US Treasury":"FRED",fredUrl};
  });
}
