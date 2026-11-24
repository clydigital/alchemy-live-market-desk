import "server-only";
import Link from "next/link";
import {getOwnerCreatorSignalDigest,CREATOR_DIGEST_URL,type CreatorDigestRead} from "@/lib/bluebelly-creator-signals-server";
import {groupCreatorTakes,uniqueResearchPoints,type ArgumentSource} from "@/lib/bluebelly-creator-argument-cards";
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
function ResearchPoints({items,limit=5}:{items:string[];limit?:number}){
 // Operational receipts remain in the original digest and coverage details, not the reading view.
 const points=uniqueResearchPoints(items).filter(item=>!(/^Production now marks\b/i.test(item)&&/receipts|transcripts|provider call/i.test(item))&&!/^(?:Transcript retrieval|Ingestion status|Provider call|Receipt status|Cache hit)\s*:/i.test(item));
 if(!points.length)return null;
 return <div className={styles.researchPoints}>{bullets(points.slice(0,limit))}{points.length>limit?<details className={styles.more}><summary>Continue reading · {points.length-limit} more points</summary>{bullets(points.slice(limit))}</details>:null}</div>;
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
 const groups=new Map<string,PrivateCreatorReview[]>();
 for(const c of reviews){const group=groups.get(c.publisher)??[];group.push(c);groups.set(c.publisher,group);}
 return <div className={styles.creatorStack}>{[...groups].map(([publisher,videos])=><article className={styles.editorialCreator} key={publisher}><header className={styles.creatorHeading}><h3>{publisher}</h3><small>New research · not yet synthesised</small></header>{videos.map(c=><div className={styles.edition} key={c.videoId}><h4><a href={c.url} target="_blank" rel="noreferrer">{c.title} ↗</a></h4><small className={styles.muted}>{c.publishedAt.slice(0,10)} · reviewed transcript</small><p className={styles.editorialLead}>{c.summary||c.logic}</p>{c.summary&&c.logic?<p className={styles.editorialText}>{c.logic}</p>:null}{c.claimChecks.length?<details className={styles.more}><summary>Research checks · {c.claimChecks.length}</summary>{bullets(c.claimChecks.map(k=>k.verificationTarget?k.claim+" — Check: "+k.verificationTarget:k.claim))}</details>:null}</div>)}</article>)}</div>;
}
function CreatorGauges({takes}:{takes:CreatorTake[]}){
 const groups=[{label:"Broad equities",assets:/^(SPX|SPY|NDX|QQQ|IWM|RUT|DJI|DIA|RSP)$/i},{label:"US dollar",assets:/^(DXY|USD)$/i},{label:"Treasury yields",assets:/^(US0?2Y|US10Y|US30Y|2Y|10Y|30Y)$/i},{label:"Technology",assets:/^(SMH|SOXX|NVDA|AMD|MSFT|META|GOOGL|AMZN)$/i}];
 return <section aria-label="Creator sentiment" className={styles.sentimentSection}><div className={styles.sentimentGrid}>{groups.map(g=>{
 const votes=new Map<string,Set<string>>();
 for(const t of takes)for(const v of t.views)if(g.assets.test(v.asset.trim())){const set=votes.get(t.publisher)??new Set<string>();set.add(v.bias);votes.set(t.publisher,set);}
 const counts={Bullish:0,Bearish:0,Neutral:0};for(const set of votes.values()){if(set.size===1&&set.has("Bullish"))counts.Bullish++;else if(set.size===1&&set.has("Bearish"))counts.Bearish++;else counts.Neutral++;}
 const n=votes.size;
 const view=!n?"No clear view":counts.Bullish>counts.Bearish?"Leaning bullish":counts.Bearish>counts.Bullish?"Leaning bearish":"Mixed";
 return <article className={styles.sentimentCard} key={g.label}>
 <div className={styles.sentimentTop}><h4>{g.label}</h4><small>{n} {n===1?"creator":"creators"}</small></div>
 <strong className={styles.sentimentView} data-view={view}>{view}</strong>
 <div className={styles.sentimentBar} role="img" aria-label={n?counts.Bearish+" bearish, "+counts.Neutral+" mixed, "+counts.Bullish+" bullish":"No explicit views"}>
 {n?([["bear",counts.Bearish],["mixed",counts.Neutral],["bull",counts.Bullish]] as const).filter(([,count])=>count>0).map(([kind,count])=><span key={kind} data-kind={kind} style={{flexGrow:count}}/>):<span data-kind="empty" style={{flexGrow:1}}/>}</div>
 {n?<div className={styles.sentimentLegend}><span data-kind="bear">{counts.Bearish} Bearish</span><span data-kind="mixed">{counts.Neutral} Mixed</span><span data-kind="bull">{counts.Bullish} Bullish</span></div>:<small className={styles.muted}>No explicit directional call</small>}
 </article>;
 })}</div><p className={styles.sentimentFoot}>Creator views, not market probabilities. Mixed includes conflicting or neutral calls.</p></section>;
}

