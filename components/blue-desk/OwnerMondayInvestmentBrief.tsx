import "server-only";
import Link from "next/link";
import ui from "./OwnerPortfolioHome.module.css";

/** Private, manually verified investment review. Do not fetch or publish Newsroom/Regime data. */
const EDITION = "2 Nov 2026 · Monday prep";
const BASELINE = "30 Oct 2026 completed equity session";
type Review = {ticker:string;close:string;day:string;three:string;five:string;action:string;why:string;gate:string};
const holdings:Review[] = [
 {ticker:"YTLPOWR",close:"RM5.32",day:"+0.38%",three:"+4.31%",five:"0.00%",
  action:"TRIM / CONCENTRATION REVIEW",
  why:"Archived 1,000 shares represented roughly 39.5% of priced holdings on Friday, excluding its unpriced linked warrant.",
  gate:"Confirm today's quantity, capital denominator, paid power contracts and warrant 6742UW terms."},
 {ticker:"DAYANG",close:"RM1.39",day:"+2.21%",three:"+4.51%",five:"+5.30%",
  action:"SELL / RECYCLE REVIEW",
  why:"Q2 2026 revenue fell from RM267.349m to RM161.177m and attributable profit from RM76.642m to RM32.841m year-on-year. The Friday rebound is not evidence of operating repair.",
  gate:"Verify latest company release, order-book utilisation, position and sell-side liquidity."},
 {ticker:"TSLA",close:"US$399.81",day:"−0.87%",three:"−1.88%",five:"+7.41%",
  action:"TRIM REVIEW; DO NOT CHASE",
  why:"The five-session rebound returned price towards US$400 without proving automotive margin or autonomy cash economics.",
  gate:"Confirm live US session price, actual holding weight and issuer cash returns."},
 {ticker:"TTWO",close:"US$190.17",day:"−1.67%",three:"−5.52%",five:"−6.64%",
  action:"HOLD / EVENT REVIEW",
  why:"Five-session weakness raises the importance of launch execution; archived research identifies the GTA VI release catalyst for 19 November.",
  gate:"Verify publisher's current official launch calendar and updated bookings outlook."},
 {ticker:"XOM",close:"US$187.25",day:"+2.16%",three:"+4.08%",five:"+2.21%",
  action:"HOLD / NO ADD",
  why:"Exxon's 30 October Q3 release reports US$25.7bn operating cash flow and US$19.1bn free cash flow; existing oil/shipping exposure still overlaps.",
  gate:"Check portfolio energy weight and physical Hormuz shipping evidence, not AIS vessel counts alone."},
];
const opportunities=[
 {ticker:"VGIT / IEF",action:"FIRST DIVERSIFIER TO STUDY",price:"Price not validated here",
  rationale:"Intermediate Treasury duration can diversify an AI-heavy risk book, but rising yields and USD/MYR can offset carry.",
  gate:"Confirm real yields, duration, actual MYR buying power and broker ETF eligibility."},
 {ticker:"CF",action:"WAIT FOR 4 NOV EARNINGS",price:"US$123.30 · 30 Oct",
  rationale:"Fertiliser cash-generation thesis is attractive outside AI, but Friday's +4.41% bounce is not a fresh valuation.",
  gate:"Review original Q3 earnings, gas/nitrogen spreads, free cash flow and updated quote before a starter."},
 {ticker:"MU / TSM",action:"DEMAND VERIFIED; ENTRY NOT",price:"MU US$884.74 · 30 Oct",
  rationale:"Official Korean October exports (+93.7%; chips +259.4%) strengthen AI-memory demand evidence while MU fell 5.30% on Friday.",
  gate:"Require issuer HBM orders, pricing and cash conversion, plus semiconductor relative-strength recovery."},
 {ticker:"GRAB",action:"WAIT / CREDIT UNDERWRITE",price:"US$2.71 · 30 Oct",
  rationale:"Atome expands the earnings opportunity but raises the need to verify consumer-loan losses and funding.",
  gate:"Verify loan vintages, defaults, cash uses and current enterprise value."},
] as const;
const sourceLinks=[
 {label:"Manual Power Stack decision report",url:"https://github.com/clydigital/power-stack/blob/main/research/daily/2026-11-01-independent-issuer-vs-bluebelly-decisions.md"},
 {label:"Friday 1D / 3D / 5D tape",url:"https://github.com/clydigital/power-stack/blob/main/data/holding-tape.json"},
 {label:"ExxonMobil Q3 release",url:"https://investor.exxonmobil.com/company-information/press-releases/detail/1213/exxonmobil-announces-third-quarter-2026-results"},
 {label:"Dayang Q2 company filing",url:"https://dayang.listedcompany.com/news.html/id/2625162"},
 {label:"Korean trade ministry (original)",url:"https://www.motir.go.kr/kor/article/ATCL3f49a5a8c/172360/view"},
 {label:"Bluebelly 1 Nov MacroPulse",url:"https://app.notion.com/p/40b519b67a9481eaa430ed3959f783cf"},
];
const horizons=(r:Review)=><span className={ui.mondayHorizon}>1D {r.day} <span aria-hidden="true">·</span> 3D {r.three} <span aria-hidden="true">·</span> 5D {r.five}</span>;
export default function OwnerMondayInvestmentBrief(){
 return <section className={ui.mondayBrief} aria-labelledby="mondayInvestmentHeading" data-private-investment-brief="2026-11-02">
   <div className={ui.mondayTop}>
    <div><p className={ui.kicker}>PRIVATE INVESTMENT REVIEW / {EDITION}</p>
     <h3 id="mondayInvestmentHeading">Protect capital first. Buy selectively.</h3>
     <p>Bluebelly's breadth shows a sharp one-day setback despite five-session improvement. The independent issuer check supports strong semiconductor demand, but not a blanket AI dip-buy signal.</p>
    </div>
    <Link href="/markets">Compare Bluebelly Markets</Link>
   </div>
   <div className={ui.mondayFacts}>
    <div><small>Market-price reference</small><strong>{BASELINE}</strong></div>
    <div><small>50D participation</small><strong>60.23%</strong><span>1D −4.77 percentage points</span></div>
    <div><small>200D participation</small><strong>59.44%</strong><span>1D −4.37 percentage points</span></div>
    <div><small>Capital basis</small><strong>RM13,491</strong><span>Historic total mandate, not cash</span></div>
   </div>
   <p className={ui.mondayVintage}>As-of discipline: this is a fixed manual research edition, prepared for Monday 2 November using Friday 30 October closes. It does not display intraday Bursa or US prices. The sortable portfolio table below carries separate source-dated 1D / 3D / 5D readings. Archived quantities are mostly from 2 October, not broker-confirmed positions.</p>
   <h4 className={ui.mondaySectionTitle}>Existing holdings: Monday priority order</h4>
   <div className={ui.mondayReviews}>
    {holdings.map((r,i)=><article key={r.ticker} className={ui.mondayReview}>
      <div className={ui.mondayRowTop}><strong>{i+1}. {r.ticker}</strong><span>{r.action}</span></div>
      <div className={ui.mondayQuote}><b>{r.close}</b>{horizons(r)}</div>
      <p>{r.why}</p><p><b>Before acting:</b> {r.gate}</p>
    </article>)}
   </div>
   <h4 className={ui.mondaySectionTitle}>New capital: alternative uses of each ringgit</h4>
   <div className={ui.mondayOpportunities}>
    {opportunities.map(o=><article key={o.ticker}>
     <div className={ui.mondayRowTop}><strong>{o.ticker}</strong><span>{o.action}</span></div>
     <small>{o.price}</small>
     <p>{o.rationale}</p><p><b>Decision gate:</b> {o.gate}</p>
    </article>)}
   </div>
   <details className={ui.mondayDetails}>
    <summary>Why this differs from blindly following Bluebelly stories</summary>
    <p><b>Semiconductors:</b> The Korean ministry release independently confirms the export acceleration discussed in Bluebelly's MacroPulse. It validates demand, not future issuer margins or an entry price.</p>
    <p><b>Energy:</b> Exxon's released cash flow supports holding the existing business; uncertain Hormuz passages do not justify adding to a correlated energy portfolio.</p>
    <p><b>Rates and breadth:</b> The higher-yield regime is not yet a verified system-wide credit crisis. Falling one-day breadth does not invalidate five-session improvement; wait for breadth, credit, prices and issuer cash to agree.</p>
    <p><b>Capital rule:</b> Review Dayang and YTL-linked risk before assuming fresh buying power. An old RM13,491 total-capital mandate is not an additional RM13,491 deposit.</p>
   </details>
   <div className={ui.mondayFooter}>
    <strong>Monday checkpoints · MYT:</strong> Bursa opened 9:00 AM · Hong Kong opened 9:30 AM · US cash session opens 10:30 PM (after the US daylight-saving change).
    <div className={ui.mondaySources}>{sourceLinks.map(s=><a href={s.url} key={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>)}</div>
    <p>Research only. No order, score change, portfolio position change, Bluebelly story edit or automatic investment mandate change.</p>
   </div>
 </section>;
}
