import type {ReactNode} from "react";
import type {EconEvent,EconMetric,UsEconStatWatch} from "@/lib/bluebelly-us-econ-stat-watch";
import {assessPceEvent} from "@/lib/bluebelly-pce-event-assessment";

/** Research-only reader: dynamic official dates/results, no private positioning
 * and no automated change to the canonical Regime or any portfolio. */
type Scope="fed"|"bonds"|"ai"|"breadth"|"cross";
type Fork=Readonly<{headline:string;support:string;countercase:string;next:string}>;
const FORKS:Record<Scope,Fork>={
 fed:{headline:"Softer core PCE versus a hawkish Fed path",
  support:"A verified downside core-PCE surprise and an actual DXY/US 2Y rejection could challenge dollar strength.",
  countercase:"Fed repricing, revisions, relative rate differentials and risk-off demand can sustain the dollar despite soft inflation.",
  next:"Use locked pre-release consensus, comparable Treasury/FX clocks, DXY 4H/Daily band confirmation and credit breadth."},
 bonds:{headline:"Disinflation versus relative rate advantage",
  support:"A softer-than-consensus inflation release could reduce the market-implied policy path.",
  countercase:"Bond supply, real rates and safe-haven demand can offset inflation relief; daily Treasury values are not an intraday quote.",
  next:"Check sourced 2Y, real 10Y and breakeven vintages, plus credit and rate differentials."},
 ai:{headline:"AI share-price rebound versus financing",
  support:"Lower verified real rates could ease the discount-rate pressure on profitable growth companies.",
  countercase:"Nvidia leadership and one index rally cannot prove hyperscaler cash conversion or neocloud financing recovery.",
  next:"Compare official earnings/capex/FCF guidance with financing and credit data after each macro catalyst."},
 breadth:{headline:"Wide participation versus an AI-led squeeze",
  support:"Falling rates combined with multiple-session equal-weight and sector participation would strengthen the recovery case.",
  countercase:"QQQ/SMH alone, VIX spikes and creator flow claims do not establish broad accumulation.",
  next:"Check RSP/SPY, 11 sector ETFs, 50D/200D breadth and HY spreads on matched completed sessions."},
 cross:{headline:"Dollar, gold and equities can disagree after the same release",
  support:"A soft-core, lower-real-yield and stable-credit combination can support a weaker USD and risk-on rebound.",
  countercase:"A growth scare can lower yields while strengthening USD on safe-haven demand and widening credit spreads.",
  next:"Separate policy-path repricing from safe-haven flows and validate DXY technical acceptance or failed retest."}
};
const historical=[
 {name:"BEA official release schedule",url:"https://www.bea.gov/news/schedule"},
 {name:"BLS release schedule",url:"https://www.bls.gov/schedule/news_release/"},
 {name:"Nvidia investor relations",url:"https://investor.nvidia.com/"},
];
export function getNov23PceFork(scope:Scope):Fork{return FORKS[scope];}

