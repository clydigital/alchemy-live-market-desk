import Link from "next/link";
import type {BondMetric,BondPressureMonitor,BondWindowLabel} from "@/lib/bluebelly-bond-pressure";
import s from "./BondPressureMonitor.module.css";

type Props={reading:BondPressureMonitor;marketsHref:string};
const change=(value:number|null,unit:string)=>{
 if(value===null)return "—";
 return (value>0?"+":"")+value.toFixed(2)+" "+unit;
};
const last=(item:BondMetric)=>{
 if(item.last===null)return "—";
 return item.kind==="etf"?"$"+item.last.toFixed(2):item.kind==="volatility"?item.last.toFixed(1):
  item.last.toFixed(item.kind==="yield"?3:2)+"%";
};
const label=(state:BondPressureMonitor["state"])=>
 state==="READY"?"LATEST SOURCE SESSION":state==="LAST_REPORTED"?"LAST REPORTED SESSION":
 state==="PARTIAL"?"SOURCE MISMATCH":state==="STALE"?"DATA STALE":"DATA UNAVAILABLE";
function MetricTable({rows,caption}:{rows:BondMetric[];caption:string}){
 return <div className={s.tableWrap}>
  <table><caption>{caption}</caption>
   <thead><tr><th scope="col">Instrument</th><th scope="col">Level</th>
    <th scope="col">1D</th><th scope="col">3D</th><th scope="col">5D</th><th scope="col">As of</th></tr></thead>
   <tbody>{rows.map(row=><tr key={row.id} data-bond-instrument={row.id}>
    <th scope="row">{row.sourceUrl?<a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">{row.label}</a>:row.label}</th>
    <td>{last(row)}</td>
    {(["1D","3D","5D"] as BondWindowLabel[]).map(window=><td key={window}
      data-bond-change={window}>{change(row.changes[window],row.kind==="etf"?"%":row.kind==="volatility"?"pts":"bp")}</td>)}
    <td>{row.asOf??"Unavailable"}</td>
   </tr>)}</tbody>
  </table>
 </div>;
}
export default function BondPressureMonitor({reading,marketsHref}:Props){
 const selected=reading.windows[0];
 return <section id="bond-pressure" className={s.shell} aria-labelledby="bond-pressure-title"
  data-bond-pressure-monitor="market-series-v1" data-bond-source-state={reading.state}
  data-bond-session-date={reading.asOf??"unavailable"}>
  <header className={s.head}>
   <div><p className={s.kicker}>BONDS / SOURCE-DATED DURATION TERMINAL</p>
    <h2 id="bond-pressure-title">Are long bonds getting more attractive?</h2>
    <p>Start with actual 10Y/30Y yields, then test real rates, inflation compensation, curve slope and TLT.</p></div>
   <span className={s.status} data-bond-data-status={reading.state}>{label(reading.state)}</span>
  </header>
  <div className={s.result}>
   <div className={s.verdict}><span>LONG-END DURATION PRESSURE</span>
    <h3>{reading.headline}</h3>
    <p>{reading.notice}</p>
    <small>10Y and 30Y must have matching observation and comparison dates. Green means yields down (positive for duration), red up (negative); yellow divergence. No automatic buy call.</small>
   </div>
   <div className={s.windows} aria-label="Last 1, 3 and 5 source sessions">
    {reading.windows.map(w=><div key={w.label} data-bond-window={w.label}
      data-bond-trend={w.trend} className={s.window}>
     <div className={s.windowHead}><strong>{w.label}</strong><span className={s.dot} aria-hidden="true"/></div>
     <b>{w.trend==="unknown"?"UNKNOWN":w.trend==="mixed"?"MIXED":w.trend==="better"?"EASING":"RISING"}</b>
     <small>10Y {change(w.tenYearBp,"bp")} · 30Y {change(w.thirtyYearBp,"bp")}</small>
     <small>{w.from&&w.to?w.from+" → "+w.to:"No matched source window"}</small>
    </div>)}
   </div>
  </div>
  <div className={s.cards}>
   <section className={s.tlt}>
    <div><span className={s.kicker}>01 / TLT CONFIRMATION</span><h3>{
     reading.tltConfirmation==="CONFIRMED"?"Price action confirms the yield direction":
     reading.tltConfirmation==="DIVERGENT"?"TLT and yields are diverging":
     reading.tltConfirmation==="QUIET"?"Movement below the significance threshold":
     "Matched TLT confirmation not available"}</h3></div>
    <p>TLT cash-session price change must match the observed Treasury date. An ETF can trade when the Treasury market is closed; that is <strong>not</strong> official same-session yield confirmation.</p>
    <small data-tlt-confirmation={reading.tltConfirmation}>Status: {reading.tltConfirmation.replace("_"," ").toLowerCase()} · This is a directional comparison, not a valuation or return forecast.</small>
   </section>
   <section className={s.curve}>
    <span className={s.kicker}>02 / CURVE SPREADS</span>
    {reading.spreads.map(spread=><div className={s.spread} key={spread.label}>
      <span>{spread.label}</span><strong>{spread.bp===null?"—":change(spread.bp,"bp")}</strong>
      <small>{spread.asOf??"Unmatched dates"}</small>
    </div>)}
   </section>
  </div>
  <details className={s.deep} open>
   <summary>US Treasury curve · official or FRED source session</summary>
   <MetricTable rows={reading.curve} caption="Treasury nominal yields (%) and source-session changes (basis points)."/>
  </details>
  <details className={s.deep}>
   <summary>Inflation, real yields, credit and bond volatility</summary>
   <p>Real yield and breakeven series may publish on different clocks. Do not add mismatched readings into a synthetic nominal yield. MOVE changes are index points, not basis points.</p>
   <MetricTable rows={reading.drivers} caption="Source-dated drivers: rates and credit in percentage points, changes in basis points; MOVE in index points."/>
  </details>
  <details className={s.deep}>
   <summary>Bond ETFs · TLT / IEF / SHY / TIP</summary>
   <p>ETF levels and percentage changes are unadjusted source price observations, not distributions-inclusive total returns.</p>
   <MetricTable rows={reading.etfs} caption="Available ETF trading-session price observations and percentage changes."/>
  </details>
  <footer className={s.foot}>
   <p>1D, 3D and 5D are <strong>trading-session changes</strong>, not calendar-day news signals. Prior official yield observations are retained across expected market closures. Stale data cannot create a current direction. Real yield, breakeven, credit and TLT are separate diagnostics, not inputs automatically redefining the Regime.</p>
   <div className={s.links}><Link href={marketsHref}>Markets · yield curve and rate comparisons ↗</Link>
    <a href="https://home.treasury.gov/resource-center/data-chart-center/interest-rates" target="_blank" rel="noopener noreferrer">US Treasury source ↗</a>
    <a href="https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html" target="_blank" rel="noopener noreferrer">CME FedWatch · external (no live odds) ↗</a></div>
  </footer>
 </section>;
}
