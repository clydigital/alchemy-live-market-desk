import Link from "next/link";
import {Nov14ResearchTeaser} from "@/components/blue-desk/Nov14MarketInvestigation";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import {getMarketMonitor} from "@/lib/market-monitor-public";
import {publicMarketObservations} from "@/lib/blue-desk-public-markets";
import {buildMarketDivergenceWatch} from "@/lib/bluebelly-market-divergence-watch";
import {buildMarketCompassSummary} from "@/lib/bluebelly-market-compass";
import {getPublishedMacroPulseBriefs} from "@/lib/blue-desk-macropulse-brief-server";
import {buildCrashDecisionLayer,recentCrashResearch} from "@/lib/bluebelly-crash-decision-live";
import {buildCrashEvidenceBalance} from "@/lib/bluebelly-crash-evidence-balance";
import {getCrashTranscriptScore} from "@/lib/bluebelly-crash-transcript-score-server";
import CrashEvidenceSeesaw from "@/components/blue-desk/CrashEvidenceSeesaw";
import {buildCrashMarketPhase} from "@/lib/bluebelly-crash-market-phase";
import CrashMarketPhasePanel from "@/components/blue-desk/CrashMarketPhasePanel";
import CrashEvidenceAutoRefresh from "@/components/blue-desk/CrashEvidenceAutoRefresh";
import {getPublicSourceObservations} from "@/lib/blue-desk-source-observations";
import {getRegimeShadowHealth} from "@/lib/regime-engine";
import RegimeResearchClocks from "@/components/blue-desk/RegimeResearchClocks";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import {buildCrashWatchView,CRASH_HISTORY,CRASH_LINKS} from "@/lib/bluebelly-crash-opportunity";
import desk from "../blue-desk.module.css";
import styles from "./crash-opportunity.module.css";

export const dynamic="force-dynamic";
export const metadata={
  title:"Market Crash vs Opportunity | Bluebelly Regime Watch",
  description:"Two-sided equity crash and recovery research: historical mirrors, evidence gauge, source-dated credit and breadth and linked regime watches."
};

function formatNumber(value:number|null,decimals=2){
  return value===null?"Unavailable":value.toLocaleString("en-US",{maximumFractionDigits:decimals});
}
function numberWithSign(value:number|null,unit:string){
  if(value===null)return "Not measured";
  return (value>0?"+":"")+formatNumber(value)+" "+unit;
}

