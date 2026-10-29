import Link from "next/link";
import {EARNINGS_CASES,EARNINGS_RESEARCH_CUTOFF,getEarningsCase} from "@/lib/bluebelly-earnings-investor-stories";
import {DATED_MARKET_DEBATES} from "@/lib/bluebelly-earnings-investor-commentary";
import styles from "./EarningsInvestorDeepDive.module.css";

/**
 * Long-form, issuer-sourced public editorial research.
 * Query parameter picks ONLY a known published ticker; the route admits no
 * arbitrary record URL, internal Notion research or private model/author data.
 */
export default function EarningsInvestorDeepDive({ticker,backHref}:{ticker:string;backHref:string}) {
 const item=getEarningsCase(ticker);
 if(!item)return <section className={styles.unavailable}><h1>Financial investigation unavailable</h1>
   <p>Only the seven pre-reviewed public financial cases are available.</p>
   <Link href={backHref}>Return to Markets</Link></section>;
 const index=EARNINGS_CASES.findIndex(c=>c.ticker===item.ticker);
 const other=EARNINGS_CASES.filter(c=>c.ticker!==item.ticker);
 const to=(t:string)=>backHref+"?view=earnings&ticker="+encodeURIComponent(t);
 return <article data-bluebelly-financial-article={item.ticker} data-cutoff="2026-10-29" className={styles.article}>
   <nav className={styles.back} aria-label="Reading path">
     <Link href={backHref+"#earnings-fundamentals"}>← Earnings &amp; fundamentals</Link>
     <span> / </span><span>{item.ticker}</span>
   </nav>
   <header className={styles.hero}>
     <div>
       <p className={styles.kicker}>BLUEBELLY INVESTOR TEST / {item.ticker}</p>
       <h1>{item.heading}</h1>
       <p className={styles.deck}>{item.centralQuestion}</p>
       <p className={styles.metadata}><strong>{EARNINGS_RESEARCH_CUTOFF}</strong><span> Latest verified base: {item.period}</span></p>
     </div>
     <aside className={styles.primer} aria-label="The reading contract">
       <p className={styles.kicker}>HOW TO READ THIS</p>
       <p>This is a source-backed financial investigation, not a live stock recommendation or post-results report. We separate company statements, reported figures, arithmetic, market interpretations and evidence still missing.</p>
       <p><strong>Do not infer:</strong> an earnings beat, a Q3 outcome, a bond-market reaction, or current valuation from this dated baseline.</p>
     </aside>
   </header>
   <nav className={styles.chaptersNav} aria-label="Article sections">
     <a href="#the-pitch">The business</a><a href="#the-money">The money</a>
     <a href="#the-catch">The catch</a><a href="#the-verdict">The negotiation</a>
     <a href="#source-desk">Evidence</a>
   </nav>
   <div className={styles.layout}>
    <div className={styles.prose}>
     <section id="the-pitch" className={styles.section}>
       <p className={styles.kicker}>01 / THE OPPORTUNITY</p>
       <h2>What would the Shark be buying?</h2>
       {item.pitch.map((p,i)=><p key={i}>{p}</p>)}
     </section>
     <section id="the-money" className={styles.section}>
       <p className={styles.kicker}>02 / THE ECONOMICS</p>
       <h2>Follow the money, not just the EPS headline</h2>
       {item.theMoney.map((p,i)=><p key={i}>{p}</p>)}
       <div className={styles.metricGrid} aria-label={"Reported and calculated financial figures for "+item.name}>
         {item.metrics.map(m=><div key={m.label} className={styles.metric}>
           <span>{m.label}</span><strong>{m.value}</strong><small>{m.basis}</small>
         </div>)}
       </div>
       <h3>Reconcile the numbers</h3>
       <div className={styles.bridges}>{item.bridges.map(b=><div key={b.label} className={styles.bridge}>
         <h4>{b.label}</h4><p className={styles.formula}>{b.formula}</p><p>{b.interpretation}</p>
       </div>)}</div>
     </section>
     <section id="the-catch" className={styles.section}>
       <p className={styles.kicker}>03 / THE OBJECTION</p>
       <h2>Why would an investor hesitate?</h2>
       {item.theCatch.map((p,i)=><p key={i}>{p}</p>)}
       <h3>Balance sheet and financing reality</h3>
       {item.balance.map((p,i)=><p key={i}>{p}</p>)}
       <div className={styles.management} aria-label="Original management evidence">
         <p className={styles.kicker}>WHAT MANAGEMENT ACTUALLY SAID / COMPANY SOURCE</p>
         <p><strong>{item.quote.speaker}:</strong> {item.quote.claim}</p>
         <p><strong>How we interpret it:</strong> {item.quote.meaning}</p>
         <a href={item.quote.source} target="_blank" rel="noopener noreferrer">Read the original issuer document ↗</a>
       </div>
       <div className={styles.debate}>
         <div><h3>The bullish interpretation</h3><p>{item.debate.bull}</p></div>
         <div><h3>The sceptical interpretation</h3><p>{item.debate.bear}</p></div>
       </div>
       <p className={styles.limit}><strong>What this debate cannot prove:</strong> {item.debate.limit}</p>
       <h3>What investors, analysts and industry observers are saying</h3>
       <p>These are sourced statements by named issuers or identifiable commentators, not a survey or a Bluebelly factual verdict. The verification limits are as important as the bullish or bearish claim.</p>
       <div className={styles.voiceList}>{(DATED_MARKET_DEBATES[item.ticker]||[]).map(read=><div className={styles.voice} key={read.source+read.label}>
         <p className={styles.kicker}>{read.kind.toUpperCase()} · {read.date}</p>
         <h4>{read.label}</h4>
         <p>{read.claim}</p><p className={styles.voiceLimit}><strong>Evidence limit:</strong> {read.limitation}</p>
         <a href={read.source} target="_blank" rel="noopener noreferrer">View the dated original discussion or report ↗</a>
       </div>)}</div>
     </section>
     <section id="the-verdict" className={styles.section}>
       <p className={styles.kicker}>04 / THE NEGOTIATION</p>
       <h2>What would change the price of the deal?</h2>
       <p>These are conditional analytical paths, not price targets, probabilities or forecasts the company has already achieved.</p>
       <div className={styles.scenarios}>
         <div><h3>Bear case</h3><p>{item.cases.bear}</p></div>
         <div><h3>Base case</h3><p>{item.cases.base}</p></div>
         <div><h3>Bull case</h3><p>{item.cases.bull}</p></div>
       </div>
       <h3>Questions to ask on the earnings call</h3>
       <ol className={styles.questions}>{item.calls.map(question=><li key={question}>{question}</li>)}</ol>
     </section>
     {["AMZN","INTC","AMD","SNDK"].includes(item.ticker)?<section className={styles.section} id="credit-funding" aria-label="Yield and credit pressure">
       <p className={styles.kicker}>CROSS-ASSET INVESTOR TEST</p>
       <h2>When does the bond market actually punish this business?</h2>
       <p>The US Treasury's 28 October indicative par yields were 4.67% for two years, 5.05% for ten years and 5.37% for thirty years. These are dated market observations, not today's live quotes. Higher risk-free yields may lower the present value of future equity earnings even if the company has not issued any bonds.</p>
       <p>Firm-specific credit pressure requires an extra step: compare a company's corporate bond yield against a Treasury of comparable maturity at matched times, or examine its CDS spread. If Treasury yields climb while the issuer's spread stays steady, the general interest-rate regime may be responsible. If the company's spread widens materially, bondholders may be demanding additional compensation for its own risk.</p>
       <p>For an AI infrastructure buyer, the key comparison is cash remaining after equipment spending versus the interest bill, lease obligations and the next debt maturity. A chip supplier can benefit from that spending without carrying the buyer's financing burden. No company-specific spread change is asserted here.</p>
       <a href="https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value_month=202610" target="_blank" rel="noopener noreferrer">28 October source: US Treasury daily yield curve ↗</a>
     </section>:null}
     <section id="source-desk" className={styles.section}>
       <p className={styles.kicker}>05 / AUDIT TRAIL</p>
       <h2>Original records and the unresolved gaps</h2>
       <p>Latest reviewed company filings and issuer releases are linked below. The figures above are historical unless specifically marked as management guidance. Other market opinions and projections are not a substitute for verified issuer numbers.</p>
       <div className={styles.sources}>{item.primary.map(s=><a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.name} ↗</a>)}</div>
       <h3>Evidence still needed</h3><ul className={styles.gaps}>{item.missing.map(gap=><li key={gap}>{gap}</li>)}</ul>
       <p><strong>Publication rule:</strong> Freeze consensus vintage, compare on a matching fiscal/accounting basis, check cash spending versus leases, and observe the asset's actual response after release before upgrading the verdict. Preserve historical editions.</p>
     </section>
    </div>
    <aside className={styles.rail} aria-label="Investor briefing rail">
      <div className={styles.railCard}>
        <p className={styles.kicker}>THE CENTRAL QUESTION</p>
        <h3>{item.centralQuestion}</h3>
        <p>Read the balance sheet, the cash bridge and the counterargument before assessing valuation.</p>
      </div>
      <div className={styles.railCard}>
        <p className={styles.kicker}>SEVEN-COMPANY EARNINGS DESK</p>
        {other.map(c=><Link key={c.ticker} href={to(c.ticker)}>{c.ticker} · {c.name}</Link>)}
      </div>
      <div className={styles.railCard}>
        <p className={styles.kicker}>THE BIGGER REGIME</p>
        <p>AI hardware suppliers can produce more cash while the companies buying their equipment spend more. Higher Treasury yields affect all long-duration equity valuations; a widening issuer credit spread is the separate test for bondholder concern.</p>
        <Link href="/regime-watch">Explore Regime Watch →</Link>
      </div>
    </aside>
   </div>
   <footer className={styles.footer}>
     <Link href={to(EARNINGS_CASES[(index+1)%EARNINGS_CASES.length].ticker)}>Next investor investigation: {EARNINGS_CASES[(index+1)%EARNINGS_CASES.length].name} →</Link>
     <Link href={backHref+"#earnings-fundamentals"}>All seven companies</Link>
   </footer>
 </article>;
}
