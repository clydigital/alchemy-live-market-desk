import Link from "next/link";
import AcceleratorDial from "./AcceleratorDial";
import type {PublicMarketObservation} from "@/lib/blue-desk-public-markets";
import type {JobsPublicProjection} from "@/lib/macro/jobs-public-projection";
import type {BluebellyAbsorptionHealth} from "@/lib/bluebelly-absorption-health";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import {proxySignalTone,type LensSignalTone} from "@/lib/bluebelly-regime-lens-card-signal";
import type {RegimeDirectionId} from "@/lib/bluebelly-regime-direction-reads";
import s from "./MarketConditionsBoard.module.css";

type Direction = -1 | 0 | 1 | null;
type Props = {
  market: readonly PublicMarketObservation[];
  breadth: PublicMarketObservation | null;
  jobs: JobsPublicProjection | null;
  health: BluebellyAbsorptionHealth | null;
  now: Date;
  host: string | null;
};
function lastDate(value:string|null,now:Date,maxDays:number){
  if(!value)return false;
  const stamp=Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+"T00:00:00Z":value);
  const age=now.getTime()-stamp;
  return Number.isFinite(stamp) && age>=-300000 && age<=maxDays*86400000;
}
function admissible(row:PublicMarketObservation|null,now:Date){
  return Boolean(row && row.frequency==="daily" && row.last!==null &&
    row.dataStatus!=="UNAVAILABLE_OR_STALE" && lastDate(row.asOf,now,6));
}
function sign(value:number,unit:string){
  return (value>0?"+":"")+value.toFixed(unit==="bp"?1:2)+" "+unit;
}
function direction(value:number|null):Direction{
  return value===null||!Number.isFinite(value)?null:value>0?1:value<0?-1:0;
}
function findMarket(rows:readonly PublicMarketObservation[],type:string,prefer:RegExp){
  const group=rows.filter(x=>x.type===type);
  return group.find(x=>prefer.test(x.symbol)||prefer.test(x.label))??group[0]??null;
}
function TapeCard({name,scope,row,href,now,signalId,changeWindow="1D",left,right}:{
  name:string;scope:string;row:PublicMarketObservation|null;href:string;now:Date;
  signalId:RegimeDirectionId;changeWindow?:"1D"|"5D";left:string;right:string;
}){
  const ready=admissible(row,now);
  const delta=ready?(changeWindow==="5D"?row!.change5d:row!.change):null;
  const needle=direction(delta);
  const unit=row?.changeUnit??"%";
  const signal=proxySignalTone(signalId,needle);
  const status=signal==="improving"?"EASING / STRENGTHENING":
    signal==="pressure"?"RISING PRESSURE / WEAKNESS":
    signal==="mixed"?"MIXED / FLAT":"NO CURRENT SIGNAL";
  return <Link href={href} className={s.card} data-condition={name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}
    data-condition-status={!ready?"unavailable":needle===null?"partial":"measured"} data-signal-tone={signal}
    aria-label={name+": "+status+". "+(ready?row!.asOf:"Source unavailable")}>
    <div className={s.cardTop}><span className={s.scope}>{scope}</span><strong className={s.toneTag}>{status}</strong></div>
    <h3>{name}</h3>
    <div className={s.meter}><AcceleratorDial compact label={name} direction={needle}
      leftLabel={left} rightLabel={right} middleLabel="FLAT"/></div>
    <div className={s.mainValue}>{ready?row!.last!.toLocaleString("en-GB",{maximumFractionDigits:2})+(row!.type==="Rates"?"%":row!.type==="Breadth"?"%":""):"—"}</div>
    <p className={s.delta}>{needle===null?"No comparable current change":changeWindow+" "+sign(delta!,unit)}</p>
    <small>{ready?row!.label+" · "+row!.asOf:"Fresh comparable reading unavailable"}</small>
    <span className={s.open}>OPEN SOURCE-DATED DETAIL ↗</span>
  </Link>;
}
function FractionCard({name,scope,value,total,caption,date,href,available,metric}:{
  name:string;scope:string;value:number;total:number;caption:string;date:string|null;href:string;available:boolean;
  metric:"jobs"|"source";
}){
  const share=available&&total>0?Math.max(0,Math.min(100,Math.round(100*value/total))):0;
  const tone:LensSignalTone=!available||total<=0?"unknown":
    metric==="jobs"?(value*2>total?"improving":value*2<total?"pressure":"mixed"):
    value===total?"improving":value===0?"pressure":"mixed";
  const status=tone==="unknown"?"COVERAGE UNKNOWN":
    metric==="jobs"?(tone==="improving"?"MORE SECTORS GROWING":tone==="pressure"?"MORE SECTORS NOT GROWING":"EVENLY SPLIT"):
    tone==="improving"?"CHECKS COMPLETE":tone==="pressure"?"NO CHECKS HEALTHY":"PARTIAL COVERAGE";
  return <Link href={href} className={s.card} data-condition={name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}
    data-condition-status={available?"measured":"unavailable"} data-signal-tone={tone}
    aria-label={name+": "+status+". "+(date||"Source unavailable")}>
    <div className={s.cardTop}><span className={s.scope}>{scope}</span><strong className={s.toneTag}>{status}</strong></div>
    <h3>{name}</h3>
    <div className={s.fractionGraph} role="img"
      aria-label={available?value+" of "+total+" — "+share+" percent":name+": source unavailable"}>
      <span className={s.fractionValue}>{available?share+"%":"—"}</span>
      <div className={s.bar}><span style={{width:share+"%"}}/></div>
      <span className={s.fractionAxis}><span>0%</span><span>100%</span></span>
    </div>
    <div className={s.mainValue}>{available?value+" / "+total:"—"}</div>
    <p className={s.delta}>{available?caption:"Source verification incomplete"}</p>
    <small>{date??"Observation date unavailable"}</small>
    <span className={s.open}>EXPLORE THE EVIDENCE ↗</span>
  </Link>;
}
/** Visualise existing source-dated observations only. No synthetic market regime,
 * implied probability, social verification, scheduling or canonical writes. */