export default async function CrashOpportunityPage(){
  const now=new Date();
  const host=(await headers()).get("host");
  const [monitor,sourceObservations,shadowHealth,publishedPulse]=await Promise.all([
    getMarketMonitor().catch(()=>null),
    getPublicSourceObservations(now,12).catch(()=>null),
    getRegimeShadowHealth().catch(()=>null),
    getPublishedMacroPulseBriefs(8).catch(()=>[]),
  ]);
  const watch=buildCrashWatchView(monitor?.rows??null,now);
  const matchedTape=buildMarketDivergenceWatch(publicMarketObservations(monitor?.rows??[],"all"),"1D");
  const compass=buildMarketCompassSummary(matchedTape,now);
  const decision=buildCrashDecisionLayer(watch,compass);
  const transcriptScore=await getCrashTranscriptScore(watch,compass,now);
  const balance=buildCrashEvidenceBalance(watch,compass,transcriptScore);
  const marketPhase=buildCrashMarketPhase(monitor?.rows??null,now);
  const freshResearch=recentCrashResearch(publishedPulse,now,3);
  const href=(path:string)=>blueDeskPublicHref("/blue-desk"+path,host);
  const position=watch.position==="BULL_LEAN"?"Opportunity lean":
    watch.position==="BEAR_LEAN"?"Crash-risk lean":"Contested";
  return <main className={desk.page} data-crash-opportunity="source-dated-research-view" data-gauge={watch.position}>
    <BlueDeskHeader activePath="/blue-desk/regime-watch"/>
    <CrashEvidenceAutoRefresh/>
    <div className={desk.content}>
      <nav className={styles.breadcrumb} aria-label="Research breadcrumb">
        <Link href={href("/regime-watch")}>All regime watches</Link><span aria-hidden="true">/</span><span>Market Crash vs Opportunity</span>
      </nav>
      <header className={styles.hero} data-regime-design="cyberpunk-cross-regime-watch">
        <div>
          <span className={styles.eyebrow}>BLUEBELLY / CROSS-REGIME FIELD GUIDE — INVESTIGATION X</span>
          <h1>CRASH <em>VS</em> OPPORTUNITY</h1>
          <p className={styles.dek}>A record-high index can hide hundreds of struggling stocks. Is that the warning before a collapse—or a recovery already gathering strength beneath the surface?</p>
          <div className={styles.heroLinks}>
            <a href="#live-decision">CURRENT DECISION BOARD ↗</a>
            <a href="#gauge">SEVEN-PILLAR GAUGE ↗</a>
            <a href="#mirrors">HISTORICAL MIRRORS ↗</a>
            <a href="#cross-regimes">CONNECTED SYSTEMS ↗</a>
          </div>
        </div>
        <div className={styles.heroSide}>
          <div className={styles.heroVisual} aria-hidden="true"><strong>VS</strong><small>RISK / OPPORTUNITY</small></div>
          <span>THE INVESTOR QUESTION</span>
          <strong>What would need to break before a correction becomes a lasting bear market?</strong>
          <p>And what improvement would let prices make new highs even when today's headlines, capex or free cash flow look poor?</p>
        </div>
      </header>


      <Nov14ResearchTeaser host={host} compact/>
      <section id="live-decision" className={styles.live} aria-labelledby="crash-live-title"
        data-crash-live="existing-source-feeds-v1" data-decision-tape={compass.state}
        data-research-count={freshResearch.length}>
        <div className={styles.liveHead}>
          <div><span className={styles.eyebrow}>CURRENT / AUTOMATIC SOURCE-DATED READ</span>
            <h2 id="crash-live-title">What does the evidence support <em>now?</em></h2>
            <p>{decision.strongest}</p></div>
          <div className={styles.liveSync}>READ-ONLY · REBUILT ON PAGE REQUEST
            <small>New admitted market data and published research appear on page load or while this page is open (10-minute refresh). No new task or forecast is created.</small>
          </div>
        </div>
        <CrashEvidenceSeesaw key={balance.angle+"-"+balance.lean} balance={balance}/>
        <CrashMarketPhasePanel phase={marketPhase}/>
        <div className={styles.liveStats}>
          <div data-live-market-state={compass.state}><span>1D / EQUITY RISK TAPE</span>
            <strong>{compass.state==="RISK_ON"?"RISK-ON":compass.state==="RISK_OFF"?"RISK-OFF":compass.state==="MIXED"?"MIXED":"UNMEASURED"}</strong>
            <small>{decision.marketSession?"Completed "+decision.marketSession:"Matched four-ETF session unavailable"}</small>
          </div>
          <div data-live-market-state={watch.pillars[0]?.signal??"UNKNOWN"}><span>5-SESSION / PARTICIPATION</span>
            <strong>{watch.pillars[0]?.signal==="BULL"?"STRENGTHENING":watch.pillars[0]?.signal==="BEAR"?"WEAKENING":watch.pillars[0]?.signal==="MIXED"?"MIXED":"UNMEASURED"}</strong>
            <small>{decision.breadthSession||"Matched RSP/SPX date missing"}</small>
          </div>
          <div data-live-market-state={watch.pillars[1]?.signal??"UNKNOWN"}><span>5 OBSERVATIONS / HIGH-YIELD CREDIT</span>
            <strong>{watch.pillars[1]?.signal==="BULL"?"SPREAD RELIEF":watch.pillars[1]?.signal==="BEAR"?"SPREAD STRESS":watch.pillars[1]?.signal==="MIXED"?"MIXED":"UNMEASURED"}</strong>
            <small>{decision.creditSession||"Qualified HY OAS date missing"}</small>
          </div>
        </div>
        <p className={styles.liveCoverage}>{decision.coverage} · These different source-session clocks do not establish event causality, forced selling or an entry price. Historical source observations are not made live by the page-view timestamp.</p>
        <div className={styles.scenarioGrid} aria-label="Three conditional crash-or-opportunity scenarios">
          {decision.scenarios.map(scenario=><article key={scenario.id} className={styles.scenario}
            data-crash-scenario={scenario.id} data-scenario-state={scenario.state}>
            <div className={styles.scenarioTop}>
              <span>{scenario.id==="durable"?"OPPORTUNITY":scenario.id==="bounce"?"TACTICAL / CAUTION":"SYSTEMIC RISK"}</span>
              <strong>{scenario.state==="ALIGNED"?"OBSERVATIONS ALIGN":scenario.state==="PARTIAL"?"PARTIAL SUPPORT":scenario.state==="CONTRADICTED"?"CONTRADICTED":"INSUFFICIENT DATA"}</strong>
            </div>
            <h3>{scenario.title}</h3><p>{scenario.question}</p>
            <small>{scenario.corroborated} / {scenario.required} required directional conditions · {scenario.evidence}</small>
            <div className={styles.scenarioTest}><b>Deciding test</b><p>{scenario.nextTest}</p></div>
            <div className={styles.scenarioTest}><b>What weakens this case?</b><p>{scenario.failure}</p></div>
          </article>)}
        </div>
        <div className={styles.workflowHead}>
          <div><span className={styles.eyebrow}>CREATOR-INFORMED · SOURCE-TESTED FRAMEWORK</span>
            <h3>Shock → absorption → credit → cash → confirmation</h3>
            <p>Structured from recent opposing creator research. The steps update only when the relevant qualified evidence exists; no transcript, opinion or inferred institutional flow is silently treated as verified tape.</p></div>
          <span>5 TESTS · NO PROBABILITY</span>
        </div>
        <div className={styles.checkpoints}>
          {decision.checkpoints.map(step=><article key={step.id} data-framework-check={step.id}
            data-check-status={step.state} className={styles.checkpoint}>
            <div><h4>{step.name}</h4><strong>{step.state==="OBSERVED"?"MEASURED PROXY":"RESEARCH GAP"}</strong></div>
            <p>{step.result}</p><small>What to verify next: {step.next}</small>
          </article>)}
        </div>
        <div className={styles.automatedResearch} data-crash-automated-research="public-macropulse">
          <div className={styles.researchHeading}><h3>Latest related research</h3>
            <span>EXISTING MACROPULSE PUBLIC READER · NOT SCORED</span></div>
          {freshResearch.length?<div className={styles.researchGrid}>
            {freshResearch.map(item=>{
              const original=item.source_links.find(l=>l.kind!=="SOCIAL_LEAD"&&/^https:\/\//.test(l.url));
              return <article key={item.source_pulse_id} className={styles.researchCard}>
                <span>RESEARCH-DERIVED · UNADJUDICATED · {item.primary_region.toUpperCase()}</span>
                <h4>{item.headline}</h4><p>{item.standfirst}</p>
                <small>Original source published <time dateTime={item.source_published_at}>{item.source_published_at.slice(0,10)}</time>; brief published {item.published_at.slice(0,10)}</small>
                <p><b>Alternative / countercase:</b> {item.countercase}</p>
                <p><b>Watch next:</b> {item.watch_next}</p>
                {original?<a href={original.url} target="_blank" rel="noopener noreferrer">{original.label} · source ↗</a>:null}
              </article>;
            })}
          </div>:<p className={styles.noResearch}>No recent qualifying published MacroPulse brief for this topic. This is a coverage gap, not evidence that the market is quiet. The measured market checks above still update independently.</p>}
        </div>
      </section>

      <RegimeResearchClocks sources={sourceObservations} editorialReviewedOn="2026-10-30" shadow={shadowHealth}/>
      <details className={styles.archive} data-crash-research-archive="historical-editions">
        <summary>Previous research editions · 11 Nov / 30 Oct <span>OPEN DATED CONTEXT ↗</span></summary>
      <section id="nov11-challenge" data-regime-challenge="2026-11-11-source-dated" aria-labelledby="nov11-challenge-title" style={{marginTop:18,padding:"22px clamp(16px,3vw,30px)",border:"1px solid var(--bb-card-border)",borderRadius:10,background:"var(--bb-surface)"}}>
        <span className={styles.eyebrow}>11 NOVEMBER 2026 / SOURCE-DATED MARKET CHALLENGE</span>
        <h2 id="nov11-challenge-title" style={{fontSize:"clamp(23px,2.5vw,34px)",margin:"10px 0"}}>AI stocks bounced. Has the rate shock been absorbed?</h2>
        <p style={{fontSize:15,lineHeight:1.7}}><strong>The first reaction was bearish:</strong> the <a href="https://www.bls.gov/news.release/archives/cpi_11102026.htm" target="_blank" rel="noopener noreferrer">10 November BLS release</a> showed October CPI rising 0.4% month-on-month and core CPI 0.3%. Both exceeded the respective 0.3% and 0.2% Reuters consensus. The <a href="https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&amp;field_tdr_date_value=2026" target="_blank" rel="noopener noreferrer">10 November Treasury curve</a> finished at 4.73% for 2Y (+17bp) and 4.98% for 10Y (+10bp), while <a href="https://apnews.com/article/a97eb31c415811065561f2c2ac552cd7" target="_blank" rel="noopener noreferrer">AP recorded</a> a Nasdaq Composite decline of about 0.7%.</p>
        <p style={{fontSize:15,lineHeight:1.7}}><strong>Then the countercase arrived:</strong> <a href="https://www.reuters.com/business/sp-500-nasdaq-futures-rise-after-coreweave-soothes-ai-spending-fears-2026-11-11/" target="_blank" rel="noopener noreferrer">Reuters' 11 November 09:49 ET snapshot</a> showed the Nasdaq up 1.16%, helped by CoreWeave and chip shares. CoreWeave's <a href="https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-Third-Quarter-2026-Results/default.aspx" target="_blank" rel="noopener noreferrer">Q3 issuer report</a> described about $3.66bn of quarterly revenue and higher annual guidance. However, its $37–39bn FY2026 capex outlook and $1.05–1.15bn expected Q4 interest expense keep the financing test open. Approximately $9bn in expected customer prepayments/deposits is <em>not yet collected cash</em>.</p>
        <p style={{fontSize:15,lineHeight:1.7}}><strong>Broader than AI?</strong> Independent dated Nasdaq RSP ETF and FRED S&amp;P 500 price histories show equal-weight RSP outperforming the cash index by approximately 7.2 percentage points across 20 matched sessions ending 10 November. That supports a <em>rotation and breadth</em> hypothesis, not proof that one morning's AI rally has durable earnings backing. <a href="https://www.nasdaq.com/market-activity/etf/rsp/historical" target="_blank" rel="noopener noreferrer">RSP source</a> · <a href="https://fred.stlouisfed.org/series/SP500" target="_blank" rel="noopener noreferrer">S&amp;P 500 source</a>.</p>
        <p style={{fontSize:15,lineHeight:1.7}}><strong>The timing trap:</strong> <a href="https://www.sifma.org/news/press-releases/sifma-fixed-income-market-close-recommendation-in-the-u-s-the-u-k-and-japan-for-the-u-s-veterans-day-holiday-2026" target="_blank" rel="noopener noreferrer">US fixed income was closed for Veterans Day on 11 November</a>. Tuesday's yield prints cannot prove that Wednesday's AI shares rose while fresh Treasury yields kept climbing. The quoted equity reaction is <strong>intraday, not a completed close</strong>.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12,margin:"18px 0"}}>
          <div style={{padding:14,border:"1px solid var(--bb-card-border)",borderRadius:8}}><strong>Recovery case</strong><p>Watch repeat-session AI strength, expanding participation, stable credit and no deterioration in issuer cash guidance.</p></div>
          <div style={{padding:14,border:"1px solid var(--bb-card-border)",borderRadius:8}}><strong>Temporary bounce</strong><p>Watch whether leadership narrows again after positioning reversals, options expiry or the next full bond session.</p></div>
          <div style={{padding:14,border:"1px solid var(--bb-card-border)",borderRadius:8}}><strong>Structural risk</strong><p>Test actual credit/refinancing terms and AI customer cash conversion rather than inferring distress from high yields alone.</p></div>
        </div>
        <p style={{fontSize:14,lineHeight:1.7}}><strong>What would decide it:</strong> 12 November reopened Treasury/credit trading and updated breadth; independent financing terms, cash collection and utilisation; then <a href="https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Sets-Conference-Call-for-Third-Quarter-Financial-Results/" target="_blank" rel="noopener noreferrer">Nvidia's 17 November results</a>. Until those tests, the correct assessment is <strong>equity rotation and selective AI recovery; higher-rate funding consequences unresolved</strong>.</p>
        <small style={{display:"block",opacity:.82}}>Research edition: 11 Nov 2026 09:49 ET Reuters observation with 10 Nov completed market close and issuer/official source vintages. Non-canonical editorial counter-thesis. Does not replace the Regime projector, source-based gauge, or an immutable historical Story edition.</small>
      </section>
      <aside data-oct30-newsroom-context="source-dated-intraday" style={{marginTop:18,padding:"18px 22px",border:"1px solid var(--bb-card-border)",background:"var(--bb-surface)",borderRadius:9}}>
        <strong style={{display:"block",color:"var(--bb-accent)",fontSize:12,marginBottom:7}}>30 OCTOBER 2026 / NEW MARKET DEVELOPMENT</strong>
        <p style={{fontSize:15,lineHeight:1.65}}>The Nasdaq and S&amp;P 500 fell sharply in Friday's afternoon trading as Intel's guidance and the cash costs of AI infrastructure unsettled technology shares. This reported <em>intraday</em> sell-off is distinct from the watch's independently dated, mostly 29 October closing evidence.</p>
        <Link href={href("/key-stories")+"?feature=ai-cash-selloff-october-2026"}>Read the new Key Story: AI Demand Is Booming. So Why Are Investors Selling? →</Link>
      </aside>
      </details>
      <section id="gauge" className={styles.gauge} aria-labelledby="gauge-title">
        <div className={styles.sectionTop}>
          <div><span className={styles.eyebrow}>01 / TWO-SIDED RESEARCH</span><h2 id="gauge-title">Where the evidence leans</h2></div>
          <span className={styles.sourceClock}>Viewed <DualTimestamp value={now.toISOString()}/> · market observations dated separately</span>
        </div>
        <div className={styles.gaugeGrid}>
          <div>
            <span className={styles.verdictLabel}>Provisional research lens</span>
            <div className={styles.verdict} data-crash-research-verdict={watch.position}>{position}</div>
            <div className={styles.track} role="img" aria-label={"Qualitative bull-to-bear five-part research gauge. Current position: "+position+". Not a forecast probability."}>
              {(["BULL","BULL_LEAN","CONTESTED","BEAR_LEAN","BEAR"] as const).map(key=>
                <span key={key} className={watch.position===key?styles.activeTrack:styles.inactiveTrack} aria-hidden="true"/>)}
            </div>
            <div className={styles.trackLabels}><span>OPPORTUNITY</span><span>CONTESTED</span><span>CRASH RISK</span></div>
            <p className={styles.gaugeNote}>{watch.caveat}</p>
          </div>
          <div className={styles.gaugeMeta}>
            <div><span>Evidence coverage</span><strong>{watch.measurementCoverage} / 7 pillars</strong></div>
            <div><span>Confidence</span><strong>{watch.confidence.toLowerCase()}</strong></div>
            <div><span>Source health</span><strong>{watch.sourceStatus.toLowerCase()}</strong></div>
            <p>The gauge uses existing source-dated market readings. The 15 October Kobeissi and Burry arguments are analyst hypotheses, not inputs silently converted to verified prices.</p>
          </div>
        </div>
        <div className={styles.pillars}>
          {watch.pillars.map(p=><article className={styles.pillar} key={p.id} data-pillar-status={p.signal}>
            <div className={styles.pillarTop}><strong>{p.name}</strong><span>{p.signal==="BULL"?"Supports opportunity":p.signal==="BEAR"?"Supports crash risk":p.signal==="MIXED"?"Mixed":"Awaiting comparable evidence"}</span></div>
            <p>{p.basis}</p><div className={styles.nextTest}><b>Next test</b> {p.nextTest}</div>
            <Link href={href("/regime-watch/"+p.watchId)}>Open linked regime →</Link>
            {p.observedAt?<small>Last observed: {p.observedAt}</small>:null}
          </article>)}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="what-changed">
        <div className={styles.sectionTop}>
          <div><span className={styles.eyebrow}>02 / ACTUAL MARKET OBSERVATIONS</span><h2 id="what-changed">What has been measured?</h2></div>
          <Link href={href("/markets")}>Full Markets terminal →</Link>
        </div>
        <p>Readings below use the existing Market Monitor and its source clock. A missing or stale observation remains visible as such; the current page-view time never substitutes for a market close. All returns are over completed sessions, not post-event causal windows.</p>
        <div className={styles.tape}>
          {watch.readings.map(item=><div key={item.id} className={styles.tapeRow} data-observation-status={item.status}>
            <div className={styles.tapeName}><strong>{item.label}</strong><small>{item.note}</small></div>
            <div className={styles.tapeValue}>
              <strong>{formatNumber(item.value,item.unit==="index"?0:3)}{item.unit==="spread-percent"||item.unit==="yield-percent"?"%":""}</strong>
              <small>{item.status==="DATED"?"Observed "+item.asOf:item.status}</small>
            </div>
            <div className={styles.tapeChange}><span>5-session change</span><strong>
              {item.status!=="DATED"?"Unavailable":numberWithSign(item.fiveSessionChange,
                item.unit==="spread-percent"||item.unit==="yield-percent"?"bp":"%")}
            </strong></div>
            {item.sourceUrl?<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Source ↗</a>:<span>Source unavailable</span>}
          </div>)}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="thesis-headline">
        <span className={styles.eyebrow}>03 / SAME EVIDENCE, OPPOSITE CONCLUSIONS</span><h2 id="thesis-headline">Is weak breadth a warning—or already the opportunity?</h2>
        <div className={styles.debate}>
          <article><span>BEAR INTERPRETATION</span><h3>Concentration resembles the late dot-com period</h3>
            <p>Michael Burry compared the unusually weak participation at the 6 October 2026 S&amp;P high with March 2000. If leaders finally falter while borrowing and earnings assumptions deteriorate, index weakness could spread.</p>
            <a href="https://michaeljburry.substack.com/p/abridged-version-foundations-performance" target="_blank" rel="noopener noreferrer">Burry's original argument ↗</a>
          </article>
          <article><span>BULL INTERPRETATION</span><h3>Maybe much of the market already suffered</h3>
            <p>The Kobeissi Letter claimed on 15 October that 84% of constituents were 10% or more below their own highs. A few large stocks carried the index; improving breadth, earnings or inflation could unlock a wider rally.</p>
            <a href="https://x.com/KobeissiLetter/status/2110778022131306528" target="_blank" rel="noopener noreferrer">Kobeissi's original article ↗</a>
          </article>
        </div>
        <p className={styles.methodWarning}><strong>Verification boundary:</strong> Neither analyst's point-in-time constituent percentages have been independently reconstructed here. Different “all-time high,” survivor and membership definitions change breadth statistics. No 9,000+ counterfactual index target is adopted as market fair value.</p>
        <div className={styles.lesson}><strong>The Why X / Minsky mechanism:</strong> calm encourages leverage → high valuation embeds distant earnings → a funding shock creates involuntary sellers. To distinguish 1987-style liquidity disruption from 1929/2008-style damage, measure whether credit actually remains available after the first selloff. <a href="https://www.youtube.com/watch?v=YgqpOe2H17o" target="_blank" rel="noopener noreferrer">Watch attributed thesis ↗</a></div>
      </section>

      <section className={styles.section} id="mirrors" aria-labelledby="mirrors-headline">
        <span className={styles.eyebrow}>04 / HISTORICAL MIRROR LAB</span><h2 id="mirrors-headline">Did markets ever recover to all-time highs after the scare?</h2>
        <p>Yes—frequently. But the time to recovery varied from months to years, and some crises caused lasting individual-company losses. These are qualitative, dated historical mirrors, <strong>not a matched quantitative backtest</strong>. One, three, six and twelve-month forward-return calculations are not yet source-admitted and must not be invented.</p>
        <div className={styles.mirrorGrid}>{CRASH_HISTORY.map(h=>
          <details key={h.id} className={styles.mirror} data-historical-episode={h.id}>
            <summary><span>{h.year}</span><strong>{h.name}</strong><small>Drawdown {h.drawdown} · ATH {h.recovered}</small></summary>
            <div className={styles.mirrorDetails}>
              <p>{h.lesson}</p><p><strong>Comparison caveat:</strong> {h.caution}</p>
              <span>{h.market} · dated historical episode</span>
              <a href={h.source} target="_blank" rel="noopener noreferrer">Historical source ↗</a>
            </div>
          </details>)}
        </div>
        <div className={styles.lesson}><strong>Cash-flow scare ≠ permanent destruction:</strong> Amazon's reported trailing FCF was −$11.6bn in FY2022 and +$36.8bn in FY2023 as cash conversion improved. Meta's FY2022 FCF was positive despite substantial investor concern, and grew sharply in FY2023. A market can anticipate that improvement before every current-period concern disappears. <a href="https://ir.aboutamazon.com/news-release/news-release-details/2024/Amazon-com-Announces-Fourth-Quarter-Results/default.aspx" target="_blank" rel="noopener noreferrer">Amazon issuer ↗</a></div>
      </section>

      <section className={styles.section} id="cross-regimes" aria-labelledby="links-headline">
        <span className={styles.eyebrow}>05 / SHARED EVIDENCE, SEPARATE DECISIONS</span><h2 id="links-headline">How a shock travels between regimes</h2>
        <p>One original observation may matter to several watches. Each link explains a possible transmission mechanism and opens the existing regime's research. A connected watch does not inherit the crash watch's opinion or change its canonical verdict automatically.</p>
        <div className={styles.links}>{CRASH_LINKS.map(l=>
          <Link key={l.id} href={href("/regime-watch/"+l.id)}><strong>{l.label}</strong><span>{l.mechanism}</span><small>Inspect independent evidence and falsifier →</small></Link>)}
        </div>
      </section>

      <footer className={styles.footer}>
        <div><strong>Research, not a trade signal</strong><p>Historical comparisons use different index bases and are not forecasts. Source coverage and method gaps can prevent a verdict. Existing Research Gap and canonical Dossier review—not this public page—own any production thesis revision.</p></div>
        <a href="https://github.com/clydigital/alchemy-live-market-desk/issues/1211" target="_blank" rel="noopener noreferrer">Implementation and evidence gaps ↗</a>
      </footer>
    </div>
  </main>;
}
