"use client";
import {isEditorialUpdatedToday} from "@/lib/bluebelly-editorial-freshness";
import {useEffect,useState} from "react";
import ReaderPagination from "./ReaderPagination";
import {normaliseReaderPage,paginateReaderItems} from "@/lib/bluebelly-reader-pagination";
import type {ReactNode} from "react";
import PublishedResearchDispatches from "./PublishedResearchDispatches";
import MarketTakeaway from "./MarketTakeaway";
import SignalTags from "./SignalTags";
import {SIGNAL_TAGS} from "@/lib/bluebelly-signal-tags";
import {filterNewsBySignal,newsResearchTags,normaliseNewsSignalFilter,type NewsSignalFilter} from "@/lib/bluebelly-news-signal-filter";
import {publicReadingHeadline} from "@/lib/bluebelly-public-headline";
import type {PublicResearchFocus} from "@/lib/blue-desk-published-research-focus";
import Link from "next/link";
import type {NewsBriefV1} from "@/lib/market-brief-news";
import {consequenceForSourceOnlyNews} from "@/lib/bluebelly-market-consequence-read-model";
import {storyDepthForNews} from "@/lib/bluebelly-key-story-depth";
import {reviewedImpactForDepth} from "@/lib/bluebelly-editorial-market-framework";
import {publicArchiveSearchIndex,type ArchiveNewsItem} from "@/lib/bluebelly-publication-archive";
import type {NewsroomHotPicks} from "@/lib/bluebelly-newsroom-hot-picks";
import type {NewsroomEditorialItem} from "@/lib/bluebelly-newsroom-editorial";
import {EDITORIAL_TOPICS,editorialNewsTopics,type EditorialTopicId} from "@/lib/bluebelly-editorial-architecture";
import {storyTvInstrument} from "@/lib/bluebelly-editorial-visuals";
import {isPublishedChartWatch,publishedChartWatchCount} from "@/lib/bluebelly-chart-watch";
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
     <MarketTakeaway mode="source-only" compact/>
     <h3>What the original source confirms</h3><p>{news.summary}</p>
     <h3>Economic effect</h3><p>{evidence?.economic.text||"Not established from this source notice."}</p>
     <h3>Uncertainty</h3><p>A specific unresolved outcome has not yet been independently assessed. Do not label this report a broad market-uncertainty shock.</p>
     <h3>Decision signal and supply/demand</h3><p>No event-specific decision signal or physical supply-and-demand change has been reviewed from this source notice. Do not infer market positivity from headline tone.</p>
     <h3>Prior expectations</h3><p>{evidence?.expectations.text||"Not verified."}</p>
     <h3>Observed share or market response</h3><p>{evidence?.price.text||"Not measured."}</p>
     <p>Original event {clock(news.occurredAt)} · desk observed {clock(news.observedAt)}. Source-verified does not mean an accepted market cause or a canonical Story update.</p>
     {chart?<TradingViewChart initial={chart} compact/>:null}
   </div>
  </details>;
}
/** Show only source-reviewed, exact-receipt editorial packets. Never promote
 * unreviewed private research or source-only receipts into this surface. */
