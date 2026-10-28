import Link from "next/link";
import styles from "./DailyEditorialRundown.module.css";

type NewsSignal = { headline: string; summary: string; sourceUrl: string; sourceName: string; occurredAt: string };
type CalendarSignal = { title: string; decidingQuestion: string; sourceUrl: string; sourceName: string; scheduledAt: string | null };
type Props = { asOf: string; news: readonly NewsSignal[]; upcoming: readonly CalendarSignal[] };

type Source = { name: string; url: string };
type Idea = {
  rank: number; lane: string; timing: string; title: string; assertion: string;
  presenter: string[]; headline: string; test: string; caution: string; sources: Source[];
  link?: string;
};

const OCTOBER_28: readonly Idea[] = [
  {
    rank: 1, lane: "PRESENTATION LEAD", timing: "FOMC 2:00 PM ET — UPCOMING",
    title: "The Fed's real decision is what happens next.",
    assertion: "A hold is widely expected. The market-moving question is whether the Fed leaves the door open to another hike in December, and how yields and the dollar respond.",
    presenter: [
      "Start with the expectation: a hold is not itself a surprise.",
      "Ask whether Chair Warsh signals another hike, or more time to assess inflation and growth.",
      "Check the 2-year Treasury yield, DXY, gold and SPX against the statement and press conference rather than claiming a move beforehand."
    ],
    headline: "The Fed May Hold Rates. The Real Test Is December.",
    test: "2:00 PM ET statement, subsequent press conference, then matched DXY/US02Y/gold/SPX response.",
    caution: "The 28 October FOMC decision has NOT been released at this edition's cutoff. This is a scenario-based preview.",
    sources: [
      { name: "Federal Reserve meeting calendar", url: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm" },
      { name: "US Treasury official yield observations", url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value_month=202610" }
    ]
  },
  {
    rank: 2, lane: "BEST FUNDAMENTALS ARTICLE", timing: "RELEASED 28 OCT · ORIGINAL COMPANY RESULTS",
    title: "AI chip makers are minting money. Who is paying for it?",
    assertion: "SK hynix posted ₩104.6tn of revenue and ₩83.3tn of operating profit in Q3—about an 80% margin. That is evidence of strong supplier economics, but it does not prove every AI customer will earn back its investment.",
    presenter: [
      "Show the actual SK hynix revenue, profit and HBM4 ramp rather than generic AI-bubble claims.",
      "Contrast the chip maker's earnings with Meta's priced $25bn forward equity and $12.5bn convertible preferred financing. These are distinct capital arrangements, not cash already spent.",
      "Ask where future AI revenue, free cash flow and debt-service capacity must land for this build-out to pay off."
    ],
    headline: "SK hynix's 80% Margin Meets AI's Growing Funding Bill.",
    test: "Microsoft/Alphabet earnings and cash-flow guidance; HBM order terms; hyperscaler 2027 capex and free cash flow.",
    caution: "SK hynix figures are issuer-reported preliminary results; Meta equity offering and hardware leases are different transactions. Financing complexity is not evidence of default or an imminent bubble collapse.",
    sources: [
      { name: "SK hynix Q3 earnings", url: "https://news.skhynix.com/en/q3-2026-business-results/" },
      { name: "Meta priced financing terms", url: "https://www.prnewswire.com/news-releases/meta-announces-pricing-of-offering-of-depositary-shares-representing-series-a-mandatory-convertible-preferred-stock-and-offering-of-class-a-common-stock-in-connection-with-forward-sale-agreements-302920247.html" }
    ]
  },
  {
    rank: 3, lane: "BEST COMPLETED FX STORY", timing: "DECISION 27 OCT 9:00 PM ET · COMPLETED",
    title: "New Zealand surprised traders; Australia moved the other way.",
    assertion: "The RBNZ voted 4–3 to hold its rate at 2.75% when a 3.00% hike was expected. NZD/USD fell sharply in Reuters' Asian-session report. Australia simultaneously reported 4.3% annual inflation.",
    presenter: [
      "Lead with expectations versus actual: 3.00% expected, 2.75% delivered.",
      "Explain why a no-change rate decision can weaken NZD even if the bank still expects future tightening.",
      "Compare AUD/NZD, NZ and Australian short-term rates and December policy expectations, without inventing an event-matched chart."
    ],
    headline: "RBNZ's Surprise Pause Exposes a New AUD/NZD Divide.",
    test: "NZD/USD and AUD/NZD follow-through, relative two-year rates and RBNZ's 9 December meeting.",
    caution: "The reported 1.7% NZD/USD fall is a session observation, not a verified minute-by-minute causal measurement. The RBNZ pause was not a promise to ease.",
    sources: [
      { name: "RBNZ official 4–3 decision", url: "https://www.rbnz.govt.nz/news-and-events/news/2026/10/ocr-held-at-2-75-percent" },
      { name: "ABS September CPI", url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/sep-2026" },
      { name: "Reuters currency reaction", url: "https://www.reuters.com/business/dollar-holds-gains-ahead-fed-policy-signal-rbnz-decision-2026-10-28/" }
    ],
    link: "/key-stories#rbnz-october-2026"
  }
];

const OCTOBER_28_WATCH: Source[] = [
  { name: "Hormuz: conflicting strike warnings and peace negotiations", url: "https://app.notion.com/p/407519b67a94812a89d0ecc9ba2ef18c" },
  { name: "EIA weekly oil report, 10:30 AM ET (upcoming)", url: "https://www.eia.gov/petroleum/supply/weekly/" }
];

function malaysiaDay(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date(iso));
  const get = (key: string) => parts.find(part => part.type === key)?.value || "";
  return get("year") + "-" + get("month") + "-" + get("day");
}

function signalLane(headline: string): string {
  if (/fomc|federal reserve|\bfed\b|rate decision|treasury|yields?/i.test(headline)) return "CENTRAL BANKS & RATES";
  if (/ai\b|chip|hynix|memory|nvidia|semiconductor|capex|microsoft|alphabet/i.test(headline)) return "AI & COMPANY FUNDAMENTALS";
  if (/oil|brent|hormuz|iran|opec|gas|fuel|saudi/i.test(headline)) return "OIL & GEOPOLITICS";
  if (/nz|australia|currency|yen|dollar|forex|\bfx\b/i.test(headline)) return "CURRENCIES";
  return "MARKETS & EARNINGS";
}

function decidingPrompt(lane: string): string {
  switch (lane) {
    case "CENTRAL BANKS & RATES": return "What changed versus policy expectations, and what would the short end of the yield curve need to confirm?";
    case "AI & COMPANY FUNDAMENTALS": return "Are profits and cash conversion keeping up with the spending required to sustain growth?";
    case "OIL & GEOPOLITICS": return "Is physical supply actually affected, or is this a risk premium built on still-unconfirmed headlines?";
    case "CURRENCIES": return "Has the relative rate outlook really moved enough to justify the currency response?";
    default: return "Which numbers beat or missed expectations, and does the forward guidance change the valuation?";
  }
}

export default function DailyEditorialRundown({ asOf, news, upcoming }: Props) {
  const dated = malaysiaDay(asOf);
  const curated = dated === "2026-10-28";
  const candidates = [...news.map(n => ({
    title: n.headline, summary: n.summary, sourceName: n.sourceName,
    sourceUrl: n.sourceUrl, at: n.occurredAt, preview: false
  })), ...upcoming.map(e => ({
    title: e.title, summary: e.decidingQuestion || "Compare the result with expectations.",
    sourceName: e.sourceName, sourceUrl: e.sourceUrl, at: e.scheduledAt || "", preview: true
  }))];
  const seen = new Set<string>();
  const fallback = candidates.sort((a,b) => {
    const priority = (x: typeof a) => /fomc|fed|cpi|earnings|rate decision|hynix|oil|brent|nvidia/i.test(x.title) ? 2 : 0;
    return priority(b)-priority(a) || Date.parse(b.at)-Date.parse(a.at);
  }).filter(item => {
    const lane = signalLane(item.title);
    if (seen.has(lane)) return false;
    seen.add(lane);
    return true;
  }).slice(0,3);

  return <section className={styles.board} id="editorial-rundown" data-editorial-rundown={curated ? "curated-2026-10-28" : "source-derived-preview"} aria-labelledby="editorial-rundown-heading">
    <header className={styles.top}>
      <div>
        <p className={styles.eyebrow}>YOUR PRESENTATION & ARTICLE PLAN · {dated}</p>
        <h2 id="editorial-rundown-heading">What should I talk about today?</h2>
        <p>Start here. Three ranked subjects with a clear audience question, an angle worth writing and the evidence to check on air. The broader research archive follows below.</p>
      </div>
      <div className={styles.topAside}>
        <strong>{curated ? "3" : fallback.length}</strong>
        <span>{curated ? "editor-selected priorities" : "source-derived leads"}</span>
        <small>{curated ? "Research cutoff: 28 October, before the FOMC release" : "Auto-generated from qualifying news and upcoming calendars; not an editor-reviewed slate"}</small>
      </div>
    </header>
    {curated ? <>
      <div className={styles.grid}>
        {OCTOBER_28.map((idea, i) => <article className={i===0 ? styles.leadCard : styles.storyCard} key={idea.rank}>
          <div className={styles.cardTop}>
            <span className={styles.rank}>{String(idea.rank).padStart(2,"0")}</span>
            <div><p className={styles.lane}>{idea.lane}</p><p className={styles.timing}>{idea.timing}</p></div>
          </div>
          <h3>{idea.title}</h3>
          <p className={styles.assertion}>{idea.assertion}</p>
          <div className={styles.talkSection}>
            <h4>What to say on air</h4>
            <ol>{idea.presenter.map((line,index)=><li key={index}>{line}</li>)}</ol>
          </div>
          <div className={styles.articlePitch}>
            <span>IF WRITING AN ARTICLE</span>
            <strong>{idea.headline}</strong>
          </div>
          <div className={styles.test}><strong>Next deciding test:</strong> {idea.test}</div>
          <p className={styles.caution}><strong>Evidence boundary:</strong> {idea.caution}</p>
          <div className={styles.sources}>{idea.sources.map((source,index)=><a key={index} href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a>)}
            {idea.link ? <Link href={idea.link}>Open expanded Bluebelly story ↗</Link>:null}
          </div>
        </article>)}
      </div>
      <div className={styles.opening}>
        <span>40-SECOND ON-AIR OPENING</span>
        <p>“The market has three very different stories to price today. The Fed is about what happens next, because another unchanged rate wouldn't necessarily settle the December debate. In AI, SK hynix just printed extraordinary profits, but the spending needed to sustain that demand still has to pay for itself. And in currencies, New Zealand has already shown us what happens when a central bank delivers less tightening than traders expected. Let's follow the numbers and see which of those expectations breaks first.”</p>
      </div>
      <div className={styles.watchlist}>
        <strong>Breaking-news watch, not a confirmed fourth trading signal</strong>
        <p>Iran escalation warnings and a proposed Hormuz deal pull oil-risk expectations in opposite directions. Neither is a verified military order or signed settlement; check physical flows and official statements before assigning causality.</p>
        <div className={styles.watchLinks}>{OCTOBER_28_WATCH.map(s=><a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.name} ↗</a>)}</div>
      </div>
    </> : fallback.length ? <div className={styles.fallbackGrid}>
      {fallback.map((item,index)=><article className={styles.fallbackCard} key={item.sourceUrl+item.title}>
        <p className={styles.lane}>{String(index+1).padStart(2,"0")} · {signalLane(item.title)} · {item.preview?"UPCOMING PREVIEW":"DATED SOURCE REPORT"}</p>
        <h3>{item.title}</h3>
        <p>{item.summary}</p>
        <div className={styles.talkSection}><h4>The presenter question</h4><p>{decidingPrompt(signalLane(item.title))}</p></div>
        <div className={styles.articlePitch}><span>ARTICLE STARTING POINT</span><strong>{decidingPrompt(signalLane(item.title))}</strong></div>
        <a href={item.sourceUrl} rel="noopener noreferrer" target="_blank">{item.sourceName} · original record ↗</a>
      </article>)}
    </div> : <p className={styles.empty}>The verified news and scheduled calendar feeds do not contain enough source-backed material for an automatic three-story recommendation. No old editorial pick is recycled as today's news. Check the research below and the calendar for candidates.</p>}
    <p className={styles.foot}>Editorial order is a suggested discussion plan, not a measured ranking of market moves. Events and expected catalysts remain distinct. Quotes, sources and the day's cutoff are shown so this can be refreshed without silently relabelling old research as new.</p>
  </section>;
}