function CreatorSections({takes,market,now,session}:{takes:CreatorTake[];market:PublicMarketObservation[];now:Date;session:string|null}){
 return <div className={styles.creatorStack} data-creator-editorial="separate-publishers">{groupCreatorTakes(takes).map(group=><article className={styles.editorialCreator} key={group.publisher}><details><summary className={styles.creatorHeading}><strong>{group.publisher}</strong><small>{group.takes.length===1?"Market notes":group.takes.length+" reviewed inputs"}</small></summary>{group.takes.map(c=><section className={styles.edition} key={creatorSourceKey(c)}><h4>{c.videoId?<a href={`https://www.youtube.com/watch?v=${c.videoId}`} target="_blank" rel="noreferrer">{c.title} ↗</a>:c.title}</h4><small className={styles.muted}>{c.publishedAt?.slice(0,10)??"Original date unverified"} · {c.sourceStatus==="reviewed"?"Reviewed transcript":c.sourceStatus==="handoff_reviewed"?"Handoff reviewed":"Supplied transcript"}</small><ResearchPoints items={[...c.news,...c.fundamentals,...c.opinions]} limit={5}/>{c.changed?<div className={styles.changeNote}><strong>Since the previous review</strong><p>{c.changed}</p></div>:null}{c.views.length?<details className={styles.assetDisclosure}><summary>Market and asset views · {c.views.length}</summary><SignalTable rows={c.views} creators={[]} market={market} now={now} session={session}/></details>:null}</section>)}</details></article>)}</div>;
}
export default async function CreatorIntelligencePanel({rows,market,now,host,readOverride}:{
 rows:ShortPosition[];market:PublicMarketObservation[];now:Date;host:string|null;
 readOverride?:CreatorDigestRead;
}){
 // Reuse the SAME owner-gated read used for the homepage radar; no second
 // private fetch, and no standalone public bypass.
 const read=readOverride??await getOwnerCreatorSignalDigest(now);
 if(read.status==="unauthorised")return <section className={styles.panel} data-creator-intelligence="private-locked" aria-label="Creator market intelligence"><header className={styles.heading}><div><p className={styles.kicker}>PRIVATE RESEARCH / CREATOR INTELLIGENCE</p><h2>Creator Intelligence</h2></div></header><div className={styles.locked}><p>Sign in to My Desk to access the transcript-based market overview and individual technical takes.</p><Link href="https://bluebelly-desk.vercel.app/my-reports">My Desk · sign in ↗</Link></div><SignalTable rows={[]} creators={[]} market={market} now={now} session={null} positioning={{rows,host}}/></section>;
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
  <header className={styles.heading}><div><p className={styles.kicker}>CREATOR INTELLIGENCE / OWNER RESEARCH</p><h2>Creator Intelligence</h2></div>{digest?<div className={styles.stamp}>Updated <DualTimestamp value={digest.generatedAt}/><span>Market session {digest.marketSession??"unverified"}{sessionBehind?" · older than latest completed tape":""}{+now-Date.parse(digest.generatedAt)>48*3600_000?" · older digest; recency caution":""}</span></div>:null}</header>
  {digest?<><CreatorGauges takes={digest.creators}/><section className={styles.editorialOverview} data-creator-layout="overview-and-creators" aria-label="Consolidated market overview"><header className={styles.overviewHeader}><span className={styles.kicker}>THE MARKET PICTURE</span><h3>{digest.overview.headline}</h3><div className={styles.heroFoot}><span>Market session {digest.marketSession??"unverified"}</span><span>{new Set(digest.creators.map(c=>c.publisher)).size} creators covered</span></div></header><div className={styles.briefGrid}><div className={styles.briefBlock}><h4>What matters now</h4><ResearchPoints items={digest.overview.news} limit={4}/></div>{digest.overview.divergences.length?<div className={styles.briefBlock}><h4>Where views diverge</h4><ResearchPoints items={digest.overview.divergences} limit={3}/></div>:null}</div><details className={styles.coverageNote}><summary>Research coverage and timing</summary><p>{digest.coverage}</p></details><details className={styles.assetDisclosure}><summary>Consolidated asset views &amp; market moves · {digest.overview.signals.length}</summary><SignalTable rows={digest.overview.signals} creators={digest.creators} market={market} now={now} session={digest.marketSession}/><p className={styles.muted}>Market moves are independently sourced. Commentary remains attributed research, not verified price levels or canonical regime signals.</p></details></section>
   <header className={styles.sectionHead}><h3>Creator market notes</h3><span className={styles.sectionLabel}>Individual perspectives</span></header>
   <CreatorSections takes={digest.creators} market={market} now={now} session={digest.marketSession}/>
   {notYetCompiled.length?<section aria-label="New research awaiting synthesis" data-creator-uncompiled="source-reviewed"><header className={styles.sectionHead}><h3>Latest additions</h3><span className={styles.sectionLabel}>Not yet reflected in the overview</span></header><ReviewCards reviews={notYetCompiled}/></section>:null}
   <Positioning rows={rows} now={now} host={host}/>
  </>:<><div className={styles.coverage}><strong>Overview unavailable</strong><span>The current structured digest is not readable ({read.status}). No structural levels or directional bias inferred from incomplete data.</span></div><header className={styles.sectionHead}><h3>Recent creator market notes</h3></header>{fallback.length?<ReviewCards reviews={fallback}/>:<p>No reviewed fallback available.</p>}<Positioning rows={rows} now={now} host={host}/></>}

  <footer className={styles.footer}><strong className={styles.label}>Research only</strong><p>Attributed research inputs; not a trade instruction.</p><a href={CREATOR_DIGEST_URL}>Private source digest and review handoff ↗</a></footer>
 </section>;
}
