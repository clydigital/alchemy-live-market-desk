import Link from "next/link";
import {headers} from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import {getMarketMonitor} from "@/lib/market-monitor-public";
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
  const monitor=await getMarketMonitor().catch(()=>null);
  const watch=buildCrashWatchView(monitor?.rows??null,now);
  const href=(path:string)=>blueDeskPublicHref("/blue-desk"+path,host);
  const position=watch.position==="BULL_LEAN"?"Opportunity lean":
    watch.position==="BEAR_LEAN"?"Crash-risk lean":"Contested";
  return <main className={desk.page} data-crash-opportunity="source-dated-research-view" data-gauge={watch.position}>
    <BlueDeskHeader activePath="/blue-desk/regime-watch"/>
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
            <a href="#gauge">READ THE EVIDENCE GAUGE ↗</a>
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
