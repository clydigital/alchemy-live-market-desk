import Link from "next/link";
import type { NewsBriefV1 } from "@/lib/market-brief-news";
import type { PublicThesis } from "@/lib/blue-desk-thesis-ledger";
import type {PublicSourceObservation} from "@/lib/blue-desk-source-observations-projector";
import {curateHomeSourceCoverage,type HomeSourceItem} from "@/lib/bluebelly-home-48h-coverage";
import {groupPublicResearch, editorialNewsTopics} from "@/lib/bluebelly-editorial-architecture";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import EditorialStoryArt from "./EditorialStoryArt";
import DualTimestamp from "./DualTimestamp";
import styles from "./bluebelly-newsfront.module.css";

type CalendarCard = {id:string;title:string;sourceName:string;scheduledAt:string|null;localDate:string;sourceUrl:string};
const safe=(str:string)=>str.length>175?str.slice(0,172)+"…":str;

function ageLabel(at:string,now:Date){
 return now.getTime()-Date.parse(at)>24*60*60*1000?"PRIOR 24H":"LAST 24H";
}
function itemText(item:HomeSourceItem){
 if(item.kind==="NEWS"){
  return {headline:item.news.headline,summary:item.news.summary,sourceName:item.news.sourceName,
    status:"VERIFIED ANNOUNCEMENT",observation:false};
 }
 const o=item.observation;
 const headline=o.kind==="MARKET_OBSERVATION"
  ?o.description.split(":")[0].slice(0,110):o.description.split(/[.;]/)[0].slice(0,110);
 return {headline:headline||o.description.slice(0,110),summary:o.description,sourceName:o.sourceName,
   status:o.kind==="MARKET_OBSERVATION"?"DATED MARKET DATA":"ORIGINAL SOURCE RELEASE",observation:true};
}
function StoryTile({item,primary,now,host}:{item:HomeSourceItem;primary?:boolean;now:Date;host:string|null}){
 const v=itemText(item);
 return <article className={primary?styles.primary:styles.tile}
    data-newsfront-verified={item.kind==="NEWS"?item.id:undefined}
    data-newsfront-observation={item.kind==="OBSERVATION"?item.id:undefined}>
   <div className={styles.tileArt}>
      <EditorialStoryArt headline={v.headline} summary={v.summary} compact/>
   </div>
   <div className={styles.tileShade}/>
   <div className={styles.tileBody}>
     <span className={v.observation?styles.dataChip:styles.chip}>
       {item.kind==="NEWS"?editorialNewsTopics(item.news)[0].toUpperCase()+" · ":null}
       {v.status} · {ageLabel(item.at,now)}
     </span>
     <h2>{item.kind==="NEWS"?
        <Link href={blueDeskPublicHref("/blue-desk/key-stories",host)+"?news="+encodeURIComponent(item.news.id)}>{v.headline}</Link>:
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{v.headline}</a>}</h2>
     {primary?<p>{safe(v.summary)}</p>:null}
     <span className={styles.meta}>{v.sourceName} · Source date <DualTimestamp value={item.at}/></span>
   </div>
 </article>;
}