function number(value:number|null,unit:string,kind:"normal"|"surprise"="normal"){
 if(value===null)return "—";
 const raw=new Intl.NumberFormat("en-US",{maximumFractionDigits:3,minimumFractionDigits:unit==="%"?1:0}).format(value);
 const sign=kind==="surprise"&&value>0?"+":"";
 return sign+raw+(unit==="%"&&kind==="surprise"?" pp":unit?" "+unit:"");
}
function when(date:string){
 const time=Date.parse(date);
 if(!Number.isFinite(time))return date;
 return new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kuala_Lumpur",
  day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(time)+" MYT";
}
function metrics(event:EconEvent):ReactNode{
 if(!event.metrics.length)return <small style={{opacity:.75}}>Component metrics not yet available from original-source ingestion.</small>;
 return <div style={{overflowX:"auto",marginTop:8}}>
  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,textAlign:"left"}}>
   <thead><tr><th scope="col">Indicator</th><th scope="col">Prior</th><th scope="col">Consensus</th>
    <th scope="col">Actual</th><th scope="col">Surprise</th></tr></thead>
   <tbody>{event.metrics.map((m:EconMetric)=><tr key={m.key} data-us-econ-metric={m.key}>
    <th scope="row" style={{padding:"5px 10px 5px 0",minWidth:145}}>{m.label}</th>
    <td>{number(m.revisedPrevious??m.previous,m.unit)}</td>
    <td>{m.forecast!==null?<span>{number(m.forecast,m.unit)} {m.forecastUrl?
      <a href={m.forecastUrl} title={"Captured "+m.forecastCapturedAt+" · "+m.forecastSource}
       target="_blank" rel="noopener noreferrer">source</a>:null}</span>:"Not verified"}</td>
    <td>{number(m.actual,m.unit)}</td>
    <td>{m.surprise!==null?number(m.surprise,m.unit,"surprise"):"Unresolved"}</td>
   </tr>)}</tbody>
  </table>
 </div>;
}
function eventCard(e:EconEvent):ReactNode{
 const pce=e.family==="PCE"?assessPceEvent(e,new Date()):null;
 return <article key={e.id} data-us-econ-event={e.id} data-us-econ-status={e.status}
  style={{border:"1px solid var(--bb-card-border)",borderRadius:8,padding:"14px",minWidth:0}}>
  <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
   <strong>{e.family} · {e.name}</strong>
   <span style={{fontSize:11,fontWeight:700}}>{e.status.replaceAll("_"," ")}</span>
  </div>
  <p style={{fontSize:12,margin:"5px 0"}}>
   {e.referencePeriod?e.referencePeriod+" · ":""}
   {e.sourceClock?"Observed "+when(e.sourceClock):e.releaseAt.endsWith("T00:00:00Z")?
    e.releaseAt.slice(0,10)+" · publisher date (time unverified)":
    "Scheduled "+when(e.releaseAt)}
  </p>
  {e.actualText?<p style={{fontSize:13,margin:"6px 0"}}><b>Official actual:</b> {e.actualText}</p>:null}
  {pce?<div data-pce-event-assessment={pce.status} data-pce-research-only="true"
    style={{borderLeft:"3px solid var(--bb-accent)",padding:"6px 10px",margin:"8px 0",
     background:"var(--bb-surface-muted,transparent)",fontSize:12}}>
    <b>Source-governed PCE read: {pce.status.replaceAll("_"," ")}</b>
    <p style={{margin:"5px 0"}}>{pce.explanation}</p>
    {pce.coreSurprisePp!==null?<p style={{margin:"5px 0"}}>
      Core m/m vs locked forecast: <strong>{number(pce.coreSurprisePp,"%","surprise")}</strong>.
      This is a release surprise, not evidence of a completed FX/yield reaction.
     </p>:null}
    {pce.missing.length?<p style={{margin:"5px 0"}}>Missing verification: {pce.missing.join(", ")}</p>:null}
    <p style={{margin:"5px 0"}}><b>Competing explanation:</b> {pce.strongestCountercase}</p>
    <p style={{margin:"5px 0"}}><b>Next decisive test:</b> {pce.nextTest}</p>
    <small>CME intraday FedWatch and intraday Treasury feeds are not integrated.
      This is RESEARCH ONLY; no canonical regime or portfolio decisions are changed.</small>
   </div>:null}
  {metrics(e)}
  <small style={{display:"block",marginTop:8}}><a href={e.sourceUrl}
   target="_blank" rel="noopener noreferrer">{e.agency} · original source</a>
   {" "}· Source timestamps differ from this page refresh.
  </small>
 </article>;
}
export default function RegimeNov23PceChallenge({scope,watch}:{
 scope:Scope;now?:Date;watch?:UsEconStatWatch
}):ReactNode{
 const view=FORKS[scope];
 return <section id="us-econ-stat-watch" data-us-econ-stat-watch="automatic-official-source-v1"
  data-regime-research-status="RESEARCH_ONLY" data-regime-pce-scope={scope}
  aria-label="Automated US economic statistics watch"
  style={{margin:"18px 0 26px",padding:"20px clamp(16px,3vw,28px)",
   background:"var(--bb-surface)",border:"1px solid var(--bb-card-border)",borderRadius:10,lineHeight:1.6}}>
  <span style={{display:"block",textTransform:"uppercase",fontSize:11,fontWeight:800,
   color:"var(--bb-accent)",letterSpacing:".09em"}}>AUTOMATIC · US MACRO · OFFICIAL-SOURCE READOUT</span>
  <h2 style={{fontSize:"clamp(22px,2.5vw,30px)",margin:"8px 0"}}>US Economic Statistics Watch</h2>
  <p style={{fontSize:14,marginTop:0}}>Inflation, jobs and growth: upcoming government releases, verified actuals,
   previous readings and source-stamped consensus surprises. Updated from existing ingestion on page refresh.
   <strong> No invented forecast, live FedWatch probability or automatic regime change.</strong></p>
  {watch?<div data-us-econ-state={watch.status}>
    <p style={{fontSize:12,opacity:.85}}>
     Source status: <b>{watch.status.replaceAll("_"," ")}</b> · Page rendered {when(watch.generatedAt)}
     {" "}· {watch.countVerified} verified recent releases · {watch.countPending} awaiting complete verification.
    </p>
    {watch.status!=="OK"?<p style={{fontSize:13}}>{watch.sourceStatus}</p>:null}
    <p style={{fontSize:12}}><b>Next calendar test:</b> {watch.nextTest}</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,280px),1fr))",gap:16}}>
      <div><h3 style={{fontSize:16,margin:"6px 0 12px"}}>Upcoming · 21 days</h3>
       <div style={{display:"grid",gap:10}}>{watch.upcoming.length?
        watch.upcoming.map(eventCard):<p style={{fontSize:13}}>No eligible future date was verified in this window; this is not proof there are no US events.</p>}
       </div>
      </div>
      <div><h3 style={{fontSize:16,margin:"6px 0 12px"}}>Recent releases · 35 days</h3>
       <div style={{display:"grid",gap:10}}>{watch.latest.length?
        watch.latest.map(eventCard):<p style={{fontSize:13}}>No source-qualified recent result available in the current feed.</p>}
       </div>
      </div>
    </div>
    <p style={{fontSize:12,opacity:.85,marginTop:16}}>
     {watch.sourceStatus} Daily Treasury yields and missing CME intraday FedWatch are not substitutes for event-time quotes.
     Dollar, real-rate, gold, breadth and credit interpretations require separate time-matched evidence and review.
    </p>
  </div>:<p data-us-econ-state="SOURCE_UNAVAILABLE">Source reader unavailable: no macro event status can be certified.</p>}
  <details style={{borderTop:"1px solid var(--bb-card-border)",paddingTop:12,marginTop:16}}>
   <summary style={{cursor:"pointer",fontWeight:700,fontSize:13}}>
    Research countercase · DXY/PCE and the 23 November market rebound (dated, not current)
   </summary>
   <div data-regime-pce-research="2026-11-23-research-only" style={{fontSize:13,marginTop:10}}>
    <h3 style={{fontSize:15}}>{view.headline}</h3>
    <p><b>Hypothesis:</b> {view.support}</p>
    <p><b>Countercase:</b> {view.countercase}</p>
    <p><b>Deciding test:</b> {view.next}</p>
    <p>A bearish DXY technical read is a conditional test, not a measured signal in this module.
     Historical research notes MUST NOT be read as fresh post-release verdicts.
     No inferred institutional flows, private creator data, trade entries or automatic Story/Regime changes.</p>
    {historical.map((link,i)=><span key={link.url}>{i?" · ":""}<a href={link.url}
      target="_blank" rel="noopener noreferrer">{link.name}</a></span>)}
   </div>
  </details>
 </section>;
}
