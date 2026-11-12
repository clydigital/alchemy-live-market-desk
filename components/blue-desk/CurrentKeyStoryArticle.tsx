import Link from "next/link";
import NvidiaEarningsDecisionWatch from "@/components/blue-desk/NvidiaEarningsDecisionWatch";
import {NVIDIA_EARNINGS_WATCH as nvda} from "@/lib/bluebelly-nvidia-earnings-watch";
import {getManualSweeps} from "@/lib/bluebelly-manual-sweeps";
import css from "./CurrentKeyStoryArticle.module.css";
type Kind="nvidia"|"ai-financing";

export default function CurrentKeyStoryArticle({kind,now,backHref}:{kind:Kind;now:Date;backHref:string}){
 const isNvidia=kind==="nvidia";
 const ai=getManualSweeps("ai",now,8);
 const coreweave=ai.find(x=>x.id.includes("coreweave") && x.findings.some(f=>f.status==="SOURCE_CORROBORATED"));
 const nebius=ai.find(x=>x.id.includes("nebius") && x.findings.some(f=>f.status==="SOURCE_CORROBORATED"));
 const coreEvidence=coreweave?.findings.find(f=>f.status==="SOURCE_CORROBORATED");
 const nebEvidence=nebius?.findings.find(f=>f.status==="SOURCE_CORROBORATED");
 return <article className={css.article} data-current-key-story={kind} data-story-evidence="dated-source-reviewed-noncanonical">
  <nav className={css.breadcrumb}><Link href={backHref}>← All Key Stories</Link> <span>/</span> {isNvidia?"NVIDIA · Leadership and earnings":"AI finance · Compute demand and cost"}</nav>
  <header className={css.hero}>
   <span className={css.kicker}>BLUEBELLY KEY STORY · SOURCE-REVIEWED EDITION · 13 NOVEMBER 2026 MYT</span>
   <h1>{isNvidia?"NVIDIA's Founder Is Out. Has the Market Just Created a Buying Opportunity?":"AI Demand Is Booming. Why Are Its Cloud Builders Under Financial Pressure?"}</h1>
   <p className={css.standfirst}>{isNvidia?
    "Jensen Huang's departure is confirmed, but no collapse in GPU orders has been established. The investment question is whether earnings and customer commitments survive a leadership shock—and how much uncertainty the market has already priced in.":
    "CoreWeave and Nebius are still demonstrating strong appetite for AI computing. Their results reveal the less comfortable part: borrowing costs, deployment bottlenecks and capital spending can grow faster than profitable cash generation."}</p>
   <div className={css.markers}>
    <span>{isNvidia?"ISSUER DECISION CONFIRMED":"ISSUER RESULTS VERIFIED"}</span>
    <span>MARKET CAUSE NOT ESTABLISHED</span>
    <span>FORWARD SCENARIOS · CONDITIONAL</span>
   </div>
  </header>
  {isNvidia?<div className={css.content}>
   <section className={css.question}>
    <span className={css.kicker}>THE CONTRADICTION</span>
    <h2>Higher uncertainty about the CEO. But what has actually changed for customers?</h2>
    <p>NVIDIA's board confirmed Huang resigned on 12 November. Colette Kress, CFO since 2013, became interim CEO. That resolves the immediate leadership decision but introduces succession, strategy and regulatory uncertainty. The board's expectation of normal operations is a management statement, not independently observed order flow.</p>
    <p>The distinction matters for valuation: investors can demand a larger risk premium from NVIDIA equity even while AI service providers continue ordering hardware. A fall in the stock alone is not proof that GPU demand disappeared.</p>
   </section>
   <NvidiaEarningsDecisionWatch mode="regime" now={now}/>
   <section className={css.question}>
    <span className={css.kicker}>THE LONG-TERM INVESTOR TEST</span>
    <h2>When is a steep decline a value opportunity rather than a value trap?</h2>
    <p><strong>Positive interpretation:</strong> The existing CUDA ecosystem, installed systems and delivery pipeline remain valuable. If NVIDIA meets its prior $108 billion revenue guidance, protects margins and confirms unchanged customer commitments, the governance discount could narrow even before a permanent CEO is appointed.</p>
    <p><strong>Negative interpretation:</strong> A large AI infrastructure cycle depends partly on capital availability and coordinated supply. If customer financing, export permissions or operating cash weaken, even a near-term revenue beat may not preserve the market's previous valuation multiple.</p>
    <p><strong>Chart discipline:</strong> The user's 12 November daily TradingView screenshot showed extraordinary turnover and a sharp reversal attempt. Turnover is two-sided: it does not distinguish accumulation from short covering. A durable bottom requires a confirmed closing and subsequent retest, followed by recapturing a respected daily EMA band. A single oversold oscillator reading does not establish a trend change.</p>
    <p><strong>Next decision:</strong> Compare the official 17 November results, forward guidance and CFO remarks against previous issuer guidance and appropriately dated consensus. Then compare NVDA, SMH, AMD and AVGO on matched market windows rather than inferring causality from broad session returns.</p>
   </section>
   <footer className={css.sources}>
    <p>This edition is a source-dated interpretation, not an actual Q3 earnings announcement, verified share-price bottom, brokerage position or canonical AI Regime update.</p>
    <a href={nvda.transition.originalUrl} target="_blank" rel="noopener noreferrer">Original NVIDIA leadership announcement ↗</a>
    <a href={nvda.previousQuarter.originalUrl} target="_blank" rel="noopener noreferrer">Original NVIDIA prior quarter and guidance ↗</a>
   </footer>
  </div>:<div className={css.content}>
   <section className={css.question}>
    <span className={css.kicker}>01 / WHAT IS THE MARKET MISREADING?</span>
    <h2>More demand for computing is not the same as more value for every AI-cloud shareholder.</h2>
    <p>CoreWeave's Q3 2026 original release reported $3.661 billion of revenue, $846 million net interest expense and a $709 million net loss. Strong revenue is a demand signal. The interest burden is a financing signal. Both can be true simultaneously, and neither alone establishes whether the stock is cheap. <a href="https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-Third-Quarter-2026-Results/" target="_blank" rel="noopener noreferrer">CoreWeave release ↗</a></p>
    <p>Nebius's original Q3 release described approximately $981 million revenue, but also delayed data-centre capacity and a much larger capital-spending requirement. That suggests a supply-delivery bottleneck, rather than automatically proving that signed customer demand is failing.</p>
   </section>
   <div className={css.compare}>
    <div><small>COREWEAVE / REPORTED Q3</small><strong>$3.661B</strong><span>Revenue</span><strong>$846M</strong><span>Net interest expense</span><strong>$709M</strong><span>Net loss</span></div>
    <div><small>NEBIUS / REPORTED Q3</small><strong>~$981M</strong><span>Revenue</span><strong>~$27B</strong><span>2026 capex outlook · projected</span><strong>$40–45B</strong><span>2027 capex expectation · projected</span></div>
   </div>
   <section className={css.question}>
    <span className={css.kicker}>02 / MARKET TRANSMISSION</span>
    <h2>Three separate markets: computing capacity, financing and equity valuation</h2>
    <p><strong>Supply:</strong> data-centre construction delays, GPUs, power availability, racks and networking can constrain deliverable AI capacity even when customers sign contracts. Investments in equipment suppliers may benefit while hosting economics struggle.</p>
    <p><strong>Demand:</strong> strong contract demand is positive for the potential AI-services market. Confirm paid customer usage, realised deposits, utilisation and renewal economics before assuming it translates into free cash flow.</p>
    <p><strong>Financing:</strong> expensive borrowing, prepayments and capex can reduce the equity value attributable to future growth. A high-revenue issuer may still face refinancing pressure or dilution.</p>
    <p><strong>Uncertainty:</strong> mixed but higher around delivery and financing. Positive customer-demand evidence does not remove uncertainty over timing, cost or ultimate investment returns.</p>
   </section>
   <section className={css.question}>
    <span className={css.kicker}>03 / WHICH INVESTORS BENEFIT?</span>
    <h2>Suppliers versus operators: a testable divergence</h2>
    <p><strong>Potential beneficiaries:</strong> equipment, power-grid and networking suppliers with executable orders and cash conversion. <strong>Potentially pressured:</strong> highly leveraged operators funding capacity well ahead of cash receipts. The relative opportunity is conditional on valuation, delivery and the timing of realised returns.</p>
    <p><strong>Expected versus actual market reaction:</strong> an unexpected capex increase or revenue delay would conventionally pressure a leveraged operator, but this edition has no independently matched release-window CRWV/NBIS price measurements. The observed divergence is therefore <strong>UNTESTED</strong>, not confirmed bearish causality.</p>
    <p><strong>Next evidence:</strong> cash-flow statements, debt maturities, installed versus commissioned MW, received customer prepayments, issuer guidance and same-window relative returns. Separate announced future deposits from cash already received.</p>
   </section>
   <footer className={css.sources}>
    <p>Original issuer data, conditional market interpretation and research gaps. No automatic change to a canonical Regime, no made-up consensus and no price target.</p>
    {coreEvidence?<a href={coreEvidence.sourceUrl} target="_blank" rel="noopener noreferrer">CoreWeave Q3 original release ↗</a>:null}
    {nebEvidence?<a href={nebEvidence.sourceUrl} target="_blank" rel="noopener noreferrer">Nebius Q3 original release ↗</a>:null}
    <Link href="/regime-watch/ai">AI Regime research ↗</Link>
   </footer>
  </div>}
 </article>;
}