function ReviewedNewsConsequence({news}:{news:NewsBriefV1}){
 const depth=storyDepthForNews(news);
 if(!depth)return null;
 const impact=reviewedImpactForDepth(depth);
 return <details className={styles.readMore} data-market-consequence="reviewed-original-event">
  <summary>Why this matters and what to check next</summary>
  <div className={styles.detailBody}>
   <h3>What the reviewed evidence changes</h3>
   <p>{depth.whatChanged[0]||depth.hook}</p>
   <h3>The economic mechanism</h3>
   <p>{depth.explanation[0]||depth.lead}</p>
   {impact?<div data-newsroom-impact="reviewed-conditional">
    <h3>What the decision signals</h3><p>{impact.decisionSignal}</p>
    <h3>Uncertainty: {impact.uncertaintyDirection.toLowerCase()}</h3><p>{impact.uncertaintyWhy}</p>
    <h3>Who benefits or faces pressure?</h3><p><strong>Potential beneficiaries:</strong> {impact.beneficiaries}</p>
    <p><strong>Potentially pressured:</strong> {impact.pressured}</p>
    <h3>Supply, demand and financing</h3>
    <p><strong>Supply:</strong> {impact.supplyEffect}</p>
    <p><strong>Demand:</strong> {impact.demandEffect}</p>
    <p><strong>Funding:</strong> {impact.financingEffect}</p>
    <h3>What should happen versus what the tape shows</h3>
    <p>{impact.expectedReaction}</p><p>{impact.observedReaction}</p>
    <p><strong>Divergence: {impact.divergence.toLowerCase()}.</strong> {impact.alternative}</p>
   </div>:<p>Source reviewed, but positive/negative market interpretation has not been separately adjudicated.</p>}
   <h3>What could challenge it</h3>
   <p>{depth.countercase[0]||"No event-specific alternative established."}</p>
   <h3>Next verification</h3>
   <p>{depth.nextTests[0]||depth.theQuestion}</p>
   <p>Source-reviewed editorial expansion as of {depth.edition}. This is not a measured market-price reaction or an automatic canonical Regime change.</p>
  </div>
 </details>;
}
type NewsroomCategory=EditorialTopicId|"hot"|"chart-watch";
export default function BluebellyNewsWire({news,archiveEntries=[],archiveAvailable=true,hotPicks,editorials=[],researchItems=[],initialQuery="",initialCategory="all",initialSignal="all",initialPage="1",now,readerHref,children}:{
 news:readonly NewsBriefV1[];archiveEntries?:readonly ArchiveNewsItem[];archiveAvailable?:boolean;
 hotPicks:NewsroomHotPicks;editorials?:readonly NewsroomEditorialItem[];
 researchItems?:readonly PublicResearchFocus[];
 initialQuery?:string;initialCategory?:string;initialSignal?:string;initialPage?:string;
 now:string;readerHref:string;children?:ReactNode;
}){
 const [topic,setTopic]=useState<NewsroomCategory>(()=>
  initialCategory==="hot"||initialCategory==="chart-watch"||EDITORIAL_TOPICS.some(t=>t.id===initialCategory)?
    initialCategory as NewsroomCategory:"all");
 const [query,setQuery]=useState(initialQuery.slice(0,100));
 const [signal,setSignal]=useState<NewsSignalFilter>(()=>normaliseNewsSignalFilter(initialSignal));
 const [currentPage,setCurrentPage]=useState(normaliseReaderPage(initialPage,10000));
 // The URL is shareable for topic/search/page and browser Back/Forward restores
 // the reader selection without requesting new data or bypassing source gates.
 function syncUrl(nextTopic:NewsroomCategory,nextQuery:string,nextPage:number,kind:"push"|"replace"="replace",nextSignal:NewsSignalFilter=signal){
  if(typeof window==="undefined")return;
  const url=new URL(window.location.href);
  if(nextTopic==="all")url.searchParams.delete("category");else url.searchParams.set("category",nextTopic);
  if(nextQuery.trim())url.searchParams.set("q",nextQuery.trim());else url.searchParams.delete("q");
  if(nextPage>1)url.searchParams.set("page",String(nextPage));else url.searchParams.delete("page");
  if(nextSignal==="all")url.searchParams.delete("signal");else url.searchParams.set("signal",nextSignal);
  if(kind==="push")window.history.pushState(null,"",url);else window.history.replaceState(null,"",url);
 }
 function selectTopic(next:NewsroomCategory,clearQuery=false){
  const nextQuery=clearQuery?"":query;
  setTopic(next);setQuery(nextQuery);setCurrentPage(1);
  syncUrl(next,nextQuery,1);
 }
 function selectSignal(next:NewsSignalFilter){
  setSignal(next);setCurrentPage(1);syncUrl(topic,query,1,"replace",next);
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
   setTopic(requested==="hot"||requested==="chart-watch"||EDITORIAL_TOPICS.some(t=>t.id===requested)?requested as NewsroomCategory:"all");
   setQuery((url.searchParams.get("q")||"").slice(0,100));
   setSignal(normaliseNewsSignalFilter(url.searchParams.get("signal")));
   setCurrentPage(normaliseReaderPage(url.searchParams.get("page"),10000));
  }
  window.addEventListener("popstate",restore);
  return ()=>window.removeEventListener("popstate",restore);
 },[]);
 const [shortlist,setShortlist]=useState<string[]>([]);
 const [feedback,setFeedback]=useState("");
 const researched=researchItems.filter(item=>{
   if(topic==="hot")return false; // Never relabel research as verified Hot Picks.
    if(topic==="chart-watch")return false; // Never relabel private research as public Chart Watch.
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
 const editorialVisible=editorials.filter(item=>(topic==="chart-watch"?isPublishedChartWatch(item):
     topic==="hot"?hotPicks.keys.includes("editorial:"+item.id):
    topic==="all"||item.topics.includes(topic))&&
  (item.headline+" "+item.summary+" "+item.sourceName+" "+item.why).toLowerCase().includes(query.trim().toLowerCase()));
 const visible=newsOnly.filter(item=>(topic==="chart-watch"?false:
     topic==="hot"?hotPicks.keys.includes("news:"+item.id):
    topic==="all"||editorialNewsTopics(item).includes(topic))&&
  (item.headline+" "+item.summary+" "+item.sourceName).toLowerCase().includes(query.trim().toLowerCase()));
 const archiveVisible=archiveOnly.filter(item=>(topic==="chart-watch"?false:
     topic==="hot"?hotPicks.keys.includes("archive:"+item.id):
    topic==="all"||archiveTopics(item).includes(topic))&&
  publicArchiveSearchIndex(item).includes(query.trim().toLowerCase()));
 const sourceSignalNews=filterNewsBySignal(visible,signal);
 const visibleCards=[
  ...(signal==="all"?editorialVisible:[]).map(item=>({kind:"editorial" as const,item})),
  ...(signal==="all"?archiveVisible:[]).map(item=>({kind:"archive" as const,item})),
  ...sourceSignalNews.map(item=>({kind:"news" as const,item})),
 ].sort((a,b)=>{
  if(topic==="hot")return hotPicks.keys.indexOf(a.kind+":"+a.item.id)-hotPicks.keys.indexOf(b.kind+":"+b.item.id);
  const aAt=Date.parse(a.kind==="archive"?(a.item.eventAt||(a.item.eventDay?a.item.eventDay+"T00:00:00Z":"")):a.item.occurredAt);
  const bAt=Date.parse(b.kind==="archive"?(b.item.eventAt||(b.item.eventDay?b.item.eventDay+"T00:00:00Z":"")):b.item.occurredAt);
  return (bAt||0)-(aAt||0)||a.kind.localeCompare(b.kind);
 });
 const paginated=paginateReaderItems(visibleCards,currentPage,8);
 const selected=shortlist.flatMap(id=>newsOnly.find(n=>n.id===id)||[]);
 const visibleCount=sourceSignalNews.length+(signal==="all"?archiveVisible.length+editorialVisible.length:0);
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
    <button type="button" data-newsroom-chart-watch-filter="approved-only" aria-pressed={topic==="chart-watch"}
     className={topic==="chart-watch"?styles.selected:styles.filter}
     onClick={()=>selectTopic("chart-watch",true)}>Chart Watch <small>{publishedChartWatchCount(editorials)}</small></button>
   {EDITORIAL_TOPICS.map(t=>{const count=t.id==="all"?newsOnly.length+archiveOnly.length+editorials.length:
     newsOnly.filter(n=>editorialNewsTopics(n).includes(t.id)).length+
     archiveOnly.filter(a=>archiveTopics(a).includes(t.id)).length+
     editorials.filter(a=>a.topics.includes(t.id)).length;
    return <button key={t.id} type="button" aria-pressed={topic===t.id} className={topic===t.id?styles.selected:styles.filter}
     onClick={()=>selectTopic(t.id)}>{t.label} <small>{count}</small></button>})}
  </div>
  <div className={styles.signalFilters} role="group" aria-label="Research signal filter" data-newsroom-signal-filter="source-only-news">
    <span>INTERESTING SIGNALS / RESEARCH QUESTIONS</span>
    <button type="button" aria-pressed={signal==="all"} onClick={()=>selectSignal("all")}>All signals</button>
    {SIGNAL_TAGS.map(tag=><button key={tag.id} type="button" aria-pressed={signal===tag.id}
      title={tag.question} onClick={()=>selectSignal(tag.id)}>{tag.label}
      <small>{filterNewsBySignal(visible,tag.id).length}</small></button>)}
  </div>
  {signal!=="all"?<p className={styles.signalNote} data-newsroom-signal-coverage="source-only">
    Signal-filtered results are limited to already source-qualified news briefs. Archived features and reviewed editorials retain their original reading categories; no archive item is silently reclassified as fresh news.
  </p>:null}
  <div className={styles.columns}><section className={styles.feed} aria-live="polite" id="newsroom-results">
    {topic==="chart-watch"?<p className={styles.hotIntro} data-chart-watch-series="published-only">
       Chart-led market analysis, admitted only after an original-source review, a dated quantitative chart and public-use clearance.
       {publishedChartWatchCount(editorials)===0?" No reviewed Chart Watch articles are published yet; private research candidates are not shown.":""}
     </p>:null}
     {topic==="hot"?<p className={styles.hotIntro} data-hot-picks-day={hotPicks.etDay}>
      Top released stories for {hotPicks.etDay} (US Eastern). Re-ranked daily by materiality, recency and topic diversity.
      {hotPicks.keys.length<3?" Fewer than three source-qualified stories currently available; no upcoming events are used to pad the list.":""}
    </p>:null}
    <div className={styles.resultsBar} data-newsroom-pagination-position="above-feed">
      <p className={styles.results}>{visibleCount?`Showing ${paginated.firstItem}–${paginated.lastItem} of ${visibleCount}`:"No"} source-qualified report{visibleCount===1?"":"s"} matching your selection.</p>
      <ReaderPagination compact label="Newsroom" page={paginated.page} totalPages={paginated.totalPages}
        totalItems={paginated.totalItems} firstItem={paginated.firstItem} lastItem={paginated.lastItem}
        onPageChange={changePage}/>
    </div>
    {topic!=="chart-watch"&&!archiveAvailable?<p className={styles.empty} data-newsroom-archive-unavailable>Previously reviewed archive temporarily unavailable; current source-verified wire remains accessible.</p>:null}
    {paginated.items.map(card=>card.kind==="archive"?<article key={"archive:"+card.item.id} className={styles.item} data-newsroom-archived-reader={card.item.id}>
      <div className={styles.art}><EditorialStoryArt headline={card.item.headline} compact/></div>
      <div className={styles.content}>
       <span className={styles.chip}>{card.item.verificationLabel}</span>
       <small className={styles.metadata}>{archiveTopics(card.item).join(" · ").toUpperCase()} · {card.item.eventAt?clock(card.item.eventAt):card.item.eventDay+" · date only"}</small>
       <h2><Link href={card.item.readerHref}>{publicReadingHeadline(card.item.headline,"",card.item.sourceName)}</Link></h2>
       <details className={styles.readMore}><summary>Archive status and context</summary><MarketTakeaway mode="archived" compact/></details>
       <div className={styles.actions}>
        <Link href={card.item.readerHref}>Read Bluebelly's source-reviewed report →</Link>
        <a href={card.item.sourceUrl} rel="noopener noreferrer" target="_blank">{card.item.sourceName} · original source ↗</a>
       </div>
      </div>
    </article>:
    card.kind==="editorial"?<article key={card.item.id} className={styles.item} data-newsroom-editorial-article={card.item.id}>
      <div className={styles.art}><EditorialStoryArt headline={card.item.headline} summary={card.item.summary} compact/></div>
      <div className={styles.content}>
       <span className={styles.chip}>{isPublishedChartWatch(card.item)?"CHART WATCH · VERIFIED VISUAL":card.item.verificationLabel}</span>
       {isEditorialUpdatedToday(card.item.initialPublishedOn||"",card.item.editorialUpdatedAt,new Date(now))?<span data-editorial-updated-today="MYT" className={styles.chip}>Updated today · MYT</span>:null}
       <small className={styles.metadata}>{card.item.topics.join(" · ").toUpperCase()} · {clock(card.item.occurredAt)}</small>
       <h2><Link href={card.item.readerHref}>{publicReadingHeadline(card.item.headline,card.item.summary,card.item.sourceName)}</Link></h2>
       <p data-quick-market-brief="source-qualified-summary">{card.item.summary}</p>

        {isPublishedChartWatch(card.item)&&card.item.chartWatch?<details className={styles.readMore} data-chart-watch-source-ledger={card.item.id}>
         <summary>Chart evidence, dates and original source</summary>
         <div className={styles.detailBody}>
          <h3>{card.item.chartWatch.visual.title}</h3>
          <p>{card.item.chartWatch.visual.description}</p>
          <p>Period: {card.item.chartWatch.visual.period_basis} · Unit: {card.item.chartWatch.visual.unit} · As of: {clock(card.item.chartWatch.visual.as_of_et)}</p>
          <p>This is a source-dated research comparison, not a live price feed or proof of market causality.</p>
          <ul>{card.item.chartWatch.visual.sources.map(source=><li key={source.url}>
           <a href={source.url} target="_blank" rel="noopener noreferrer">{source.publisher} · original quantitative source</a>
          </li>)}</ul>
          {card.item.chartWatch.visual.rows.length>0?<div style={{overflowX:"auto"}}><table>
           <thead><tr>{card.item.chartWatch.visual.columns.map((col,i)=><th key={i} scope="col">{col}</th>)}</tr></thead>
           <tbody>{card.item.chartWatch.visual.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell===null?"Not reported":cell}</td>)}</tr>)}</tbody>
          </table></div>:null}
         </div>
        </details>:null}
       <div className={styles.actions}>
        <Link href={card.item.readerHref}>Read the source-reviewed analysis →</Link>
        <a href={card.item.sourceUrl} rel="noopener noreferrer" target="_blank">{card.item.sourceName} · original source ↗</a>
       </div>
       <details className={styles.readMore}><summary>Explain the market implications and next test</summary>
        <div className={styles.detailBody}>
         <MarketTakeaway why={card.item.why} nextTest={card.item.nextTest} compact/>
         <h3>What could move markets?</h3><p>{card.item.why}</p>
         <h3>What should be checked next?</h3><p>{card.item.nextTest}</p>
         <p>The original statement and attributed price observations have separate evidence status. This article is not a canonical Regime or an intraday attribution study.</p>
        </div>
       </details>
      </div>
    </article>:
    <article key={card.item.id} className={styles.item} data-progressive-news="source-only">
      <div className={styles.art}><EditorialStoryArt headline={card.item.headline} summary={card.item.summary} compact/></div>
      <div className={styles.content}>
       <span className={styles.chip}>{storyDepthForNews(card.item)?"SOURCE VERIFIED · REVIEWED KEY STORY":Date.parse(now)-Date.parse(card.item.occurredAt)>48*3600000?"VERIFIED · EARLIER THIS WEEK":"SOURCE VERIFIED · LAST 48H"}</span>
       <small className={styles.metadata}>{editorialNewsTopics(card.item).join(" · ").toUpperCase()} · {clock(card.item.occurredAt)}</small>
       <h2><Link href={readerHref+"?news="+encodeURIComponent(card.item.id)}>{storyDepthForNews(card.item)?.title||publicReadingHeadline(card.item.headline,card.item.summary,card.item.sourceName)}</Link></h2>
       <p data-quick-market-brief="source-qualified-summary">{storyDepthForNews(card.item)?.hook||card.item.summary}</p>
       <SignalTags tags={newsResearchTags(card.item)}/>

       <div className={styles.actions}>
        <Link href={readerHref+"?news="+encodeURIComponent(card.item.id)}>{storyDepthForNews(card.item)?"Read source-reviewed Key Story →":"Read short Bluebelly recap →"}</Link>
        <a href={card.item.sourceUrl} rel="noopener noreferrer" target="_blank">{card.item.sourceName} · original report ↗</a>
        <button type="button" onClick={()=>setShortlist(ids=>ids.includes(card.item.id)?ids.filter(i=>i!==card.item.id):[...ids,card.item.id])}
          aria-pressed={shortlist.includes(card.item.id)}>{shortlist.includes(card.item.id)?"✓ Shortlisted":"+ Brief shortlist"}</button>
       </div>
       {storyDepthForNews(card.item)?<ReviewedNewsConsequence news={card.item}/>:<SourceOnlyConsequence news={card.item}/>}
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