export default function BluebellyNewsfront({news,observations,theses,upcoming,host,now}:{
 news:readonly NewsBriefV1[];observations:readonly PublicSourceObservation[];
 theses:readonly PublicThesis[];upcoming:readonly CalendarCard[];host:string|null;now:Date;
}){
 const lenses=groupPublicResearch(theses);
 const {lead,feed,newsCount,observationCount}=curateHomeSourceCoverage(news,observations,now);
 const latestVerified=lead.find(item=>item.kind==="NEWS");
 const latestNews=latestVerified?.kind==="NEWS"?latestVerified.news:null;
 const newsroom=host==="bluebelly-desk.vercel.app"||host==="alchemy-live-market-desk.vercel.app"?"/newsroom":"/blue-desk/newsroom";
 const regimes=host==="bluebelly-desk.vercel.app"||host==="alchemy-live-market-desk.vercel.app"?"/regime-watch":"/blue-desk/regime-watch";
 const calendar=host==="bluebelly-desk.vercel.app"||host==="alchemy-live-market-desk.vercel.app"?"/calendar":"/blue-desk/calendar";
 return <div className={styles.shell} data-editorial-front="mockup-rewired-real-sources">
   <div className={styles.breaking}>
     <strong>ORIGINAL-SOURCE UPDATE</strong>
     {latestNews?<Link href={blueDeskPublicHref("/blue-desk/key-stories",host)+"?news="+encodeURIComponent(latestNews.id)}>{latestNews.headline}</Link>:<span>No recent development currently clears the verified-news gate.</span>}
     {latestNews?<small><DualTimestamp value={latestNews.occurredAt}/></small>:null}
   </div>
   <header className={styles.intro}>
      <div><span className={styles.eyebrow}>THE BLUEBELLY DESK / TODAY</span>
      <h1>The stories driving the conversation.</h1>
      <p>Rolling 48-hour coverage, including the previous day. Verified announcements and dated market measurements carry separate labels.</p></div>
      <Link href={blueDeskPublicHref("/blue-desk/daily-report",host)} className={styles.dailyQuick}>ONE SELECTIVE DAILY REPORT</Link>
   </header>
   <p className={styles.coverageNote} data-home-window="rolling-48h">
   Last 48 hours · {newsCount} verified announcement{newsCount===1?"":"s"}
   {" · "}{observationCount} distinct dated source observation{observationCount===1?"":"s"}
   {" · "}Older items are not presented as new breaking news.
 </p>
 {lead.length?<div className={styles.heroGrid}>
   <StoryTile item={lead[0]} primary now={now} host={host}/>
   <div className={styles.miniGrid}>{lead.slice(1).map(item=><StoryTile key={item.kind+item.id} item={item} now={now} host={host}/>)}
     {lead.length<5?Array.from({length:5-lead.length},(_,i)=><div className={styles.vacancy} key={i}>
       <span>48-HOUR SOURCE COVERAGE</span><strong>Awaiting another independently qualified update.</strong>
     </div>):null}
   </div>
 </div>:<div className={styles.newsEmpty}><strong>Source-qualified coverage unavailable in the past 48 hours.</strong>
    <p>This is a source coverage gap, not a claim that markets were quiet. Browse previous research or the calendar.</p>
 </div>}
 <div className={styles.columns}>
     <div className={styles.mainCol}>
       <div className={styles.sectionHeading}><div><h2>More from the past 48 hours</h2>
     <p>Original-source announcements remain distinct from dated market observations. Source dates—not retrieval dates—determine the window.</p></div>
     <Link href={newsroom}>Browse Newsroom →</Link></div>
 {feed.length?<div className={styles.feed}>{feed.map(item=>{
   const v=itemText(item);
   return <article className={styles.feedRow} key={item.kind+item.id}
     data-feed-evidence-type={item.kind}>
    <div className={styles.thumb}><EditorialStoryArt headline={v.headline} summary={v.summary} compact/></div>
    <div><span className={styles.feedStatus}>{v.status} · {ageLabel(item.at,now)} · {v.sourceName} · <DualTimestamp value={item.at}/></span>
      <h3>{item.kind==="NEWS"?
        <Link href={blueDeskPublicHref("/blue-desk/key-stories",host)+"?news="+encodeURIComponent(item.news.id)}>{v.headline}</Link>:
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{v.headline}</a>}</h3>
      <p>{safe(v.summary)}</p>
      {item.kind==="NEWS"?<Link href={blueDeskPublicHref("/blue-desk/key-stories",host)+"?news="+encodeURIComponent(item.news.id)}>Read short Bluebelly recap →</Link>:
       <span className={styles.dataNote}>Source observation · not a verified causal explanation</span>}
    </div>
   </article>;
 })}</div>:<div className={styles.emptySmall}>No additional qualified updates in the rolling 48-hour window.</div>}
 <div className={styles.sectionHeading}><div><h2>From headlines to the regime</h2>
         <p>Public Story snapshots, grouped by research topic—not newly adjudicated regime verdicts.</p></div>
         <Link href={regimes}>All regime lenses →</Link></div>
       <div className={styles.teaserGrid}>{lenses.filter(l=>["fed","bonds","ai","energy"].includes(l.id)).map(lens=>
         <Link href={regimes+"/"+lens.id} className={styles.teaser} key={lens.id}>
           <span>{lens.code}</span><strong>{lens.name}</strong>
           <small>{lens.stories.length} public Story snapshot{lens.stories.length===1?"":"s"} · View question</small>
         </Link>)}</div>
     </div>
     <aside className={styles.rail}>
       <div className={styles.sidebox}><h3>Regime watch</h3><p>Ongoing questions, not new daily articles.</p>
         {lenses.slice(0,6).map(l=><Link key={l.id} className={styles.railLine} href={regimes+"/"+l.id}>
           <span><strong>{l.name}</strong><small>{l.stories.length} related public Stories</small></span><em>{l.code.split("/")[0]}</em>
         </Link>)}<Link className={styles.railAction} href={regimes}>Open regime board →</Link>
       </div>
       <div className={styles.sidebox}><h3>From X &amp; creators</h3>
         <p>Unverified social and video interpretations remain in authenticated owner research.</p>
         <Link className={styles.railAction} href="/owner/research">Open private research ↗</Link>
       </div>
       <div className={styles.sidebox}><h3>Next catalysts</h3>
         <p>Source-listed calendar events. Date-only entries are not given invented ET times.</p>
         {upcoming.slice(0,4).map(event=><div className={styles.railLine} key={event.id}>
           <span><strong>{event.title}</strong><small>{event.scheduledAt?<DualTimestamp value={event.scheduledAt}/>:event.localDate+" · date only"}</small></span>
           <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={"Source for "+event.title}>Source ↗</a>
         </div>)}<Link className={styles.railAction} href={calendar}>Full calendar →</Link>
       </div>
     </aside>
   </div>
 </div>;
}