export default function MarketConditionsBoard({market,breadth,jobs,health,now,host}:Props){
  const go=(path:string)=>blueDeskPublicHref(path,host);
  const ai=findMarket(market,"AI / Semis",/^(SMH|SOXX)$/i);
  const energy=findMarket(market,"Energy",/brent|^BZ|^BRN/i);
  const treasury=findMarket(market,"Rates",/10[ -]?(year|yr|y)|DGS10/i);
  const freshBreadth=admissible(breadth,now)?breadth:null;
  const jobsReady=Boolean(jobs && jobs.status==="ready" && jobs.growing!==null &&
    jobs.shrinking!==null && jobs.sectorCount>0 && lastDate(jobs.releasedAt,now,65));
  const healthReady=Boolean(health && lastDate(health.checkedAt,now,1));
  return <section className={s.shell} data-bluebelly-condition-board="source-dated-v1"
    aria-labelledby="condition-board-heading">
    <header className={s.head}>
      <div><span className={s.eyebrow}>01 / MARKET CONDITIONS · VISUAL READINGS</span>
        <h2 id="condition-board-heading">See the signals. Then read the story.</h2></div>
      <Link href={go("/blue-desk/regime-watch")}>FULL REGIME WATCH ↗</Link>
    </header>
    <p className={s.intro}>Coloured cards show the direction or coverage of their named measurement. Green means an improving proxy, red means increasing pressure, amber means mixed/partial and grey means unmeasured. These are not full Regime verdicts or trade recommendations.</p>
    <div className={s.grid}>
      <TapeCard name="AI / SEMIS" scope="Sector price direction" row={ai} now={now} signalId="ai"
        href={go("/blue-desk/markets?group=ai")} left="Price falling" right="Price rising"/>
      <TapeCard name="CRUDE OIL" scope="Energy price direction" row={energy} now={now} signalId="energy"
        href={go("/blue-desk/hormuz")} left="Price falling" right="Price rising"/>
      <TapeCard name="US 10Y YIELD" scope="Yield pressure · bp" row={treasury} now={now} signalId="bonds"
        href={go("/blue-desk/regime-watch/bonds#bond-pressure")} left="Yield falling" right="Yield rising"/>
      <TapeCard name="S&P 500 BREADTH" scope="Stocks above 50D · 5-session change" row={freshBreadth} now={now} signalId="breadth"
        href={go("/blue-desk/markets?group=breadth")} changeWindow="5D"
        left="Participation falling" right="Participation rising"/>
      <FractionCard name="US JOBS BREADTH" scope="Growing sectors · latest BLS release" metric="jobs"
        value={jobsReady?jobs!.growing!:0} total={jobsReady?jobs!.sectorCount:0}
        available={jobsReady} date={jobsReady?jobs!.period+" · released "+jobs!.releasedAt:null}
        caption={jobsReady?jobs!.shrinking+" sectors contracting · net payroll "+(jobs!.headlineChangeK===null?"unavailable":sign(jobs!.headlineChangeK,"K")):""}
        href={go("/blue-desk/markets#jobs-monitor")}/>
      <FractionCard name="SOURCE HEALTH" scope="X Wire · complete fresh source checks" metric="source"
        value={healthReady?health!.healthy:0} total={healthReady?health!.monitored:0}
        available={healthReady} date={healthReady?"Checked "+health!.checkedAt.slice(0,16).replace("T"," ")+" UTC":null}
        caption={healthReady?health!.historicalGaps+" accounts with historical gaps":""}
        href="/owner/x-wire"/>
    </div>
    <footer className={s.foot}>Breadth uses the provider's 5-session percentage-point move, not a 1-day price change. Jobs breadth is a cross-section, not a monthly acceleration. Source coverage measures successful retrieval, not verification of X claims. Older reviews do not automatically refresh.</footer>
  </section>;
}
