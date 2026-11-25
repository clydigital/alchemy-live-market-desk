import Link from "next/link";
import {TECHNICAL_UNIVERSE,type TechnicalSnapshot} from "@/lib/providers/twelve-data-ema-history";
const colors:Record<number,string>={20:"#e89536",50:"#299568",100:"#4789d2",200:"#a478d4"};
const fmt=(n:number|null)=>n===null?"—":n.toFixed(2);
export default function OwnerTechnicalLevels({snapshot,ticker}:{snapshot:TechnicalSnapshot|null;ticker:string}){
 return <section id="ema-sd-levels" style={{border:"1px solid currentColor",borderRadius:12,padding:18,margin:"18px 0"}}>
 <small>PRIVATE TECHNICAL RESEARCH / D · W · M</small><h2>EMA / SD levels to watch</h2>
 <p>EMA 20 ±1σ · 50 ±1σ · 100 ±0.5σ · 200 ±0.25σ. Completed bars only. Source: Twelve Data (split-adjusted, not total return). Research levels, not automatic trade signals.</p>
 <form method="get" action="/market-tools" style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
 <label>Instrument <select name="technical" defaultValue={ticker}>{TECHNICAL_UNIVERSE.map(x=><option value={x.ticker} key={x.ticker}>{x.ticker} · {x.label}</option>)}</select></label><button type="submit">Calculate levels</button>
 </form>
 {!snapshot?<p>Select an instrument to load three cached historical series. No provider call on the default page.</p>:<><p><strong>{snapshot.ticker}</strong> · {snapshot.currency} · Retrieved for this view {snapshot.retrievedAt.slice(0,10)} (not a native vendor update time). {snapshot.discardedSentinels>0?`Excluded ${snapshot.discardedSentinels} epoch sentinel rows.`:""}</p>
 {snapshot.frames.map(f=><div key={f.frame} style={{margin:"16px 0",overflowX:"auto"}}><h3>{f.frame==="1day"?"Daily":f.frame==="1week"?"Weekly":"Monthly"} · {f.status}</h3><p>{f.asOf??"No completed period"} · {f.sampleCount} bars · {f.frame==="1day"?"session date":"period start"} · Last completed close {fmt(f.close)}. {f.reason??""}</p>
 <table style={{width:"100%",textAlign:"left",borderCollapse:"collapse"}}><thead><tr>{["Period","Lower","EMA","Upper","Distance to EMA","Position","History"].map(h=><th key={h} style={{padding:7}}>{h}</th>)}</tr></thead><tbody>{f.bands.map(b=><tr key={b.period} style={{borderTop:"1px solid rgba(128,128,128,.3)"}}><th style={{color:colors[b.period],padding:7}}>{b.period} ±{b.multiplier}σ</th><td>{fmt(b.lower)}</td><td>{fmt(b.ema)}</td><td>{fmt(b.upper)}</td><td>{b.distancePct===null?"—":fmt(b.distancePct)+"%"}</td><td>{b.position??"—"}</td><td>{b.status}</td></tr>)}</tbody></table></div>)}</>}
 <p><small>SHORT_WARMUP is indicative only; INSUFFICIENT means no value calculated. 5× period warm-up is a conservative threshold. Weekly/monthly current bars excluded. Chart parity, exact holiday/session completeness and feed licensing remain verification gates; no automated trading or accumulation change.</small></p>
 <Link href="https://bluebelly-desk.vercel.app/markets?group=equities#market-fundamentals">Return to Market Instruments fundamentals →</Link>
 </section>
}
