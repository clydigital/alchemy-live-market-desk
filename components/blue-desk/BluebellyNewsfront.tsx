import Link from "next/link";
import type { NewsBriefV1 } from "@/lib/market-brief-news";
import type { PublicThesis } from "@/lib/blue-desk-thesis-ledger";
import {groupPublicResearch, editorialNewsTopics} from "@/lib/bluebelly-editorial-architecture";
import {editorialMotif} from "@/lib/bluebelly-editorial-visuals";
import EditorialStoryArt from "./EditorialStoryArt";
import DualTimestamp from "./DualTimestamp";
import styles from "./bluebelly-newsfront.module.css";

type CalendarCard = {id:string;title:string;sourceName:string;scheduledAt:string|null;localDate:string;sourceUrl:string};
const safe=(str:string)=>str.length>175?str.slice(0,172)+"…":str;

function StoryTile({item,primary}:{item:NewsBriefV1;primary?:boolean}){
 return <article className={primary?styles.primary:styles.tile} data-newsfront-verified={item.id}>
   <div className={styles.tileArt}>
      {primary?<div className={styles.whaleArt} aria-hidden="true"/>:
       <EditorialStoryArt headline={item.headline} summary={item.summary} compact/>}
   </div>
   <div className={styles.tileShade}/>
   <div className={styles.tileBody}>
     <span className={styles.chip}>{editorialNewsTopics(item)[0].toUpperCase()} · VERIFIED SOURCE</span>
     <h2><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.headline}</a></h2>
     {primary?<p>{safe(item.summary)}</p>:null}
     <span className={styles.meta}>{item.sourceName} · Event <DualTimestamp value={item.occurredAt}/></span>
   </div>
 </article>;
}

export default function BluebellyNewsfront({news,theses,upcoming,host}:{
 news:readonly NewsBriefV1[];theses:readonly PublicThesis[];upcoming:readonly CalendarCard[];host:string|null;
}){
 const lenses=groupPublicResearch(theses);
 const leading=news.slice(0,5);
 const rest=news.slice(5,12);
 const newsroom=host==="bluebelly-desk.vercel.app"||host==="alchemy-live-market-desk.vercel.app"?"/newsroom":"/blue-desk/newsroom";
 const regimes=host==="bluebelly-desk.vercel.app"||host==="alchemy-live-market-desk.vercel.app"?"/regime-watch":"/blue-desk/regime-watch";
 const calendar=host==="bluebelly-desk.vercel.app"||host==="alchemy-live-market-desk.vercel.app"?"/calendar":"/blue-desk/calendar";
 return <div className={styles.shell} data-editorial-front="mockup-rewired-real-sources">
   <div className={styles.breaking}>
     <strong>ORIGINAL-SOURCE UPDATE</strong>
     {news[0]?<a href={news[0].sourceUrl} target="_blank" rel="noopener noreferrer">{news[0].headline}</a>:<span>No recent development currently clears the verified-news gate.</span>}
     {news[0]?<small><DualTimestamp value={news[0].occurredAt}/></small>:null}
   </div>
   <header className={styles.intro}>
      <div><span className={styles.eyebrow}>THE BLUEBELLY DESK / TODAY</span>
      <h1>The stories driving the conversation.</h1>
      <p>News first, the financial consequences underneath, persistent research on the side.</p></div>
      <Link href="/daily-report" className={styles.dailyQuick}>ONE SELECTIVE DAILY REPORT</Link>
   </header>
   {leading.length?<div className={styles.heroGrid}>
     <StoryTile item={leading[0]} primary/>
     <div className={styles.miniGrid}>{leading.slice(1).map(item=><StoryTile key={item.id} item={item}/>)}
       {leading.length<5?Array.from({length:5-leading.length},(_,i)=><div className={styles.vacancy} key={i}>
         <span>VERIFIED COVERAGE</span><strong>Awaiting another qualified original-source update.</strong>
       </div>):null}
     </div>
   </div>:<div className={styles.newsEmpty}><strong>Source-qualified breaking coverage unavailable.</strong>
      <p>This is a coverage gap, not a claim that markets are quiet. Browse historical research or upcoming releases.</p>
   </div>}
   <div className={styles.columns}>
     <div className={styles.mainCol}>
       <div className={styles.sectionHeading}><div><h2>Latest News</h2>
         <p>Recent source-dated developments. Publication time is not an invented market reaction.</p></div>
         <Link href={newsroom}>Browse Newsroom →</Link></div>
       {rest.length?<div className={styles.feed}>{rest.map(item=><article className={styles.feedRow} key={item.id}>
         <div className={styles.thumb}><EditorialStoryArt headline={item.headline} summary={item.summary} compact/></div>
         <div><span className={styles.feedStatus}>SOURCE VERIFIED · {item.sourceName} · <DualTimestamp value={item.occurredAt}/></span>
           <h3><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.headline}</a></h3>
           <p>{safe(item.summary)}</p><Link href={newsroom}>Explore the Newsroom →</Link></div>
       </article>)}</div>:<div className={styles.emptySmall}>No additional source-verified updates in the 48-hour qualification window.</div>}
       <div className={styles.sectionHeading}><div><h2>From headlines to the regime</h2>
         <p>Public Story snapshots, grouped by research topic—not newly adjudicated regime verdicts.</p></div>
         <Link href={regimes}>All regime lenses →</Link></div>
       <div className={styles.teaserGrid}>{lenses.filter(l=>["fed","bonds","ai","energy"].includes(l.id)).map(lens=>
         <Link href={regimes+"#"+lens.id} className={styles.teaser} key={lens.id}>
           <span>{lens.code}</span><strong>{lens.name}</strong>
           <small>{lens.stories.length} public Story snapshot{lens.stories.length===1?"":"s"} · View question</small>
         </Link>)}</div>
     </div>
     <aside className={styles.rail}>
       <div className={styles.sidebox}><h3>Regime watch</h3><p>Ongoing questions, not new daily articles.</p>
         {lenses.slice(0,6).map(l=><Link key={l.id} className={styles.railLine} href={regimes+"#"+l.id}>
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
