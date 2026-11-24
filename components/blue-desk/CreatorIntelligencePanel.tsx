import "server-only";
import Link from "next/link";
import {getOwnerCreatorSignalDigest,CREATOR_DIGEST_URL,type CreatorDigestRead} from "@/lib/bluebelly-creator-signals-server";
import {buildCreatorArgumentGroups,type ArgumentGroup,type ArgumentSource} from "@/lib/bluebelly-creator-argument-cards";
import {getPrivateReviewedCreatorArguments,type PrivateCreatorReview} from "@/lib/bluebelly-private-creator-reviews";
import {expectedHomeEtfSession} from "@/lib/bluebelly-home-etf-history";
import {creatorMarketMatch,creatorSignalGroup,creatorSourceKey,orderCreatorSignals,type CreatorSignal,type CreatorTake} from "@/lib/bluebelly-creator-signals";
import type {PublicMarketObservation} from "@/lib/blue-desk-public-markets";
import {positioningRead,qqqReleaseClock,RESEARCH_SNAPSHOT,type ShortPosition} from "@/lib/bluebelly-qqq-positioning-core";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import DualTimestamp from "./DualTimestamp";
import styles from "./creator-intelligence.module.css";

const fmt=(n:number|null|undefined,unit="%"):string=>n==null||!Number.isFinite(n)?"—":`${n>0?"+":""}${n.toFixed(2)}${unit}`;
const direction=(n:number|null|undefined)=>n==null?"missing":n>0?"up":n<0?"down":"flat";
const bullets=(items:string[])=>items.length?<ul className={styles.bullets}>{items.map((item,i)=><li key={i}>{item}</li>)}</ul>:<p className={styles.muted}>Not discussed in the reviewed material.</p>;
function SourceNotes({sources}:{sources:ArgumentSource[]}){
 if(!sources.length)return null;
 return <details className={styles.sourceNotes}><summary>Research notes · {sources.length} {sources.length===1?"source":"sources"}</summary>{sources.map(c=><div className={styles.sourceLine} key={c.key}><strong>{c.publisher}</strong><span>{c.publishedAt?.slice(0,10)??"Publication date unverified"} · {c.sourceStatus==="reviewed"?"Reviewed":c.sourceStatus==="handoff_reviewed"?"Handoff reviewed":"Supplied transcript"}</span>{c.videoId?<a href={`https://www.youtube.com/watch?v=${c.videoId}`} target="_blank" rel="noreferrer">{c.title} ↗</a>:<span>{c.title}</span>}</div>)}</details>;
}
function ArgumentGroupCards({group}:{group:ArgumentGroup}){
 const render=(card:ArgumentGroup["cards"][number],i:number)=><article className={styles.argumentCard} key={i}><span className={styles.argumentIndex}>{String(i+1).padStart(2,"0")}</span><div><p className={styles.argumentText}>{card.text}</p><SourceNotes sources={card.sources}/></div></article>;
 return <section className={styles.argumentSection} aria-label={group.title}><header className={styles.sectionHead}><h3>{group.title}</h3><span className={styles.sectionLabel}>{group.cards.length} research points</span></header><div className={styles.argumentGrid}>{group.cards.slice(0,4).map(render)}</div>{group.cards.length>4?<details className={styles.more}><summary>Read {group.cards.length-4} more research points</summary><div className={styles.argumentGrid}>{group.cards.slice(4).map((card,i)=>render(card,i+4))}</div></details>:null}</section>;
}
function Positioning({rows,now,host}:{rows:ShortPosition[];now:Date;host:string|null}){
 const read=positioningRead(rows,now);const lead=read.latest&&read.latest.settlement>=RESEARCH_SNAPSHOT.settlement?read.latest:null;
 const settlement=lead?.settlement??RESEARCH_SNAPSHOT.settlement;
 const clock=qqqReleaseClock(settlement,now);
 const shares=lead?.shares??RESEARCH_SNAPSHOT.shares;
 const change=lead?read.change:(RESEARCH_SNAPSHOT.shares/RESEARCH_SNAPSHOT.previousShares-1)*100;
 return <article className={styles.positionCard}><div><span className={styles.label}>Settlement positioning · not directional bias</span><h3>QQQ short interest</h3></div><div className={styles.positionStats}><div><strong>{(shares/1e6).toFixed(2)}m</strong><span>Shares short</span></div><div><strong data-direction={direction(change)}>{fmt(change)}</strong><span>vs previous settlement</span></div><div><strong>{settlement}</strong><span>Settlement date</span></div></div><p className={styles.muted}>{lead?"Exchange observation":"Attributed secondary snapshot; exchange not verified"} · {clock.state}{clock.nextRelease?` · next release ${clock.nextRelease} ET`:""}. A rebound does not establish covering.</p><Link href={blueDeskPublicHref("/blue-desk/qqq-positioning",host)}>Positioning history and scenarios ↗</Link></article>;
}
function MarketCell({asset,market,now,session}:{asset:string;market:PublicMarketObservation[];now:Date;session:string|null}){
 const row=creatorMarketMatch(asset,market,now);if(!row)return <p className={styles.muted}>No exact, source-dated market match.</p>;
 const spy=creatorMarketMatch("SPY",market,now);
 const spread=asset!=="SPY"&&row.changeUnit==="%"&&spy?.changeUnit==="%"&&row.session===spy.session&&row.change!==null&&spy.change!==null?row.change-spy.change:null;
 return <div className={styles.marketTape}><span className={styles.label}>Measured market moves</span><div className={styles.tapeTiles}>{([["1D",row.change],["3D",row.change3d],["5D",row.change5d]] as const).map(([label,value])=><div key={label}><span>{label}</span><strong data-direction={direction(value)}>{fmt(value,row.changeUnit)}</strong></div>)}</div>{spread!==null?<div className={styles.spread} data-direction={direction(spread)}>1D vs SPY {fmt(spread,"pp")}</div>:null}<small>{row.session} · {row.symbol}{!row.latestSession?" · delayed":""}{session&&row.session!==session?" · differs from digest session":""} · {row.sourceUrl?<a href={row.sourceUrl}>{row.sourceName}</a>:row.sourceName}</small></div>;
}
function SignalTable({rows,creators,market,now,session,positioning}:{rows:CreatorSignal[];creators:CreatorTake[];market:PublicMarketObservation[];now:Date;session:string|null;positioning?:{rows:ShortPosition[];host:string|null}}){
 const ordered=orderCreatorSignals(rows);
 const groups=ordered.reduce<{label:string;rows:CreatorSignal[]}[]>((acc,row)=>{const label=creatorSignalGroup(row.asset);if(acc.at(-1)?.label===label)acc.at(-1)!.rows.push(row);else acc.push({label,rows:[row]});return acc;},[]);
 if(!rows.length&&!positioning)return <p className={styles.muted}>No explicit asset direction recorded.</p>;
 const render=(row:CreatorSignal,i:number)=><article className={styles.assetCard} key={`${row.asset}-${i}`}><header><div><h4>{row.asset}</h4><small>{row.horizon}</small></div><span className={styles.bias} data-bias={row.bias}>{row.bias}</span></header><div className={styles.assetArguments}>{bullets(row.signals.slice(0,3))}{row.signals.length>3?<details className={styles.more}><summary>Read {row.signals.length-3} more observations</summary>{bullets(row.signals.slice(3))}</details>:null}</div><MarketCell asset={row.asset} market={market} now={now} session={session}/><SourceNotes sources={creators.filter(c=>row.sources.includes(creatorSourceKey(c))).map(c=>({key:creatorSourceKey(c),publisher:c.publisher,title:c.title,videoId:c.videoId,publishedAt:c.publishedAt,sourceStatus:c.sourceStatus}))}/></article>;
 return <div className={styles.signalGroups} aria-label="Market views by asset">{groups.map(group=><section className={styles.signalGroup} key={group.label}><h4 className={styles.groupLabel}>{group.label}</h4><div className={styles.assetGrid}>{group.rows.slice(0,6).map(render)}</div>{group.rows.length>6?<details className={styles.more}><summary>View {group.rows.length-6} more asset views</summary><div className={styles.assetGrid}>{group.rows.slice(6).map((row,i)=>render(row,i+6))}</div></details>:null}</section>)}{positioning?<Positioning rows={positioning.rows} now={now} host={positioning.host}/>:null}</div>;
}
function ReviewCards({reviews}:{reviews:PrivateCreatorReview[]}){
 return <div className={styles.argumentGrid}>{reviews.map(c=><article className={styles.reviewCard} key={c.videoId}><span className={styles.label}>New research · {c.publishedAt.slice(0,10)}</span><p className={styles.argumentText}>{c.summary||c.logic}</p>{c.summary&&c.logic?<details className={styles.more}><summary>Why this could happen</summary><p>{c.logic}</p></details>:null}{c.claimChecks.length?<details className={styles.more}><summary>What needs checking ({c.claimChecks.length})</summary>{bullets(c.claimChecks.map(k=>k.verificationTarget?k.claim+" — Check: "+k.verificationTarget:k.claim))}</details>:null}<SourceNotes sources={[{key:c.videoId,publisher:c.publisher,title:c.title,videoId:c.videoId,publishedAt:c.publishedAt,sourceStatus:"reviewed"}]}/></article>)}</div>;
}
export default async function CreatorIntelligencePanel({rows,market,now,host,readOverride}:{
 rows:ShortPosition[];market:PublicMarketObservation[];now:Date;host:string|null;
 readOverride?:CreatorDigestRead;
}){
 // Reuse the SAME owner-gated read used for the homepage radar; no second
 // private fetch, and no standalone public bypass.
 const read=readOverride??await getOwnerCreatorSignalDigest(now);
 if(read.status==="unauthorised")return <section className={styles.panel} data-creator-intelligence="private-locked" aria-label="Creator market intelligence"><header className={styles.heading}><div><p className={styles.kicker}>PRIVATE RESEARCH / CREATOR INTELLIGENCE</p><h2>What the market commentary is saying</h2></div></header><div className={styles.locked}><p>Sign in to My Desk to access the transcript-based market overview and individual technical takes.</p><Link href="https://bluebelly-desk.vercel.app/my-reports">My Desk · sign in ↗</Link></div><SignalTable rows={[]} creators={[]} market={market} now={now} session={null} positioning={{rows,host}}/></section>;
 const digest=read.digest;
 // This query is deliberately AFTER the owner gate. A digest may be one or
 // more video-review cycles behind: surface source-reviewed intake receipts
 // WITHOUT modifying its published claims or silently treating opinions as facts.
 const recentReviewed=await getPrivateReviewedCreatorArguments(now).catch(()=>[]);
 const digestVideoIds=new Set((digest?.creators??[]).map(c=>c.videoId).filter(Boolean));
 const notYetCompiled=digest?recentReviewed.filter(c=>!digestVideoIds.has(c.videoId)).slice(0,4):[];
 const fallback=digest?[]:recentReviewed;
 const lastCompletedSession=expectedHomeEtfSession(now);
 const sessionBehind=Boolean(digest?.marketSession&&lastCompletedSession&&digest.marketSession<lastCompletedSession);
 return <section className={styles.panel} data-creator-intelligence={digest?"owner-digest":"owner-fallback"} aria-label="Private creator market intelligence">
  <header className={styles.heading}><div><p className={styles.kicker}>CREATOR INTELLIGENCE / OWNER RESEARCH</p><h2>What the market commentary is saying</h2></div>{digest?<div className={styles.stamp}>Digest assembled <DualTimestamp value={digest.generatedAt}/><span>Market session {digest.marketSession??"unverified"}{sessionBehind?" · older than latest completed tape":""}{+now-Date.parse(digest.generatedAt)>48*3600_000?" · older digest; recency caution":""}</span></div>:null}</header>
  {digest?<><article className={styles.hero} data-creator-layout="argument-first"><span className={styles.kicker}>THE BIG PICTURE · ATTRIBUTED RESEARCH</span><h3>{digest.overview.headline}</h3><div className={styles.heroFoot}><span>{digest.overview.signals.length} asset views</span><span>{digest.creators.length} reviewed/supplied inputs</span><span>Market session {digest.marketSession??"unverified"}</span></div></article>
   <div className={styles.coverage}><strong>Research coverage</strong><span>{digest.coverage}</span></div>
   {buildCreatorArgumentGroups(digest).filter(g=>g.id==="news"||g.id==="divergences").map(group=><ArgumentGroupCards group={group} key={group.id}/>)}
   <header className={styles.sectionHead}><h3>What to watch in the markets</h3><span className={styles.sectionLabel}>Direction · levels · actual price moves</span></header>
   <SignalTable rows={digest.overview.signals} creators={digest.creators} market={market} now={now} session={digest.marketSession} positioning={{rows,host}}/>
   <p className={styles.muted}>Market moves are independently sourced. Commentary is attributed research, not verified price levels or canonical regime signals.</p>
   {buildCreatorArgumentGroups(digest).filter(g=>g.id!=="news"&&g.id!=="divergences").map(group=><ArgumentGroupCards group={group} key={group.id}/>)}
   {notYetCompiled.length?<section aria-label="New research awaiting synthesis" data-creator-uncompiled="source-reviewed"><header className={styles.sectionHead}><h3>New research awaiting synthesis</h3><span className={styles.sectionLabel}>Not yet reflected in the market overview</span></header><ReviewCards reviews={notYetCompiled}/></section>:null}
   <details className={styles.archive}><summary>Original video notes and full asset views · {digest.creators.length} inputs</summary>{digest.creators.map(c=><details className={styles.creator} key={creatorSourceKey(c)}><summary><strong className={styles.creatorName}>{c.title}</strong><span className={styles.creatorMeta}>{c.publisher} · {c.publishedAt?.slice(0,10)??"Date unverified"}</span></summary><div className={styles.creatorBody}><SourceNotes sources={[{key:creatorSourceKey(c),publisher:c.publisher,title:c.title,videoId:c.videoId,publishedAt:c.publishedAt,sourceStatus:c.sourceStatus}]}/><div><h4 className={styles.label}>Developments</h4>{bullets(c.news)}</div><SignalTable rows={c.views} creators={[c]} market={market} now={now} session={digest.marketSession}/><div><h4 className={styles.label}>Economic and business arguments</h4>{bullets(c.fundamentals)}</div><div><h4 className={styles.label}>Possible scenarios</h4>{bullets(c.opinions)}</div><div className={styles.changed}><strong className={styles.label}>What changed</strong><span>{c.changed}</span></div></div></details>)}</details>
  </>:<><div className={styles.coverage}><strong>Overview unavailable</strong><span>The current structured digest is not readable ({read.status}). No structural levels or directional bias inferred from incomplete data.</span></div><header className={styles.sectionHead}><h3>Recent research</h3></header>{fallback.length?<ReviewCards reviews={fallback}/>:<p>No reviewed fallback available.</p>}<SignalTable rows={[]} creators={[]} market={market} now={now} session={null} positioning={{rows,host}}/></>}

  <footer className={styles.footer}><strong className={styles.label}>Research only</strong><p>Attributed research inputs; not a trade instruction.</p><a href={CREATOR_DIGEST_URL}>Private source digest and review handoff ↗</a></footer>
 </section>;
}
