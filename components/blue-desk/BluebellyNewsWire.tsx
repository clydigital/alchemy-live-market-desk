"use client";
import {useEffect,useState} from "react";
import ReaderPagination from "./ReaderPagination";
import {normaliseReaderPage,paginateReaderItems} from "@/lib/bluebelly-reader-pagination";
import type {ReactNode} from "react";
import PublishedResearchDispatches from "./PublishedResearchDispatches";
import MarketTakeaway from "./MarketTakeaway";
import type {PublicResearchFocus} from "@/lib/blue-desk-published-research-focus";
import Link from "next/link";
import type {NewsBriefV1} from "@/lib/market-brief-news";
import {consequenceForSourceOnlyNews} from "@/lib/bluebelly-market-consequence-read-model";
import {publicArchiveSearchIndex,type ArchiveNewsItem} from "@/lib/bluebelly-publication-archive";
import type {NewsroomHotPicks} from "@/lib/bluebelly-newsroom-hot-picks";
import type {NewsroomEditorialItem} from "@/lib/bluebelly-newsroom-editorial";
import {EDITORIAL_TOPICS,editorialNewsTopics,type EditorialTopicId} from "@/lib/bluebelly-editorial-architecture";
import {storyTvInstrument} from "@/lib/bluebelly-editorial-visuals";
import EditorialStoryArt from "./EditorialStoryArt";
import TradingViewChart from "./TradingViewChart";
import styles from "./bluebelly-newswire.module.css";
function clock(value:string){
 // Date-only source reporting must not acquire a fabricated midnight clock.
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value+" · source date only";
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
 if(editorialNewsTopics({headline:item.headline,summary:""}).includes("crypto"))categories.add("crypto");
 return categories.size?[...categories]:["other"];
}
function SourceOnlyConsequence({news}:{news:NewsBriefV1}){
 const evidence=consequenceForSourceOnlyNews(news);
 const chart=storyTvInstrument(news.headline);
 return <details className={styles.readMore} data-market-consequence="source-only-evidence-status">
   <summary>What is known, and what still needs checking?</summary>
   <div className={styles.detailBody}>
     <h3>What the original source confirms</h3><p>{news.summary}</p>
     <h3>Economic effect</h3><p>{evidence?.economic.text||"Not established from this source notice."}</p>
     <h3>Uncertainty</h3><p>A specific unresolved outcome has not yet been independently assessed. Do not label this report a broad market-uncertainty shock.</p>
     <h3>Prior expectations</h3><p>{evidence?.expectations.text||"Not verified."}</p>
     <h3>Observed share or market response</h3><p>{evidence?.price.text||"Not measured."}</p>
     <p>Original event {clock(news.occurredAt)} · desk observed {clock(news.observedAt)}. Source-verified does not mean an accepted market cause or a canonical Story update.</p>
     {chart?<TradingViewChart initial={chart} compact/>:null}
   </div>
  </details>;
}
type NewsroomCategory=EditorialTopicId|"hot";
export default function BluebellyNewsWire({news,archiveEntries=[],archiveAvailable=true,hotPicks,editorials=[],researchItems=[],initialQuery="",initialCategory="all",initialPage="1",now,readerHref,children}:{
 news:readonly NewsBriefV1[];archiveEntries?:readonly ArchiveNewsItem[];archiveAvailable?:boolean;
 hotPicks:NewsroomHotPicks;editorials?:readonly NewsroomEditorialItem[];
 researchItems?:readonly PublicResearchFocus[];
 initialQuery?:string;initialCategory?:string;initialPage?:string;
 now:string;readerHref:string;children?:ReactNode;
}){
 const [topic,setTopic]=useState<NewsroomCategory>(()=>
  initialCategory==="hot"||EDITORIAL_TOPICS.some(t=>t.id===initialCategory)?
    initialCategory as NewsroomCategory:"all");
 const [query,setQuery]=useState(initialQuery.slice(0,100));
 const [currentPage,setCurrentPage]=useState(normaliseReaderPage(initialPage,10000));
 // The URL is shareable for topic/search/page and browser Back/Forward restores
 // the reader selection without requesting new data or bypassing source gates.
 function syncUrl(nextTopic:NewsroomCategory,nextQuery:string,nextPage:number,kind:"push"|"replace"="replace"){
  if(typeof window==="undefined")return;
  const url=new URL(window.location.href);
  if(nextTopic==="all")url.searchParams.delete("category");else url.searchParams.set("category",nextTopic);
  if(nextQuery.trim())url.searchParams.set("q",nextQuery.trim());else url.searchParams.delete("q");
  if(nextPage>1)url.searchParams.set("page",String(nextPage));else url.searchParams.delete("page");
  if(kind==="push")window.history.pushState(null,"",url);else window.history.replaceState(null,"",url);
 }
 function selectTopic(next:NewsroomCategory,clearQuery=false){
  const nextQuery=clearQuery?"":query;
  setTopic(next);setQuery(nextQuery);setCurrentPage(1);
  syncUrl(next,nextQuery,1);
 }
 function changeQuery(next:string){
  const value=next.slice(0,100);
  setQuery(value);setCurrentPage(1);syncUrl(topic,value,1);
 }
 function changePage(next:number){
  setCurrentPage(next);syncUrl(topic,query,next,"push");
  document.getElementById("newsroom-results")?.scrollIntoView({block:"start",behavior:"smooth"});
 }
 useEffect(()=>{
  function restore(){
   const url=new URL(window.location.href);
   const requested=url.searchParams.get("category");
   setTopic(requested==="hot"||EDITORIAL_TOPICS.some(t=>t.id===requested)?requested as NewsroomCategory:"all");
   setQuery((url.searchParams.get("q")||"").slice(0,100));
   setCurrentPage(normaliseReaderPage(url.searchParams.get("page"),10000));
  }
  window.addEventListener("popstate",restore);
  return ()=>window.removeEventListener("popstate",restore);
 },[]);
 const [shortlist,setShortlist]=useState<string[]>([]);
 const [feedback,setFeedback]=useState("");
 const researched=researchItems.filter(item=>{
   if(topic==="hot")return false; // Never relabel research as verified Hot Picks.
   const topicMatch=topic==="all"||
     ((topic==="energy")&&item.navigationTags.includes("energy"))||
     ((topic==="policy"||topic==="bonds")&&item.navigationTags.includes("rates"))||
     (topic==="ai"&&item.navigationTags.includes("ai"));
   return topicMatch&&[item.headline,item.standfirst,item.whatChanged,item.whyItMatters,
     item.countercase,item.nextTest,item.region].join(" ").toLowerCase().includes(query.trim().toLowerCase());
 });
 const editorialSources=new Set(editorials.map(item=>item.sourceUrl));
 const archiveOnly=archiveEntries.filter(a=>!editorialSources.has(a.sourceUrl));
 const newsOnly=news.filter(n=>!archiveEntries.some(a=>a.sourceUrl===n.sourceUrl)&&!editorialSources.has(n.sourceUrl));
 const editorialVisible=editorials.filter(item=>(topic==="hot"?hotPicks.keys.includes("editorial:"+item.id):
    topic==="all"||item.topics.includes(topic))&&
  (item.headline+" "+item.summary+" "+item.sourceName+" "+item.why).toLowerCase().includes(query.trim().toLowerCase()));
 const visible=newsOnly.filter(item=>(topic==="hot"?hotPicks.keys.includes("news:"+item.id):
    topic==="all"||editorialNewsTopics(item).includes(topic))&&
  (item.headline+" "+item.summary+" "+item.sourceName).toLowerCase().includes(query.trim().toLowerCase()));
 const archiveVisible=archiveOnly.filter(item=>(topic==="hot"?hotPicks.keys.includes("archive:"+item.id):
    topic==="all"||archiveTopics(item).includes(topic))&&
  publicArchiveSearchIndex(item).includes(query.trim().toLowerCase()));
 const visibleCards=[
  ...editorialVisible.map(item=>({kind:"editorial" as const,item})),
  ...archiveVisible.map(item=>({kind:"archive" as const,item})),
  ...visible.map(item=>({kind:"news" as const,item})),
 ].sort((a,b)=>{
  if(topic==="hot")return hotPicks.keys.indexOf(a.kind+":"+a.item.id)-hotPicks.keys.indexOf(b.kind+":"+b.item.id);
  const aAt=Date.parse(a.kind==="archive"?(a.item.eventAt||(a.item.eventDay?a.item.eventDay+"T00:00:00Z":"")):a.item.occurredAt);
  const bAt=Date.parse(b.kind==="archive"?(b.item.eventAt||(b.item.eventDay?b.item.eventDay+"T00:00:00Z":"")):b.item.occurredAt);
  return (bAt||0)-(aAt||0)||a.kind.localeCompare(b.kind);
 });
 const paginated=paginateReaderItems(visibleCards,currentPage,8);
 const selected=shortlist.flatMap(id=>newsOnly.find(n=>n.id===id)||[]);
 const visibleCount=visible.length+archiveVisible.length+editorialVisible.length;
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
   <p>Central banks, AI, bonds, energy, crypto, FX and earnings. Read a short in-house explanation first, then consult the dated original. Older verified reports retain their event dates.</p>
  </header>
  <div data-macropulse-editorial="research-derived-not-canonical">
    <PublishedResearchDispatches items={researched} mode="newsroom"/>
  </div>
  <div className={styles.sectionTitle}><div><h2>Browse by category</h2><p>Publication time, provider and original link stay attached to each report.</p></div>
   <label className={styles.search}>Find a report <input type="search" value={query} onChange={e=>changeQuery(e.target.value)} placeholder="Search issuers, stories, themes" /></label>
  </div>
  <div className={styles.topics} role="group" aria-label="Newsroom categories">
   <button type="button" data-newsroom-hot-picks-button="orange" aria-pressed={topic==="hot"}
    className={topic==="hot"?styles.hotSelected:styles.hotButton}
    onClick={()=>selectTopic("hot",true)}>Hot Picks <small>{hotPicks.keys.length}</small></button>
   {EDITORIAL_TOPICS.map(t=>{const count=t.id==="all"?newsOnly.length+archiveOnly.length+editorials.length:
     newsOnly.filter(n=>editorialNewsTopics(n).includes(t.id)).length+
     archiveOnly.filter(a=>archiveTopics(a).includes(t.id)).length+
     editorials.filter(a=>a.topics.includes(t.id)).length;
    return <button key={t.id} type="button" aria-pressed={topic===t.id} className={topic===t.id?styles.selected:styles.filter}
     onClick={()=>selectTopic(t.id)}>{t.label} <small>{count}</small></button>})}
  </div>
  <div className={styles.columns}><section className={styles.feed} aria-live="polite" id="newsroom-results">
    {topic==="hot"?<p className={styles.hotIntro} data-hot-picks-day={hotPicks.etDay}>
      Top released stories for {hotPicks.etDay} (US Eastern). Re-ranked daily by materiality, recency and topic diversity.
      {hotPicks.keys.length<3?" Fewer than three source-qualified stories currently available; no upcoming events are used to pad the list.":""}
    </p>:null}
    <p className={styles.results}>{visibleCount?`Showing ${paginated.firstItem}–${paginated.lastItem} of ${visibleCount}`:"No"} source-qualified report{visibleCount===1?"":"s"} matching your selection. Pagination covers the available published reader set.</p>
    {!archiveAvailable?<p className={styles.empty} data-newsroom-archive-unavailable>Previously reviewed archive temporarily unavailable; current source-verified wire remains accessible.</p>:null}
    {paginated.items.map(card=>card.kind==="archive"?<article key={"archive:"+card.item.id} className={styles.item} data-newsroom-archived-reader={card.item.id}>
      <div className={styles.art}><EditorialStoryArt headline={card.item.headline} compact/></div>
      <div className={styles.content}>
       <span className={styles.chip}>{card.item.verificationLabel}</span>
       <small className={styles.metadata}>{archiveTopics(card.item).join(" · ").toUpperCase()} · {card.item.eventAt?clock(card.item.eventAt):card.item.eventDay+" · date only"}</small>
       <h2><Link href={card.item.readerHref}>{card.item.headline}</Link></h2>
       <MarketTakeaway mode="archived" compact/>
       <div className={styles.actions}>
        <Link href={card.item.readerHref}>Read Bluebelly's source-reviewed report →</Link>
        <a href={card.item.sourceUrl} rel="noopener noreferrer" target="_blank">{card.item.sourceName} · original source ↗</a>
       </div>
      </div>
    </article>:
    card.kind==="editorial"?<article key={card.item.id} className={styles.item} data-newsroom-editorial-article={card.item.id}>
      <div className={styles.art}><EditorialStoryArt headline={card.item.headline} summary={card.item.summary} compact/></div>
      <div className={styles.content}>
       <span className={styles.chip}>{card.item.verificationLabel}</span>
       <small className={styles.metadata}>{card.item.topics.join(" · ").toUpperCase()} · {clock(card.item.occurredAt)}</small>
       <h2><Link href={card.item.readerHref}>{card.item.headline}</Link></h2>
       <p data-quick-market-brief="source-qualified-summary">{card.item.summary}</p>
       <MarketTakeaway why={card.item.why} nextTest={card.item.nextTest} compact/>
       <div className={styles.actions}>
        <Link href={card.item.readerHref}>Read the source-reviewed analysis →</Link>
        <a href={card.item.sourceUrl} rel="noopener noreferrer" target="_blank">{card.item.sourceName} · original source ↗</a>
       </div>
       <details className={styles.readMore}><summary>Market mechanism and next test</summary>
        <div className={styles.detailBody}>
         <h3>What could move markets?</h3><p>{card.item.why}</p>
         <h3>What should be checked next?</h3><p>{card.item.nextTest}</p>
         <p>The original statement and attributed price observations have separate evidence status. This article is not a canonical Regime or an intraday attribution study.</p>
        </div>
       </details>
      </div>
    </article>:
    <article key={card.item.id} className={styles.item}>
      <div className={styles.art}><EditorialStoryArt headline={card.item.headline} summary={card.item.summary} compact/></div>
      <div className={styles.content}>
       <span className={styles.chip}>{Date.parse(now)-Date.parse(card.item.occurredAt)>48*3600000?"VERIFIED · EARLIER THIS WEEK":"SOURCE VERIFIED · LAST 48H"}</span>
       <small className={styles.metadata}>{editorialNewsTopics(card.item).join(" · ").toUpperCase()} · {clock(card.item.occurredAt)}</small>
       <h2><Link href={readerHref+"?news="+encodeURIComponent(card.item.id)}>{card.item.headline}</Link></h2>
       <p data-quick-market-brief="source-qualified-summary">{card.item.summary}</p>
       <MarketTakeaway mode="source-only" compact/>
       <div className={styles.actions}>
        <Link href={readerHref+"?news="+encodeURIComponent(card.item.id)}>Read short Bluebelly recap →</Link>
        <a href={card.item.sourceUrl} rel="noopener noreferrer" target="_blank">{card.item.sourceName} · original report ↗</a>
        <button type="button" onClick={()=>setShortlist(ids=>ids.includes(card.item.id)?ids.filter(i=>i!==card.item.id):[...ids,card.item.id])}
          aria-pressed={shortlist.includes(card.item.id)}>{shortlist.includes(card.item.id)?"✓ Shortlisted":"+ Brief shortlist"}</button>
       </div>
       <SourceOnlyConsequence news={card.item}/>
      </div>
    </article>)}
    {visibleCount===0?<p className={styles.empty}>No qualifying reports match. Clear the search or try another category; an empty feed does not mean nothing happened.</p>:null}
    <ReaderPagination label="Newsroom" page={paginated.page} totalPages={paginated.totalPages}
      totalItems={paginated.totalItems} firstItem={paginated.firstItem} lastItem={paginated.lastItem}
      onPageChange={changePage}/>
   </section>
   <aside className={styles.rail}><div className={styles.panel}><h2>Evidence status</h2>
     <p>Source-verified wire reports and previously reviewed public-reader snapshots have different provenance labels. Neither represents automatic canonical regime evidence.</p>
     <div className={styles.statusLine}><strong>{newsOnly.length+archiveOnly.length+editorials.length}</strong><span>qualifying recent reports</span></div>
     <p><strong>Rumours and creator theses</strong> stay in authenticated owner research until independently checked. Urgency does not confer credibility.</p>
   </div><div className={styles.panel}><h2>Working brief shortlist</h2>
     <p>Select reports to assemble a temporary copyable outline. This does not publish a report or save an editorial decision.</p>
     <div className={styles.statusLine}><strong>{shortlist.length}</strong><span>selected original reports</span></div>
     <button type="button" className={styles.copy} onClick={copy}>Copy source-linked outline</button>
     <p role="status" aria-live="polite">{feedback}</p>
   </div></aside></div>
  {topic==="all"?<details className={styles.contextNews} data-newsroom-timeline="expandable-only">
    <summary>Explore the release-clock timeline and related market watch</summary>
    <div>{children}</div>
   </details>:null}
 </div>;
}
