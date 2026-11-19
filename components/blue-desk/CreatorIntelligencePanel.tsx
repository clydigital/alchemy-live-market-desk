import "server-only";
import {Fragment} from "react";
import Link from "next/link";
import {getOwnerCreatorSignalDigest,CREATOR_DIGEST_URL} from "@/lib/bluebelly-creator-signals-server";
import {getPrivateReviewedCreatorArguments} from "@/lib/bluebelly-private-creator-reviews";
import {creatorMarketMatch,creatorSignalGroup,creatorSourceKey,orderCreatorSignals,type CreatorSignal,type CreatorTake} from "@/lib/bluebelly-creator-signals";
import type {PublicMarketObservation} from "@/lib/blue-desk-public-markets";
import {positioningRead,qqqReleaseClock,RESEARCH_SNAPSHOT,type ShortPosition} from "@/lib/bluebelly-qqq-positioning-core";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import DualTimestamp from "./DualTimestamp";
import styles from "./creator-intelligence.module.css";

const fmt=(n:number|null|undefined,unit="%"):string=>n==null||!Number.isFinite(n)?"—":`${n>0?"+":""}${n.toFixed(2)}${unit}`;
const direction=(n:number|null|undefined)=>n==null?"missing":n>0?"up":n<0?"down":"flat";
const bullets=(items:string[])=>items.length?<ul className={styles.bullets}>{items.map((item,i)=><li key={i}>{item}</li>)}</ul>:<p className={styles.muted}>Not discussed in the reviewed material.</p>;
function Positioning({rows,now,host}:{rows:ShortPosition[];now:Date;host:string|null}){
 const read=positioningRead(rows,now);const lead=read.latest&&read.latest.settlement>=RESEARCH_SNAPSHOT.settlement?read.latest:null;
 const settlement=lead?.settlement??RESEARCH_SNAPSHOT.settlement;
 const clock=qqqReleaseClock(settlement,now);
 const shares=lead?.shares??RESEARCH_SNAPSHOT.shares;
 const change=lead?read.change:(RESEARCH_SNAPSHOT.shares/RESEARCH_SNAPSHOT.previousShares-1)*100;
 return <tr className={styles.positionRow}><th scope="row">QQQ short interest<small>Settlement positioning</small></th><td><span className={styles.bias} data-bias="Positioning">Positioning</span><small>Not a directional bias</small></td><td><ul className={styles.bullets}><li>{(shares/1e6).toFixed(2)}m shares short · {fmt(change)} vs previous settlement · {settlement}</li><li>{lead?"Exchange observation":"Attributed secondary snapshot; exchange not verified"} · {clock.state}{clock.nextRelease?` · next release ${clock.nextRelease} ET`:""}. A rebound does not establish covering.</li></ul><Link href={blueDeskPublicHref("/blue-desk/qqq-positioning",host)}>Positioning history and scenarios ↗</Link></td><td>Settlement data; not daily change</td></tr>;
}
function MarketCell({asset,market,now,session}:{asset:string;market:PublicMarketObservation[];now:Date;session:string|null}){
 const row=creatorMarketMatch(asset,market,now);if(!row)return <td className={styles.muted}>No exact, source-dated daily match.</td>;
 const spy=creatorMarketMatch("SPY",market,now);
 const spread=asset!=="SPY"&&row.changeUnit==="%"&&spy?.changeUnit==="%"&&row.session===spy.session&&row.change!==null&&spy.change!==null?row.change-spy.change:null;
 return <td className={styles.tape}><div className={styles.tapeGrid}>{([["1D",row.change],["3D",row.change3d],["5D",row.change5d]] as const).map(([label,value])=><Fragment key={label}><span>{label}</span><strong data-direction={direction(value)}>{fmt(value,row.changeUnit)}</strong></Fragment>)}</div>{spread!==null?<div className={styles.spread} data-direction={direction(spread)}>1D vs SPY {fmt(spread,"pp")}</div>:null}<small>{row.session} · {row.symbol}{!row.latestSession?" · delayed":""}{session&&row.session!==session?" · differs from digest session":""}<br/>{row.sourceUrl?<a href={row.sourceUrl}>{row.sourceName}</a>:row.sourceName}</small></td>;
}
function SignalTable({rows,creators,market,now,session,positioning}:{rows:CreatorSignal[];creators:CreatorTake[];market:PublicMarketObservation[];now:Date;session:string|null;positioning?:{rows:ShortPosition[];host:string|null}}){
 const names=new Map(creators.map(c=>[creatorSourceKey(c),c.publisher]));
 const ordered=orderCreatorSignals(rows);
 const groups=ordered.reduce<{label:string;rows:CreatorSignal[]}[]>((acc,row)=>{const label=creatorSignalGroup(row.asset);if(acc.at(-1)?.label===label)acc.at(-1)!.rows.push(row);else acc.push({label,rows:[row]});return acc;},[]);
 if(!rows.length&&!positioning)return <p className={styles.muted}>No explicit asset direction recorded.</p>;
 return <div className={styles.scroll} role="region" aria-label="Creator signal comparison table" tabIndex={0}><table className={styles.table}><thead><tr><th scope="col">Views on asset</th><th scope="col">Bias</th><th scope="col">Signal · structure / levels</th><th scope="col">Day change</th></tr></thead>{groups.map(group=><tbody key={group.label}><tr className={styles.groupRow}><th scope="rowgroup" colSpan={4}><span className={styles.groupLabel}>{group.label}</span></th></tr>{group.rows.map((row,i)=><tr key={`${row.asset}-${i}`}><th scope="row">{row.asset}<small>{row.horizon}</small></th><td><span className={styles.bias} data-bias={row.bias}>{row.bias}</span></td><td>{bullets(row.signals)}{row.sources.length?<small className={styles.muted}>Source: {row.sources.map(s=>names.get(s)??s).join(" · ")}</small>:null}</td><MarketCell asset={row.asset} market={market} now={now} session={session}/></tr>)}</tbody>)}{positioning?<tbody><tr className={styles.groupRow}><th scope="rowgroup" colSpan={4}><span className={styles.groupLabel}>Longer-term positioning</span></th></tr><Positioning rows={positioning.rows} now={now} host={positioning.host}/></tbody>:null}</table></div>;
}
export default async function CreatorIntelligencePanel({rows,market,now,host}:{rows:ShortPosition[];market:PublicMarketObservation[];now:Date;host:string|null}){
 const read=await getOwnerCreatorSignalDigest(now);
 if(read.status==="unauthorised")return <section className={styles.panel} data-creator-intelligence="private-locked" aria-label="Creator market intelligence"><header className={styles.heading}><div><p className={styles.kicker}>PRIVATE RESEARCH / CREATOR INTELLIGENCE</p><h2>What are the creators watching?</h2></div></header><div className={styles.locked}><p>Sign in to My Desk to access the transcript-based market overview and individual technical takes.</p><Link href="https://bluebelly-desk.vercel.app/my-reports">My Desk · sign in ↗</Link></div><SignalTable rows={[]} creators={[]} market={market} now={now} session={null} positioning={{rows,host}}/></section>;
 const digest=read.digest;
 // The fallback is only reached after the reader has passed its own owner gate.
 const fallback=!digest?await getPrivateReviewedCreatorArguments(now).catch(()=>[]):[];
 return <section className={styles.panel} data-creator-intelligence={digest?"owner-digest":"owner-fallback"} aria-label="Private creator market intelligence">
  <header className={styles.heading}><div><p className={styles.kicker}>CREATOR INTELLIGENCE / OWNER RESEARCH</p><h2>What are the creators watching?</h2></div>{digest?<div className={styles.stamp}>Digest updated <DualTimestamp value={digest.generatedAt}/><span>Market session {digest.marketSession??"unverified"}{+now-Date.parse(digest.generatedAt)>48*3600_000?" · older digest; recency caution":""}</span></div>:null}</header>
  {digest?<>
   <div className={styles.overviewGrid} aria-label="Consolidated overview">
    <article className={`${styles.overviewCell} ${styles.overviewLead}`}><span className={styles.label}>01 / Consolidated market view</span><h3 className={styles.headline}>{digest.overview.headline}</h3><p className={styles.overviewCounts}>{digest.creators.length} creator takes · {digest.overview.signals.length} consolidated signal rows</p></article>
    <article className={styles.overviewCell}><span className={styles.label}>02 / Main news</span>{bullets(digest.overview.news)}</article>
    <article className={styles.overviewCell}><span className={styles.label}>03 / Relative strength &amp; divergence</span>{bullets(digest.overview.divergences)}</article>
   </div>
   <div className={styles.coverage}><strong>Source coverage</strong><span>{digest.coverage}</span></div>
   <header className={styles.sectionHead}><h3>Structural signals &amp; market tape</h3><span className={styles.sectionLabel}>Indices / XLs / Tech / Other</span></header>
   <SignalTable rows={digest.overview.signals} creators={digest.creators} market={market} now={now} session={digest.marketSession} positioning={{rows,host}}/>
   <p className={styles.muted}>Day changes are independently sourced; same-session percentage-point spread is shown versus SPY when available. These are creator views, not verified price levels or canonical regime signals.</p>
   <header className={styles.sectionHead}><h3>Individual takes</h3><span className={styles.sectionLabel}>Expand a creator to review</span></header>
   {digest.creators.map((c,i)=><details className={styles.creator} key={creatorSourceKey(c)} open={i===0}><summary><strong className={styles.creatorName}>{c.publisher}</strong><span className={styles.creatorMeta}>{c.sourceStatus==="reviewed"?"Production reviewed":c.sourceStatus==="handoff_reviewed"?"Private handoff reviewed":"User supplied"} · {c.publishedAt?c.publishedAt.slice(0,10):"Original publication date unverified"}</span></summary><div className={styles.creatorBody}><p>{c.videoId?<a href={`https://www.youtube.com/watch?v=${c.videoId}`} target="_blank" rel="noreferrer">{c.title} ↗</a>:c.title}</p><div><h4 className={styles.label}>Main news</h4>{bullets(c.news)}</div><SignalTable rows={c.views} creators={[]} market={market} now={now} session={digest.marketSession}/><div className={styles.takeGrid}><div><h4 className={styles.label}>Fundamental takes</h4>{bullets(c.fundamentals)}</div><div><h4 className={styles.label}>Interesting opinions</h4>{bullets(c.opinions)}</div></div><div className={styles.changed}><strong className={styles.label}>Changed since prior review</strong><span>{c.changed}</span></div></div></details>)}
  </>:<><div className={styles.coverage}><strong>Overview unavailable</strong><span>The current structured digest is not readable ({read.status}). No structural levels or directional bias inferred from incomplete data.</span></div><SignalTable rows={[]} creators={[]} market={market} now={now} session={null} positioning={{rows,host}}/><header className={styles.sectionHead}><h3>Recent reviewed creator takes</h3></header>{fallback.length?fallback.map(c=><details className={styles.creator} key={c.videoId}><summary><strong className={styles.creatorName}>{c.publisher}</strong><span className={styles.creatorMeta}>{c.publishedAt.slice(0,10)}</span></summary><div className={styles.creatorBody}><p><a href={c.url}>{c.title} ↗</a></p><p>{c.summary}</p><p>{c.logic}</p>{bullets(c.claimChecks.map(k=>k.claim))}</div></details>):<p>No reviewed fallback available.</p>}</>}
  <footer className={styles.footer}><strong className={styles.label}>Research only</strong><p>Attributed research inputs; not a trade instruction.</p><a href={CREATOR_DIGEST_URL}>Private source digest and review handoff ↗</a></footer>
 </section>;
}
