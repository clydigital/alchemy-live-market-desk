import Link from "next/link";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import {buildMarketDivergenceWatch} from "@/lib/bluebelly-market-divergence-watch";
import type {PublicMarketObservation} from "@/lib/blue-desk-public-markets";
import {positioningRead,RESEARCH_SNAPSHOT,type ShortPosition} from "@/lib/bluebelly-qqq-positioning-core";
import {QQQ_SI_SOURCE} from "@/lib/bluebelly-qqq-positioning";
const fmt=(n:number|null|undefined)=>n==null?"—":n.toLocaleString("en-GB",{maximumFractionDigits:2});
const pct=(n:number|null|undefined)=>n==null?"—":(n>0?"+":"")+n.toFixed(2)+"%";
const card={border:"1px solid var(--bb-card-border)",background:"var(--bb-surface)",borderRadius:12,padding:18,margin:"16px 0"} as const;
export default function QqqPositioningPanel({rows,market,now,host,checkedAt,detail=false}:{
 rows:ShortPosition[];market:PublicMarketObservation[];now:Date;host:string|null;checkedAt:string;detail?:boolean;
}){
 const read=positioningRead(rows,now),match=buildMarketDivergenceWatch(market,"1D");
 const chips=match.find(x=>x.id==="semis-vs-nasdaq"),breadth=match.find(x=>x.id==="equal-vs-cap");
 const qqq=chips?.rightChange??null,smh=chips?.leftChange??null;
 const matched=chips?.sourceSession&&chips.sourceSession===breadth?.sourceSession;
 const lead=read.fresh?read.latest:null;
 const shown=lead?.settlement??RESEARCH_SNAPSHOT.settlement;
 const shares=lead?.shares??RESEARCH_SNAPSHOT.shares;
 const change=lead?read.change:(RESEARCH_SNAPSHOT.shares/RESEARCH_SNAPSHOT.previousShares-1)*100;
 const label=!lead?"ATTRIBUTED SNAPSHOT · LIVE SOURCE NOT VERIFIED":read.state;
 const tape=matched?qqq!==null&&smh!==null&&qqq>0&&smh>=qqq&&breadth!.leftChange!==null&&breadth!.leftChange>=0?"BROAD PARTICIPATION":qqq!==null&&smh!==null&&qqq<0&&smh<qqq&&breadth!.leftChange!==null&&breadth!.leftChange>0?"TECH ROTATION / NO COVERING CONFIRMATION":"MIXED TAPE":"INCOMPLETE MATCHED SESSIONS";
 return <section id="qqq-positioning" data-qqq-positioning={lead?"source-dated":"attributed-fallback"} aria-label="QQQ short-interest and reversal watch" style={card}>
  <div style={{fontSize:12,color:"var(--bb-muted)",letterSpacing:1}}>POSITIONING / NASDAQ-100 ETF · {label}</div>
  <h2 style={{fontSize:"clamp(20px,3vw,28px)",margin:"7px 0"}}>QQQ short-interest &amp; reversal watch</h2>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,margin:"12px 0"}}>
   <div><small>Shares short · {shown}</small><br/><strong style={{fontSize:25}}>{fmt(shares/1e6)}m</strong></div>
   <div><small>Change since prior settlement</small><br/><strong style={{fontSize:25}}>{pct(change)}</strong></div>
   <div><small>Days to cover</small><br/><strong style={{fontSize:25}}>{fmt(lead?lead.daysToCover:RESEARCH_SNAPSHOT.daysToCover)}</strong></div>
   <div><small>Latest matched QQQ session</small><br/><strong style={{fontSize:25}}>{pct(qqq)}</strong><br/><small>{chips?.sourceSession??"Unavailable"}</small></div>
  </div>
  <p><strong>{tape}</strong> · SMH {pct(smh)} · RSP {matched?pct(breadth!.leftChange):"—"} · SPY {matched?pct(breadth!.rightChange):"—"}.</p>
  <p style={{fontSize:13,color:"var(--bb-muted)"}}>Elevated open shorts can amplify a rally; they do not establish a bottom. QQQ is an ETF, not the Nasdaq-100 cash index. Short interest is a settlement snapshot, not daily short-sale volume. {lead?"Exchange source retrieved":"Exchange source attempted; last attributed secondary research retained"} {checkedAt.slice(0,16).replace("T"," ")} UTC.</p>
  {!detail?<Link href={blueDeskPublicHref("/blue-desk/qqq-positioning",host)} style={{color:"var(--bb-accent)",fontWeight:700}}>Open positioning evidence, scenarios and history →</Link>:<>
    <p><a href={QQQ_SI_SOURCE}>Nasdaq issue-level short-interest source</a> · <a href="https://www.nasdaqtrader.com/trader.aspx?id=ShortInterest">Release methodology and schedule</a></p>
    <h3>What would change the read?</h3>
    <ul><li>Potential squeeze: QQQ rallies over 1–3 closes; SMH participation improves and credit does not deteriorate. The next settlement must show declining open short interest before claiming observed reduction.</li><li>Rotation: RSP remains resilient while SMH keeps lagging QQQ; this is relative weakness, not broad panic.</li><li>Durable recovery: QQQ and SMH hold gains over 3–5 completed sessions, Nasdaq breadth expands, credit stabilises and issuer guidance supports demand.</li><li>Failed bounce: QQQ loses the rebound, semis underperform and credit widens. Crowded shorts may be justified.</li></ul>
    <h3>Settlement figures, not daily estimates</h3>
    <p>As of the 30 October settlement, two secondary sources reported the same share count but different float denominators ({RESEARCH_SNAPSHOT.floatRange}). This is not a current automated float percentage. An alleged historical 14% ceiling is unverified; no numerical squeeze threshold is used.</p>
    <p>{RESEARCH_SNAPSHOT.sources.map((s,i)=><span key={s.url}>{i?" · ":""}<a href={s.url}>{s.label}</a></span>)}</p>
    {lead?<div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left"}}><thead><tr><th>Settlement</th><th>Shares short (m)</th><th>Days to cover</th></tr></thead><tbody>{rows.map(r=><tr key={r.settlement}><td>{r.settlement}</td><td>{fmt(r.shares/1e6)}</td><td>{fmt(r.daysToCover)}</td></tr>)}</tbody></table><p>Available exchange history only; the 2022 bottom comparison needs a separately sourced consistent long-history series.</p></div>:<p>Exchange history not currently verified. No fabricated history, daily short-interest interpolation or zero substitution.</p>}
    <p><Link href={blueDeskPublicHref("/blue-desk/crash-opportunity",host)}>Crash vs Opportunity</Link> · <Link href={blueDeskPublicHref("/blue-desk/regime-watch/ai",host)}>AI regime</Link> · <Link href={blueDeskPublicHref("/blue-desk/markets",host)}>Markets and breadth</Link></p>
  </>}
 </section>;
}
