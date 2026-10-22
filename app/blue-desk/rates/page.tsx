import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import PublicGovernmentRateTrendChart from "@/components/blue-desk/PublicGovernmentRateTrendChart";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { publicMarketObservations,publicGovernmentRateTrends } from "@/lib/blue-desk-public-markets";
import styles from "../blue-desk.module.css";
import layout from "../key-stories/public-sections.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"US Rates & Yield Curve | Bluebelly",description:"Source-dated Treasury levels, changes and historical trends."};
const chosen=["us2y","us5y-fred","us10y-fred","us20y-fred","us30y-fred"];
export default async function PublicRates() {
  const host=(await headers()).get("host");
  const monitor=await getMarketMonitor().catch(()=>null);
  const observations=publicMarketObservations(monitor?.rows||[],"rates");
  const selected=chosen.map(id=>observations.find(o=>o.id===id))
    .filter((v):v is NonNullable<typeof v>=>v!==undefined);
  const rateMap=new Map(selected.map(x=>[x.id,x]));
  const curve=(()=>{
    const a=rateMap.get("us2y"),b=rateMap.get("us10y-fred");
    if(a?.last===null||a?.last===undefined||b?.last===null||b?.last===undefined)return null;
    if(a.asOf!==b.asOf)return null; // Never mix historical dates into a precise spread.
    return {bps:(b.last-a.last)*100,asOf:a.asOf};
  })();
  const series=publicGovernmentRateTrends(monitor?.rows||[]);
  return <main className={styles.page} data-bluebelly-section="rates">
    <BlueDeskHeader activePath="/rates"/>
    <div className={styles.content}>
      <header className={layout.heading}>
        <div><p className={styles.kicker}>OFFICIAL-ORIGIN TREASURY OBSERVATIONS</p>
          <h1>US rates and the yield curve</h1>
          <p>Compare 2Y, 5Y, 10Y, 20Y and 30Y yields and the daily trend.
            Levels are source-dated—not a live futures or CPI-minute reaction.</p>
        </div>
        <Link href={blueDeskPublicHref("/blue-desk",host)}>← Market summary</Link>
      </header>
      <section className={layout.rateSummary}>
        <div><small>2Y–10Y TERM SPREAD</small><strong>{curve?((curve.bps>=0?"+":"")+curve.bps.toFixed(1)+" bp"):"UNAVAILABLE"}</strong>
          <span>{curve?.asOf||"Need matching original dates"}</span></div>
        <div><small>CURVE COVERAGE</small><strong>{selected.length}/5</strong><span>Named source-dated tenors</span></div>
        <div><small>PRECISION</small><strong>DAILY</strong><span>No intraday reaction inferred</span></div>
      </section>
      <section aria-labelledby="tenor-title" className={styles.section}>
        <div className={styles.sectionHead}><h2 id="tenor-title">Treasury tenors</h2>
          <Link href={blueDeskPublicHref("/blue-desk/markets?group=rates",host)}>Full rates monitor →</Link></div>
        {selected.length?<div className={layout.rateGrid}>{selected.map(item=><article key={item.id} className={layout.rateCard}>
          <small>{item.label}</small>
          <strong>{item.last===null?"—":item.last.toFixed(3)+"%"}</strong>
          <span>{item.change===null?"Daily change unavailable":(item.change>=0?"+":"")+item.change.toFixed(1)+" bp vs prior session"}</span>
          <DualTimestamp value={item.asOf} sourceDate={item.asOf}/>
          {item.sourceUrl?<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName} ↗</a>:null}
        </article>)}</div>:<div className={styles.secondaryPanel}><p>No source-admitted Treasury observations are available.</p></div>}
      </section>
      {monitor?<PublicGovernmentRateTrendChart series={series} nowIso={monitor.updatedAt}/>:null}
      <section className={layout.callout}>
        <h2>How to use rates in a market story</h2>
        <p>The 2Y yield may reflect monetary-policy expectations, while the long end also responds to supply,
          inflation compensation and term premium. A move in yields alone cannot establish which mechanism dominates.</p>
        <p>Before a COTD or stream conclusion, verify the release window, original publication date,
          duration/FX response and contrary evidence.</p>
        <Link href={blueDeskPublicHref("/blue-desk/presenter",host)}>Investigate in Presenter Deck →</Link>
      </section>
    </div>
  </main>;
}
