import type { CatalystCard } from "./bluebelly-catalyst-calendar.ts";

/**
 * Source-qualified, deliberately bounded mega-IPO watchlist.
 * The milestone date is a past filing/statement date, NEVER the listing date.
 * No price, valuation, offer size or launch schedule is inferred.
 */
export type IpoFilingObservation = {
  form: "S-1" | "S-1/A";
  filedOn: string;
  sourceUrl: string;
};

type Candidate = {
  id: string;
  name: string;
  proposedTicker: string | null;
  sourceUrl: string;
  sourceName: string;
  milestoneDate: string;
  milestone: string;
  certainty: "official" | "reported";
  priority: "must_watch" | "watch";
  watchFor: string;
  why: string;
  affectedAssets: string[];
};

const WATCHLIST: readonly Candidate[] = [
  {
    id: "anthropic", name: "Anthropic", proposedTicker: "ANT (proposed)",
    sourceUrl: "https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/0001628280-26-067168-index.html",
    sourceName: "SEC EDGAR · original S-1",
    milestoneDate: "2026-10-26", milestone: "Public S-1 filed",
    certainty: "official", priority: "must_watch",
    watchFor: "S-1 amendments, announced price range, roadshow, SEC effectiveness, final pricing and confirmed trading debut.",
    why: "A large AI-model IPO could test investor appetite for AI cash burn, cloud/compute commitments and governance. The proposed ticker is not a live stock.",
    affectedAssets: ["AI equities", "Cloud and compute", "Semiconductors"],
  },
  {
    id: "openai", name: "OpenAI", proposedTicker: null,
    sourceUrl: "https://openai.com/index/openai-submits-confidential-s-1/",
    sourceName: "OpenAI · original issuer statement",
    milestoneDate: "2026-06-08", milestone: "Confidential draft S-1 announced",
    certainty: "official", priority: "must_watch",
    watchFor: "An issuer-announced public filing, revised IPO intentions, price range and a confirmed listing timetable. No 2026 listing date is established.",
    why: "An eventual offering could reshape public-market AI exposure and capital requirements, but the confidential filing does not announce an IPO date.",
    affectedAssets: ["AI equities", "Cloud and compute", "Semiconductors"],
  },
  {
    id: "databricks", name: "Databricks", proposedTicker: null,
    sourceUrl: "https://www.home.saxo/learn/guides/ipo/upcoming-tech-ipos-in-2026-and-beyond",
    sourceName: "Saxo · candidate overview (secondary)",
    milestoneDate: "2026-10-28", milestone: "Research watch only; no public timetable verified",
    certainty: "reported", priority: "watch",
    watchFor: "Direct company announcement or public SEC registration. Do not turn outside forecasts into a listing date.",
    why: "Data infrastructure is an AI spending and enterprise software theme. This is a research watch, not evidence of a scheduled offer.",
    affectedAssets: ["AI software", "Cloud and data"],
  },
];

function isValidDay(s: string) {
  return /^20\d{2}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s+"T00:00:00Z"))
    && new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
}
function verifiedFiling(filing: IpoFilingObservation | null | undefined, now: Date) {
  if(!filing || !["S-1","S-1/A"].includes(filing.form) || !isValidDay(filing.filedOn)
    || filing.filedOn<"2026-10-26" || filing.filedOn>now.toISOString().slice(0,10)) return false;
  try {
    const u=new URL(filing.sourceUrl);
    return u.protocol==="https:" && u.hostname==="www.sec.gov" && !u.username && !u.password
      && /^\/Archives\/edgar\/data\/2130357\/\d{18}\/\d{10}-\d{2}-\d{6}-index\.html$/.test(u.pathname);
  }catch{return false;}
}

/** All IPOs stay off the dated calendar until an independently confirmed listing
 * date exists. SEC filing acceptance does not create a future calendar appointment.
 */
export function projectMajorIpoWatch({
  now=new Date(), anthropicFiling=null,
}: {now?:Date;anthropicFiling?:IpoFilingObservation|null}={}): CatalystCard[] {
  const on=now.toISOString().slice(0,10);
  return WATCHLIST.filter(record=>record.milestoneDate<=on).map(record=>{
    const observed=record.id==="anthropic" && verifiedFiling(anthropicFiling,now)
      ? anthropicFiling! : null;
    const milestone=observed
      ? (observed.form==="S-1/A"?"S-1 amendment filed":"Public S-1 filed")
      : record.milestone;
    const filedOn=observed?.filedOn || record.milestoneDate;
    const status=milestone+" · "+filedOn+" · IPO date not confirmed";
    return {
      id:"ipo:"+record.id,lane:"ipo",title:record.name+(record.proposedTicker?" · "+record.proposedTicker:""),
      date:null,startAt:null,timePrecision:"tbc",timeLabel:"Listing date not established",
      sourceUrl:observed?.sourceUrl||record.sourceUrl,sourceName:observed?"SEC EDGAR · verified filing":record.sourceName,
      certainty:record.certainty,status,ticker:null,country:null,
      affectedAssets:record.affectedAssets,why:record.why+" Next check: "+record.watchFor,
      priority:record.priority,signalOnly:true,callTimeOnly:false,
    };
  });
}
