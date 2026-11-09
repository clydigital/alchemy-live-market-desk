import type {PublicMarketObservation} from "@/lib/blue-desk-public-markets";
import MarketWindowBars from "./MarketWindowBars";
import s from "./PublicTreasuryLadder.module.css";

const TENORS=[
  {tenor:"2Y",ids:["us2y","us2y-fred"]},
  {tenor:"5Y",ids:["us5y-fred","us5y"]},
  {tenor:"10Y",ids:["us10y-fred","us10y"]},
  {tenor:"20Y",ids:["us20y-fred","us20y"]},
  {tenor:"30Y",ids:["us30y-fred","us30y"]},
] as const;

function admitted(row:PublicMarketObservation){
  return row.type==="Rates" && row.changeUnit==="bp" &&
    (row.sourceName==="U.S. Department of the Treasury" ||
      row.sourceName==="Federal Reserve Economic Data");
}

/**
 * An explicitly US-only tenor ladder from the existing public market projection.
 * No synthetic yield curve, interpolated tenors or non-US yield data.
 */
export default function PublicTreasuryLadder({rows}:{rows:readonly PublicMarketObservation[]}){
  const columns=TENORS.map(({tenor,ids})=>{
    const candidates=rows.filter(row=>ids.some(id=>row.id===id)&&admitted(row));
    const row=candidates.find(item=>item.last!==null&&Number.isFinite(item.last)&&item.asOf)
      ||candidates[0]||null;
    const available=Boolean(row?.asOf&&row.last!==null&&Number.isFinite(row.last)
      &&row.dataStatus!=="UNAVAILABLE_OR_STALE");
    return {tenor,row,available};
  });
  return <section id="yield-ladder" className={s.shell}
    data-v7-treasury-ladder="source-dated-us-only"
    aria-labelledby="yield-ladder-title">
    <header className={s.heading}>
      <div><p>02 / RATES MONITOR · VERIFIED SOURCE SESSIONS</p>
        <h2 id="yield-ladder-title">US Treasury yield ladder</h2></div>
      <span>LEVEL: % <b>·</b> CHANGE: bp</span>
    </header>
    <div className={s.grid}>
      {columns.map(({tenor,row,available})=><article className={s.tenor} key={tenor}
        data-status={available?"source-dated":"unavailable"}>
        <div className={s.topline}><span>{tenor} YIELD</span>
          <span>{row?.asOf ? row.asOf.slice(0,10) : "NO SESSION"}</span></div>
        <strong className={s.value}>{available ? `${row!.last!.toFixed(3)}%` : "—"}</strong>
        <MarketWindowBars change={available?row!.change:null}
          change3d={available?row!.change3d:null}
          change5d={available?row!.change5d:null} unit="bp"/>
        <small>{row?.sourceUrl
          ? <a href={row.sourceUrl} rel="noreferrer" target="_blank">{row.sourceName}</a>
          : row?.sourceName||"Original source unavailable"}</small>
      </article>)}
    </div>
    <p className={s.caveat}>Last reported official US nominal yields. Source sessions may differ by tenor.
      Bars are within-tenor 1D/3D/5D comparisons, not a yield curve or a real-time quote.
      International yield spreads are not inferred from these US observations.</p>
  </section>;
}
