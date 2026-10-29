import Link from "next/link";
import type {PublicTrendCard} from "@/lib/blue-desk-whats-new-trends";
import {trendPolyline} from "@/lib/blue-desk-whats-new-trends";
import styles from "./WhatsNewTrendDashboard.module.css";

type Props={cards:readonly PublicTrendCard[];marketsHref:string};
const fmt=(n:number|null,unit:"bp"|"%"|null)=>{
 if(n===null||unit===null)return "—";
 return (n>0?"+":"")+n.toFixed(2)+(unit==="bp"?" bp":"%");
};
const level=(n:number|null,unit:"bp"|"%"|null)=>{
 if(n===null||unit===null)return "Not available";
 return n.toLocaleString("en-GB",{maximumFractionDigits:3})+(unit==="bp"?"%":"");
};
function lastY(card:PublicTrendCard){
 const values=card.points.slice(-20).map(p=>p.close);
 const low=Math.min(...values),high=Math.max(...values),last=values.at(-1);
 return last===undefined||high===low?50:88-76*((last-low)/(high-low));
}
/** Static server-rendered plots from dated official/provider series. No polling,
 * synthetic observations, source promotion or event attribution. */
export default function WhatsNewTrendDashboard({cards,marketsHref}:Props){
 const current=cards.filter(c=>c.status==="ready").length;
 const stale=cards.filter(c=>c.status==="stale").length;
 return <section className={styles.section} aria-labelledby="motion-title"
    data-whats-new="source-dated-charts">
   <div className={styles.head}>
     <div>
       <p className={styles.kicker}>CROSS-ASSET CHANGES · OBSERVED, NOT INFERRED</p>
       <h2 id="motion-title">What's New</h2>
       <p>Completed-session trends, not explanations for market moves. Rates use basis-point changes; other instruments use percentage returns.</p>
     </div>
     <Link href={marketsHref} className={styles.more}>Explore Markets →</Link>
   </div>
   <p className={styles.coverage} aria-label="Source trend coverage">
     {current} of {cards.length} groups with current daily charts
     {stale?" · "+stale+" with older history":""}
     {current+stale<cards.length?" · "+(cards.length-current-stale)+" without sufficient history":""}
   </p>
   <div className={styles.grid}>
     {cards.map(card=>{
       const polyline=trendPolyline(card.points);
       const hasHistory=card.status!=="unavailable"&&Boolean(polyline);
       const first=card.points[0]?.time;
       const final=card.points.at(-1)?.time;
       const firstDate=first?new Date(first*1000).toISOString().slice(0,10):"unavailable";
       const lastDate=final?new Date(final*1000).toISOString().slice(0,10):"unavailable";
       return <article key={card.key} className={styles.card}
         data-trend-key={card.key} data-trend-status={card.status}>
         <div className={styles.cardHead}>
           <div><p className={styles.family}>{card.title}</p>
             <h3>{card.label||"No qualified series"}</h3></div>
           <span className={card.status==="ready"?styles.ready:styles.gap}>
             {card.status==="ready"?"DAILY":card.status==="stale"?"STALE":"UNAVAILABLE"}
           </span>
         </div>
         {hasHistory?<>
           <svg className={styles.chart} viewBox="0 0 300 100" role="img"
             aria-label={"Dated daily closing trend for "+card.label+" from "+firstDate+" to "+lastDate+". Not a live price or forecast."}>
             <path d="M12 88H288" className={styles.axis}/>
             <polyline points={polyline||""} className={styles.line}/>
             <circle cx="288" cy={lastY(card)} r="3.2" className={styles.lastDot}/>
           </svg>
           <div className={styles.level}><span>Last source level</span><strong>{level(card.last,card.unit)}</strong></div>
           <div className={styles.moves} aria-label="Changes over completed source sessions">
             <div><span>1S</span><strong>{fmt(card.changes.d1,card.unit)}</strong></div>
             <div><span>3S</span><strong>{fmt(card.changes.d3,card.unit)}</strong></div>
             <div><span>5S</span><strong>{fmt(card.changes.d5,card.unit)}</strong></div>
           </div>
           <div className={styles.source}>
             <span>{card.status==="stale"?"Older reading: ":"Source date: "}{card.asOf}</span>
             {card.sourceUrl?<a href={card.sourceUrl} rel="noopener noreferrer" target="_blank">
               {card.sourceName} · original series
             </a>:null}
           </div>
         </>:
          <p className={styles.empty}>{card.missingReason||"Source-qualified daily history unavailable."}</p>}
       </article>;
     })}
   </div>
   <p className={styles.note}>1S, 3S and 5S are completed sessions, not calendar days or intraday returns. ETF proxies stay labelled as proxies. Monthly series, stale readings and unavailable sources are never portrayed as live.</p>
 </section>;
}
