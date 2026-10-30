"use client";
import {useState} from "react";
import type {ReactNode} from "react";
import Link from "next/link";
import type {NewsBriefV1} from "@/lib/market-brief-news";
import {publicArchiveSearchIndex,type ArchiveNewsItem} from "@/lib/bluebelly-publication-archive";
import {EDITORIAL_TOPICS,editorialNewsTopics,type EditorialTopicId} from "@/lib/bluebelly-editorial-architecture";
import {storyTvInstrument} from "@/lib/bluebelly-editorial-visuals";
import EditorialStoryArt from "./EditorialStoryArt";
import TradingViewChart from "./TradingViewChart";
import styles from "./bluebelly-newswire.module.css";
function clock(value:string){
 const d=new Date(value);
 return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("en-GB",{timeZone:"America/New_York",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZoneName:"short"}).format(d):"Time unavailable";
}
function archiveTopics(item:ArchiveNewsItem):EditorialTopicId[]{
 const categories=new Set<EditorialTopicId>();
 if(item.eventType==="POLICY_DECISION"||item.eventType==="ECONOMIC_RELEASE")categories.add("policy");
 if(item.eventType==="EARNINGS"||item.topics.includes("EQUITIES"))categories.add("earnings");
 if(item.topics.includes("AI_TECHNOLOGY"))categories.add("ai");
 if(item.topics.includes("RATES_BONDS")||item.topics.includes("CREDIT_FINANCING"))categories.add("bonds");
 if(item.topics.includes("ENERGY"))categories.add("energy");
 if(item.topics.includes("FX")||item.topics.includes("METALS"))categories.add("fx");
 return categories.size?[...categories]:["other"];
}
export default function BluebellyNewsWire({news,archiveEntries=[],archiveAvailable=true,initialQuery="",now,readerHref,children}:{
 news:readonly NewsBriefV1[];archiveEntries?:readonly ArchiveNewsItem[];archiveAvailable?:boolean;
 initialQuery?:string;now:string;readerHref:string;children?:ReactNode;
}){
 const [topic,setTopic]=useState<EditorialTopicId>("all");
 const [query,setQuery]=useState(initialQuery.slice(0,100));
 const [shortlist,setShortlist]=useState<string[]>([]);
 const [feedback,setFeedback]=useState("");
 const newsOnly=news.filter(n=>!archiveEntries.some(a=>a.sourceUrl===n.sourceUrl));
 const visible=newsOnly.filter(item=>(topic==="all"||editorialNewsTopics(item).includes(topic))&&
  (item.headline+" "+item.summary+" "+item.sourceName).toLowerCase().includes(query.trim().toLowerCase()));
 const archiveVisible=archiveEntries.filter(item=>(topic==="all"||archiveTopics(item).includes(topic))&&
  publicArchiveSearchIndex(item).includes(query.trim().toLowerCase()));
 const selected=shortlist.flatMap(id=>newsOnly.find(n=>n.id===id)||[]);
 const visibleCount=visible.length+archiveVisible.length;
 function copy(){
  const content=selected.map((n,i)=>String(i+1)+". "+n.headline+"\nSource: "+n.sourceName+"\nOriginal: "+n.sourceUrl+
    "\nEvent (ET): "+clock(n.occurredAt)+"\nWhat was reported: "+n.summary).join("\n\n");
  if(!content){setFeedback("Select source-qualified reports first.");return;}
  if(!navigator.clipboard?.writeText){setFeedback("Clipboard unavailable; use the original source links.");return;}
  void navigator.clipboard.writeText("BLUEBELLY / WORKING EDITORIAL SHORTLIST — NOT A PUBLISHED REPORT\n\n"+content)
   .then(()=>setFeedback("Source-linked working outline copied."))
   .catch(()=>setFeedback("Could not copy to the clipboard."));
 }
 return <div className={styles.shell} data-editorial-newsroom="verified-only">
  <header className={styles.intro}><span>NEWSROOM / CATEGORISED WIRE</span>
   <h1>Every headline has a place.</h1>
   <p>Central banks, AI, bonds, energy, FX and earnings. Read a short in-house explanation first, then consult the dated original. Older verified reports retain their event dates.</p>
  </header>
  {children}
  <div className={styles.sectionTitle}><div><h2>Browse by category</h2><p>Publication time, provider and original link stay attached to each report.</p></div>
   <label className={styles.search}>Find a report <input type="search" value={query} onChange={e=>setQuery(e.target.value.slice(0,100))} placeholder="Search issuers, stories, themes" /></label>
  </div>
  <div className={styles.topics} role="group" aria-label="Newsroom categories">
   {EDITORIAL_TOPICS.map(t=>{const count=t.id==="all"?newsOnly.length+archiveEntries.length:
     newsOnly.filter(n=>editorialNewsTopics(n).includes(t.id)).length+
     archiveEntries.filter(a=>archiveTopics(a).includes(t.id)).length;
    return <button key={t.id} type="button" aria-pressed={topic===t.id} className={topic===t.id?styles.selected:styles.filter}
     onClick={()=>setTopic(t.id)}>{t.label} <small>{count}</small></button>})}
  </div>
  <div className={styles.columns}><section className={styles.feed} aria-live="polite">
    <p className={styles.results}>{visibleCount} source-qualified report{visibleCount===1?"":"s"} matching your selection.</p>
    {!archiveAvailable?<p className={styles.empty} data-newsroom-archive-unavailable>Previously reviewed archive temporarily unavailable; current source-verified wire remains accessible.</p>:null}
    {archiveVisible.map(item=><article key={"archive:"+item.id} className={styles.item} data-newsroom-archived-reader={item.id}>
      <div className={styles.art}><EditorialStoryArt headline={item.headline} compact/></div>
      <div className={styles.content}>
       <span className={styles.chip}>{item.verificationLabel}</span>
       <small className={styles.metadata}>{archiveTopics(item).join(" · ").toUpperCase()} · {item.eventAt?clock(item.eventAt):item.eventDay+" · date only"}</small>
       <h2><Link href={item.readerHref}>{item.headline}</Link></h2>
       <div className={styles.actions}>
        <Link href={item.readerHref}>Read Bluebelly's source-reviewed report →</Link>
        <a href={item.sourceUrl} rel="noopener noreferrer" target="_blank">{item.sourceName} · original source ↗</a>
       </div>
      </div>
    </article>)}
    {visible.map(item=><article key={item.id} className={styles.item}>
      <div className={styles.art}><EditorialStoryArt headline={item.headline} summary={item.summary} compact/></div>
      <div className={styles.content}>
       <span className={styles.chip}>{Date.parse(now)-Date.parse(item.occurredAt)>48*3600000?"VERIFIED · EARLIER THIS WEEK":"SOURCE VERIFIED · LAST 48H"}</span>
       <small className={styles.metadata}>{editorialNewsTopics(item).join(" · ").toUpperCase()} · {clock(item.occurredAt)}</small>
       <h2><Link href={readerHref+"?news="+encodeURIComponent(item.id)}>{item.headline}</Link></h2>
       <p>{item.summary}</p>
       <div className={styles.actions}>
        <Link href={readerHref+"?news="+encodeURIComponent(item.id)}>Read short Bluebelly recap →</Link>
        <a href={item.sourceUrl} rel="noopener noreferrer" target="_blank">{item.sourceName} · original report ↗</a>
        <button type="button" onClick={()=>setShortlist(ids=>ids.includes(item.id)?ids.filter(i=>i!==item.id):[...ids,item.id])}
          aria-pressed={shortlist.includes(item.id)}>{shortlist.includes(item.id)?"✓ Shortlisted":"+ Brief shortlist"}</button>
       </div>
       <details className={styles.readMore}>
        <summary>Read the investor test and evidence boundary</summary>
        <div className={styles.detailBody}>
         <h3>What happened?</h3><p>{item.summary}</p>
         <h3>Who bears the economics?</h3><p>Identify the companies, borrowers, customers or markets exposed. No balance-sheet effect is assumed without relevant source data.</p>
         <h3>What could challenge the first interpretation?</h3><p>Check the strongest alternative explanation and a dated comparable market measurement before assigning a cause to price action.</p>
         <p>Observed by desk: {clock(item.observedAt)}. Reporting qualification does not constitute canonical regime evidence or a measured asset reaction.</p>
         {storyTvInstrument(item.headline)?<TradingViewChart initial={storyTvInstrument(item.headline)!} compact/>:null}
        </div>
       </details>
      </div>
    </article>)}
    {visibleCount===0?<p className={styles.empty}>No qualifying reports match. Clear the search or try another category; an empty feed does not mean nothing happened.</p>:null}
   </section>
   <aside className={styles.rail}><div className={styles.panel}><h2>Evidence status</h2>
     <p>Source-verified wire reports and previously reviewed public-reader snapshots have different provenance labels. Neither represents automatic canonical regime evidence.</p>
     <div className={styles.statusLine}><strong>{newsOnly.length+archiveEntries.length}</strong><span>qualifying recent reports</span></div>
     <p><strong>Rumours and creator theses</strong> stay in authenticated owner research until independently checked. Urgency does not confer credibility.</p>
   </div><div className={styles.panel}><h2>Working brief shortlist</h2>
     <p>Select reports to assemble a temporary copyable outline. This does not publish a report or save an editorial decision.</p>
     <div className={styles.statusLine}><strong>{shortlist.length}</strong><span>selected original reports</span></div>
     <button type="button" className={styles.copy} onClick={copy}>Copy source-linked outline</button>
     <p role="status" aria-live="polite">{feedback}</p>
   </div></aside></div>
 </div>;
}
