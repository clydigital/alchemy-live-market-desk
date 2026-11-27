import Link from "next/link";
import s from "@/app/market-tools/market-tools.module.css";
import home from "@/app/blue-desk/market-first-home.module.css";
import {FOUR_H_SYMBOLS,type FourHRead} from "@/lib/bluebelly-4h-levels";
import {TECHNICAL_UNIVERSE,type TechnicalSnapshot} from "@/lib/providers/twelve-data-ema-history";
import type {Band} from "@/lib/ema-sd-levels";

const colors:Record<number,string>={20:"#e89536",50:"#299568",100:"#4789d2",200:"#a478d4"};
const fmt=(n:number|null)=>n===null?"—":n.toLocaleString("en-GB",{maximumFractionDigits:4,minimumFractionDigits:2});
const frames={"1day":"Daily","1week":"Weekly","1month":"Monthly"} as const;

function Levels({bands}:{bands:Band[]}){
 return bands.length?<div className={s.technicalTable}><table><thead><tr>{["Period","Lower","EMA","Upper","Distance to EMA","Position","History"].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{bands.map(b=><tr key={b.period}><th scope="row"><span className={s.emaSwatch} style={{background:colors[b.period]}}/>EMA {b.period} ±{b.multiplier}σ</th><td>{fmt(b.lower)}</td><td>{fmt(b.ema)}</td><td>{fmt(b.upper)}</td><td>{b.distancePct===null?"—":fmt(b.distancePct)+"%"}</td><td>{b.position??"—"}</td><td>{b.status.replaceAll("_"," ")}</td></tr>)}</tbody></table></div>:<p>No levels available for this read.</p>;
}

export default function OwnerTechnicalLevels({snapshot,ticker,fourH}:{snapshot:TechnicalSnapshot|null;ticker:string;fourH:FourHRead|null}){
 const requested=Boolean(snapshot||fourH);
 const symbol=snapshot?.ticker??fourH?.symbol??"—";
 const eventCount=fourH?.events.length??0;
 const macroSelection=FOUR_H_SYMBOLS.find(x=>x===fourH?.symbol)??"XAU/USD";
 return <section id="ema-sd-levels" className={home.terminal} data-technical-layout="command-terminal">
  <header className={home.hero}>
   <div className={home.heroCopy}>
    <p className={home.eyebrow}><span className={home.heroSignal} aria-hidden="true"/> SOURCE-DATED TECHNICAL TERMINAL</p>
    <h1 className={home.title}>Price first. <span>Boundaries next.</span></h1>
    <p className={home.intro}>See where price is relative to the EMA / SD framework, then inspect crosses, holds and approaches. Completed bars only; no streaming quote or automatic trade call.</p>
    <form method="get" action="/market-tools" className={s.technicalControl}>
     <label htmlFor="technical-equity">Equity / ETF</label>
     <div><select id="technical-equity" name="technical" defaultValue={ticker}>{TECHNICAL_UNIVERSE.map(x=><option value={x.ticker} key={x.ticker}>{x.ticker} · {x.label}</option>)}</select><button type="submit">Check 4H / D / W / M</button></div>
    </form>
    <form method="get" action="/market-tools" className={s.technicalControl}>
     <label htmlFor="technical-macro">Macro / crypto · 4H only</label>
     <div><select id="technical-macro" name="fourh" defaultValue={macroSelection}>{FOUR_H_SYMBOLS.map(x=><option key={x} value={x}>{x}</option>)}</select><button type="submit">Check 4H levels</button></div>
    </form>
   </div>
   <div className={s.technicalLegend}>
    <p className={home.eyebrow}>EMA / SD FRAMEWORK</p>
    {[[20,1],[50,1],[100,.5],[200,.25]].map(([period,width])=><div key={period}><span className={s.emaSwatch} style={{background:colors[period]}}/><strong>EMA {period}</strong><span>±{width}σ</span></div>)}
    <small>4H execution context · D / W / M structure</small>
   </div>
  </header>
  <section className={home.panel} aria-labelledby="technical-summary">
   <div className={home.panelHead}><div><p className={home.eyebrow}>01 / INSTRUMENT SNAPSHOT</p><h2 id="technical-summary">What are we looking at?</h2></div></div>
   <div className={s.technicalMetrics}>
    {[
     {label:"Instrument",value:symbol,note:snapshot?.currency??(fourH?"4H only":"Select an instrument above")},
     {label:"4H completed close",value:fmt(fourH?.close??null),note:fourH?.asOf??"Not checked"},
     {label:"Daily completed close",value:fmt(snapshot?.frames.find(f=>f.frame==="1day")?.close??null),note:snapshot?.frames.find(f=>f.frame==="1day")?.asOf??"Not checked"},
     {label:"4H boundary events",value:fourH?String(eventCount):"—",note:fourH?.status??"Not checked"}
    ].map(m=><article className={home.quote} key={m.label}><p className={home.quoteLabel}>{m.label}</p><p className={home.quoteValue}>{m.value}</p><p className={home.source}>{m.note}</p></article>)}
   </div>
   {!requested&&<p className={s.technicalHint}>Choose an instrument above to retrieve its levels. No provider request runs on initial page load.</p>}
   {snapshot&&<p className={s.technicalHint}>Twelve Data · split-adjusted, not total return · retrieved {snapshot.retrievedAt} (view retrieval time, not native vendor update). {snapshot.discardedSentinels>0?"Excluded "+snapshot.discardedSentinels+" epoch sentinel rows.":""}</p>}
  </section>
  <section className={home.panel} aria-labelledby="technical-events">
   <div className={home.panelHead}><div><p className={home.eyebrow}>02 / BOUNDARY RADAR · 4H</p><h2 id="technical-events">What changed?</h2></div></div>
   {fourH?<><p className={s.technicalHint}>{fourH.symbol} · {fourH.status} · {fourH.asOf??"No completed window"} · {fourH.sampleCount} bars · {fourH.gapCount} non-four-hour gaps. {fourH.reason}</p>
    {eventCount?<div className={s.technicalEventGrid}>{fourH.events.map(e=><article className={home.item} key={e.period+e.boundary+e.kind+e.asOf}><span className={s.eventDirection} data-direction={e.direction}>{e.direction==="up"?"↑":"↓"} {e.kind}</span><h3>EMA {e.period} · {e.boundary} boundary</h3><p>Level <strong>{fmt(e.level)}</strong> · Distance {fmt(e.distancePct)}%</p><p>{e.asOf} · {e.closes} completed closes</p></article>)}</div>:<p className={s.technicalHint}>No qualifying recent 4H event in available history. Missing or indicative data is not a verified no-signal verdict.</p>}
    <details className={s.technicalDisclosure} open><summary>4H boundary levels <span>{fourH.status}</span></summary><Levels bands={fourH.bands}/></details>
   </>:<p className={s.technicalHint}>Boundary events will appear after a 4H check. This view is not an automatic universe-wide scanner.</p>}
  </section>
  <section className={home.panel} aria-labelledby="technical-structure">
   <div className={home.panelHead}><div><p className={home.eyebrow}>03 / HIGHER TIMEFRAME STRUCTURE</p><h2 id="technical-structure">Where are the important levels?</h2></div></div>
   {snapshot?<div className={s.technicalFrameGrid}>{snapshot.frames.map(f=><details key={f.frame} className={s.technicalDisclosure} open={f.frame==="1day"||undefined}>
    <summary>{frames[f.frame]} <span>{f.status} · Close {fmt(f.close)}</span></summary>
    <p className={s.technicalHint}>{f.asOf??"No completed period"} · {f.sampleCount} bars · {f.frame==="1day"?"session date":"period start"}. {f.reason??""}</p>
    {(f.events??[]).map(e=><p className={s.technicalHint} key={e.period+e.boundary}><strong>{e.kind} {e.direction==="up"?"↑":"↓"} · EMA {e.period} {e.boundary}</strong> · {fmt(e.level)} · {fmt(e.distancePct)}% · {e.asOf}</p>)}
    <Levels bands={f.bands}/>
   </details>)}</div>:<p className={s.technicalHint}>Daily, weekly and monthly levels appear after an equity / ETF check. Macro-only reads do not supply these timeframes.</p>}
  </section>
  <details className={home.archive}>
   <summary>Methodology / source limitations</summary>
   <p className={s.technicalHint}>SHORT_WARMUP is indicative only; INSUFFICIENT means no value calculated. 5× period warm-up is a conservative threshold. Weekly/monthly current bars excluded. D/W/M event dates identify the daily session or period start. Daily events require the last four official prior NYSE sessions; weekly/monthly require consecutive calendar periods. Crosses and approaches use completed windows and ready warm-up. US equities use scheduled regular-session windows; macro windows use elapsed UTC time. Chart parity, exact holiday/session completeness and feed licensing remain verification gates; no automated trading or accumulation change.</p>
  </details>
  <div className={home.panelFooter}><Link href="/markets?group=equities#market-fundamentals">Market Instruments · fundamentals</Link><Link href="/markets?mode=watch">Divergence Watch</Link></div>
 </section>
}
