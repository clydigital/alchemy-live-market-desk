import Link from "next/link";
import {getManualSweeps} from "@/lib/bluebelly-manual-sweeps";
import {NVIDIA_EARNINGS_WATCH as nvda} from "@/lib/bluebelly-nvidia-earnings-watch";
import s from "./PowerStackDecisionHub.module.css";

type Idea={
 id:string;title:string;tickers:string;state:string;hypothesis:string;
 uncertainty:string;mechanism:string;entry:string;failure:string;href:string;
 sourceUrl:string|null;sourceName:string;sourceDay:string;lane:"investment"|"trade";
};
/** Owner-only decision queue. Curation is explicit and does not alter
 * holdings/legacy ranking or infer real-time price, conviction or execution. */
export default function PowerStackDecisionHub({now}:{now:Date}){
 const core=getManualSweeps("ai",now,8).find(v=>v.id.includes("coreweave"));
 const energy=getManualSweeps("energy",now,5).find(v=>v.id.includes("eia-us-gas"));
 const msci=getManualSweeps("breadth",now,5).find(v=>v.id.includes("msci-november"));
 const company=core?.findings.find(f=>f.status==="SOURCE_CORROBORATED");
 const eia=energy?.findings.find(f=>f.status==="SOURCE_CORROBORATED");
 const index=msci?.findings.find(f=>f.status==="SOURCE_CORROBORATED");
 const base:Idea[]=[
  {id:"nvda-long",lane:"investment",title:"NVIDIA after the leadership shock",tickers:"NVDA · SMH · AMD · AVGO",state:"EARNINGS PENDING",
   hypothesis:"The business and CUDA ecosystem could remain durable even while the market demands a governance discount.",
   uncertainty:"CEO decision resolved; succession, customer funding and forward order quality remain uncertain.",
   mechanism:"Chip demand and GPU supply are different from demand for NVDA shares. Confirm shipments, paid AI usage and financing continuity.",
   entry:"Only consider a staged long-term allocation if issuer earnings/guidance confirm demand and margin resilience; do not treat a volume spike as net buying.",
   failure:"Weakening forward sales, order cancellations, adverse financing changes or adverse regulatory findings.",
   href:"/key-stories?feature=nvidia-ceo-earnings-november-2026",
   sourceUrl:nvda.transition.originalUrl,sourceName:"NVIDIA · original CEO transition",sourceDay:"2026-11-12"},
  {id:"ai-cloud",lane:"investment",title:"AI cloud: growth versus cash conversion",tickers:"CRWV · NBIS · ANET · VRT",
   state:"FINANCING RISK",
   hypothesis:"Computing demand can grow while highly leveraged operators struggle to turn revenue into shareholder cash.",
   uncertainty:"Capacity delays, high interest and prospective customer prepayments create financing and delivery uncertainty.",
   mechanism:"More compute demand favours infrastructure suppliers, but cloud operators need affordable funding and customer utilisation.",
   entry:"Compare delivered capacity, realised deposits, cash after capex, debt refinancing and valuation before choosing an issuer.",
   failure:"Funding costs or capex materially exceed contracted cash receipts; no evidence of profitable unit economics.",
   href:"/key-stories?feature=ai-compute-financing-november-2026",
   sourceUrl:company?.sourceUrl||null,sourceName:company?.sourceName||"Original issuer research pending",sourceDay:company?.sourcePublishedAt||"Not verified"},
  {id:"tlt-duration",lane:"investment",title:"Duration: what would make TLT attractive?",tickers:"TLT · IEF · EDV · ZROZ",
   state:"MACRO CONFIRMATION",
   hypothesis:"Long-duration bonds could benefit if real yields and term premia decline sustainably; higher inflation could overwhelm the thesis.",
   uncertainty:"Fed rate path, Treasury auction absorption, inflation breakevens and long-end supply remain unresolved.",
   mechanism:"Higher yields reduce bond prices, especially at long duration. Nominal yields alone cannot distinguish real-yield and inflation shocks.",
   entry:"Require source-dated 10Y/30Y nominal, 10Y real yields, breakevens and auction demand to turn before claiming a duration opportunity.",
   failure:"Hotter inflation, wider term premium, weaker auctions or rising real yields invalidate a simple duration-long interpretation.",
   href:"/regime-watch/bonds",
   sourceUrl:null,sourceName:"Treasury and TIPS source recheck required",sourceDay:"Pending"},
  {id:"nvda-swing",lane:"trade",title:"NVIDIA panic-reversal setup",tickers:"NVDA · SMH",state:"NOT CONFIRMED",
   hypothesis:"A capitulation bounce could turn into a durable reversal if selling exhausts and the relative semiconductor tape stabilises.",
   uncertainty:"Extremely high volume does not identify buyers. Prior-session wick and closing behaviour need matching quotes.",
   mechanism:"Short covering and new buying can both lift price; follow-through and an EMA-band retest discriminate between them.",
   entry:"A verified daily close, subsequent held retest and relative SMH confirmation; separate a 5m execution from the daily trend.",
   failure:"Loses the confirmed rebound support, fails to retake respected daily EMA, or earnings guidance deteriorates.",
   href:"/regime-watch/ai#nvidia-earnings-decision",
   sourceUrl:nvda.transition.originalUrl,sourceName:"NVIDIA · original event",sourceDay:"2026-11-12"},
  {id:"bond-swing",lane:"trade",title:"Bond ETF rebound, only if yields roll over",tickers:"TLT · IEF · EDV",state:"WAIT FOR YIELDS",
   hypothesis:"A retracement in nominal and real yields could create a bond-price bounce, but not when inflation pressure continues.",
   uncertainty:"A declining nominal yield can reflect recession fear rather than a lasting decline in term premium.",
   mechanism:"Treasury duration has inverse rate-price sensitivity; EDV/ZROZ carry far greater convexity and drawdown risk.",
   entry:"Identify a fresh US10Y/US30Y reversal and same-clock ETF confirmation after CPI/PPI and Treasury auctions.",
   failure:"Long yields break higher again, auction demand deteriorates or break-even inflation widens.",
   href:"/regime-watch/bonds",
   sourceUrl:null,sourceName:"Official rate/auction recheck required",sourceDay:"Pending"},
  {id:"oil-shipping",lane:"trade",title:"Oil versus physical shipping disruption",tickers:"XOM · CVX · HAL · Brent",
   state:"PHYSICAL FLOW WATCH",
   hypothesis:"Crude production recovery may reduce the commodity premium even while shipping and refined-fuel bottlenecks persist.",
   uncertainty:"Negotiations are not actual safe tanker passage. Insurance rates, transit volumes and diesel cracks can diverge.",
   mechanism:"More crude supply is typically bearish for crude prices; constrained delivered supply may still support refined fuels.",
   entry:"Confirm actual Hormuz transit/insurance and inventory/crack changes before considering energy breakouts or reversals.",
   failure:"Unexpected renewed attacks or sustained transit restrictions defeat a premature de-escalation trade.",
   href:"/hormuz",
   sourceUrl:eia?.sourceUrl||null,sourceName:eia?.sourceName||"Physical flow confirmation pending",sourceDay:eia?.sourcePublishedAt||"Not verified"},
  {id:"msci-flow",lane:"trade",title:"MSCI rebalance: index share-flow risk",tickers:"MSTR · uranium vehicles",
   state:"30 NOV FLOW TEST",
   hypothesis:"Index deletions can create temporary passive selling of affected listed shares without mechanically selling their underlying assets.",
   uncertainty:"Tracker holdings, scale of deletions, true flow and already-priced effects remain unverified.",
   mechanism:"Change in passive demand for listed shares, not a new supply of Bitcoin or mined uranium.",
   entry:"Identify exact index constituents, passive fund weights, rebalance date and dated share-price reaction first.",
   failure:"Flows are offset, funds have already sold, or the exact affected index positions differ from press summaries.",
   href:"/regime-watch/breadth",
   sourceUrl:index?.sourceUrl||null,sourceName:index?.sourceName||"Index constituent verification pending",sourceDay:index?.sourcePublishedAt||"Not verified"},
 ];
 return <section className={s.root} id="power-stack-decision-queue"
   data-power-stack-terminal="owner-only-source-gated-ideas" aria-labelledby="decision-queue-title">
  <header className={s.head}>
   <div><p className={s.kicker}>POWER STACK / INVESTMENT & SHORT-TERM IDEA TERMINAL</p>
    <h2 id="decision-queue-title">What is worth acting on—and what still needs confirmation?</h2>
    <p>Separate multi-year investments from tactical setups. These are dated research candidates, not live signals, portfolio orders or automatically ranked assets.</p></div>
   <div className={s.count}><strong>{base.length}</strong><span>CONDITIONAL IDEAS</span><small>0 verified trade triggers</small></div>
  </header>
  <nav className={s.jump} aria-label="Power Stack investment desk navigation">
   <a href="#power-stack-investment">Investment ideas</a>
   <a href="#power-stack-trades">Short trade ideas</a>
   <a href="#nvidia-earnings-decision">NVIDIA financial test</a>
   <a href="#power-stack-research-impact">Source intelligence</a>
   <a href="#power-stack-bond-watch">Bond research</a>
   <a href="#power-stack-watchlist">Saved watchlist</a>
  </nav>
  {(["investment","trade"] as const).map(lane=><div key={lane} className={s.lane} id={lane==="investment"?"power-stack-investment":"power-stack-trades"}>
    <div className={s.laneHead}><h3>{lane==="investment"?"01 / Multi-year investment ideas":"02 / Short-term trade setups"}</h3>
     <span>{lane==="investment"?"Earnings · valuation · cash conversion":"Catalyst · technical confirmation · invalidation"}</span></div>
    <div className={s.grid}>{base.filter(idea=>idea.lane===lane).map(idea=><article key={idea.id} className={s.card}
     data-power-stack-candidate={idea.id}>
      <div className={s.cardTop}><span>{idea.tickers}</span><strong>{idea.state}</strong></div>
      <h4>{idea.title}</h4>
      <p><strong>Case:</strong> {idea.hypothesis}</p>
      <p><strong>Uncertainty:</strong> {idea.uncertainty}</p>
      <details className={s.expanded}>
       <summary>Supply, demand, entry and invalidation</summary>
       <p><strong>Transmission:</strong> {idea.mechanism}</p>
       <p><strong>What would justify acting:</strong> {idea.entry}</p>
       <p><strong>What breaks the case:</strong> {idea.failure}</p>
      </details>
      <div className={s.foot}>
       <Link href={idea.href}>Read decision evidence →</Link>
       {idea.sourceUrl?<a href={idea.sourceUrl} target="_blank" rel="noopener noreferrer">{idea.sourceName} · {idea.sourceDay} ↗</a>:
        <span>{idea.sourceName} · not yet measured</span>}
      </div>
     </article>)}</div>
  </div>)}
  <p className={s.disclaimer}>No positions were bought, sold or re-ranked. The source date is not the quote timestamp. No public page has access to owner holdings. An idea becomes actionable only after its stated evidence and price gates are checked.</p>
 </section>;
}
