import "server-only";
import Link from "next/link";
import {getOwnerCreatorSignalDigest,CREATOR_DIGEST_URL} from "@/lib/bluebelly-creator-signals-server";
import {getPrivateReviewedCreatorArguments} from "@/lib/bluebelly-private-creator-reviews";
import {creatorMarketMatch,creatorSourceKey,orderCreatorSignals,type CreatorSignal,type CreatorTake} from "@/lib/bluebelly-creator-signals";
import type {PublicMarketObservation} from "@/lib/blue-desk-public-markets";
import {positioningRead,qqqReleaseClock,RESEARCH_SNAPSHOT,type ShortPosition} from "@/lib/bluebelly-qqq-positioning-core";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import styles from "./creator-intelligence.module.css";

const fmt=(n:number|null|undefined,unit="%"):string=>n==null||!Number.isFinite(n)?"—":`${n>0?"+":""}${n.toFixed(2)}${unit}`;
const bullets=(items:string[])=>items.length?<ul className={styles.bullets}>{items.map((item,i)=><li key={i}>{item}</li>)}</ul>:<p className={styles.muted}>Not discussed in the reviewed material.</p>;
function Positioning({rows,now,host}:{rows:ShortPosition[];now:Date;host:string|null}){
 const read=positioningRead(rows,now);const lead=read.latest&&read.latest.settlement>=RESEARCH_SNAPSHOT.settlement?read.latest:null;
 const settlement=lead?.settlement??RESEARCH_SNAPSHOT.settlement;
 const clock=qqqReleaseClock(settlement,now);
 const shares=lead?.shares??RESEARCH_SNAPSHOT.shares;
 const change=lead?read.change:(RESEARCH_SNAPSHOT.shares/RESEARCH_SNAPSHOT.previousShares-1)*100;
 return <tr><th scope="row">QQQ short interest</th><td>Positioning, not bias</td><td><ul className={styles.bullets}><li>{(shares/1e6).toFixed(2)}m shares short · {fmt(change)} vs previous settlement · {settlement}</li><li>{lead?"Exchange observation":"Attributed secondary snapshot; exchange not verified"} · {clock.state}{clock.nextRelease?` · next release ${clock.nextRelease} ET`:""}. A rebound does not establish covering.</li></ul><Link href={blueDeskPublicHref("/blue-desk/qqq-positioning",host)}>Positioning history and scenarios →</Link></td><td>Settlement data; not daily change</td></tr>;
}
function MarketCell({asset,market,now,session}:{asset:string;market:PublicMarketObservation[];now:Date;session:string|null}){
 const row=creatorMarketMatch(asset,market,now);if(!row)return <td className={styles.muted}>No exact, source-dated daily match.</td>;
 const spy=creatorMarketMatch("SPY",market,now);
 const spread=asset!=="SPY"&&row.changeUnit==="%"&&spy?.changeUnit==="%"&&row.session===spy.session&&row.change!==null&&spy.change!==null?row.change-spy.change:null;
 return <td className={styles.tape}><div>1D <strong>{fmt(row.change,row.changeUnit)}</strong></div><div>3D <strong>{fmt(row.change3d,row.changeUnit)}</strong></div><div>5D <strong>{fmt(row.change5d,row.changeUnit)}</strong></div>{spread!==null?<div>1D vs SPY {fmt(spread,"pp")}</div>:null}<small>{row.session} · {row.symbol}{!row.latestSession?" · delayed":""}{session&&row.session!==session?" · differs from digest session":""}<br/>{row.sourceUrl?<a href={row.sourceUrl}>{row.sourceName}</a>:row.sourceName}</small></td>;
}
function SignalTable({rows,creators,market,now,session,positioning}:{rows:CreatorSignal[];creators:CreatorTake[];market:PublicMarketObservation[];now:Date;session:string|null;positioning?:{rows:ShortPosition[];host:string|null}}){
 const names=new Map(creators.map(c=>[creatorSourceKey(c),c.publisher]));
 return <div className={styles.scroll}><table className={styles.table}><thead><tr><th scope="col">Views on asset</th><th scope="col">Bias</th><th scope="col">Signal · structure / levels</th><th scope="col">Day change</th></tr></thead><tbody>{orderCreatorSignals(rows).map((row,i)=><tr key={`${row.asset}-${i}`}><th scope="row">{row.asset}<small>{row.horizon}</small></th><td><span className={styles.bias} data-bias={row.bias}>{row.bias}</span></td><td>{bullets(row.signals)}{row.sources.length?<small className={styles.muted}>Source: {row.sources.map(s=>names.get(s)??s).join(" · ")}</small>:null}</td><MarketCell asset={row.asset} market={market} now={now} session={session}/></tr>)}{positioning?<Positioning rows={positioning.rows} now={now} host={positioning.host}/>:null}</tbody></table>{!rows.length?<p className={styles.muted}>No explicit asset direction recorded.</p>:null}</div>;
}
export default async function CreatorIntelligencePanel({rows,market,now,host}:{rows:ShortPosition[];market:PublicMarketObservation[];now:Date;host:string|null}){
 const read=await getOwnerCreatorSignalDigest(now);
 if(read.status==="unauthorised")return <section className={styles.panel} data-creator-intelligence="private-locked"><p className={styles.kicker}>PRIVATE RESEARCH</p><h2>Creator market intelligence</h2><p>Sign in to My Desk to access the transcript-based market overview and individual technical takes.</p><Link href="https://bluebelly-desk.vercel.app/my-reports">My Desk · sign in →</Link><div className={styles.scroll}><table className={styles.table}><tbody><Positioning rows={rows} now={now} host={host}/></tbody></table></div></section>;
 const digest=read.digest;
 // The fallback is only reached after the reader has passed its own owner gate.
 const fallback=!digest?await getPrivateReviewedCreatorArguments(now).catch(()=>[]):[];
 return <section className={styles.panel} data-creator-intelligence={digest?"owner-digest":"owner-fallback"} aria-label="Private creator market intelligence">
  <p className={styles.kicker}>OWNER RESEARCH · ATTRIBUTED CREATOR VIEWS</p><h2>Creator market intelligence</h2>
  {digest?<><p className={styles.muted}>Updated {digest.generatedAt.slice(0,16).replace("T"," ")} UTC · Market session {digest.marketSession??"unverified"}{+now-Date.parse(digest.generatedAt)>48*3600_000?" · older digest; recency caution":""}</p><p className={styles.coverage}>{digest.coverage}</p><h3>Overview</h3><p className={styles.headline}>{digest.overview.headline}</p>{bullets(digest.overview.news)}<SignalTable rows={digest.overview.signals} creators={digest.creators} market={market} now={now} session={digest.marketSession} positioning={{rows,host}}/><h4>Relative strength &amp; divergence</h4>{bullets(digest.overview.divergences)}<p className={styles.muted}>Day changes are independently sourced; same-session percentage-point spread is shown versus SPY when available. These are creator views, not verified price levels or canonical regime signals.</p><h3>Individual takes</h3>{digest.creators.map((c,i)=><details className={styles.creator} key={creatorSourceKey(c)} open={i===0}><summary><strong>{c.publisher}</strong><span>{c.sourceStatus==="reviewed"?"Production reviewed":c.sourceStatus==="handoff_reviewed"?"Private handoff reviewed":"User supplied"} · {c.publishedAt?c.publishedAt.slice(0,10):"Original publication date unverified"}</span></summary><p>{c.videoId?<a href={`https://www.youtube.com/watch?v=${c.videoId}`} target="_blank" rel="noreferrer">{c.title}</a>:c.title}</p><h4>Main news</h4>{bullets(c.news)}<SignalTable rows={c.views} creators={[]} market={market} now={now} session={digest.marketSession}/><div className={styles.takeGrid}><div><h4>Fundamental takes</h4>{bullets(c.fundamentals)}</div><div><h4>Interesting opinions</h4>{bullets(c.opinions)}</div></div><p><strong>Changed since prior review:</strong> {c.changed}</p></details>)}</>:<><h3>Overview unavailable</h3><p className={styles.coverage}>The current structured digest is not readable ({read.status}). No structural levels or directional bias inferred from incomplete data.</p><SignalTable rows={[]} creators={[]} market={market} now={now} session={null} positioning={{rows,host}}/><h3>Recent reviewed creator takes</h3>{fallback.length?fallback.map(c=><details className={styles.creator} key={c.videoId}><summary><strong>{c.publisher}</strong><span>{c.publishedAt.slice(0,10)}</span></summary><p><a href={c.url}>{c.title}</a></p><p>{c.summary}</p><p>{c.logic}</p>{bullets(c.claimChecks.map(k=>k.claim))}</details>):<p>No reviewed fallback available.</p>}</>}
  <p className={styles.muted}><a href={CREATOR_DIGEST_URL}>Private source digest and review handoff →</a> · Research inputs only; not a trade instruction.</p>
 </section>;
}
