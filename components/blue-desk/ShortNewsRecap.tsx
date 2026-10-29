import Link from "next/link";
import EditorialStoryArt from "./EditorialStoryArt";
import EarningsEvidenceGraphic from "./EarningsEvidenceGraphic";
import DualTimestamp from "./DualTimestamp";
import type {NewsBriefV1} from "@/lib/market-brief-news";
import type {VerifiedEarningsScorecard} from "@/lib/blue-desk-earnings-results";
import {projectLivingMarketTopics} from "@/lib/blue-desk-living-topics";
import {decisionTopics} from "@/lib/bluebelly-decision-brief";
import ui from "./ShortNewsRecap.module.css";
import type {StoryCoverageStatus} from "@/lib/bluebelly-key-story-depth";

type Recap={
 title:string;fact:string;stake:string;mechanism:string;nextTest:string;
 sourceUrl:string;sourceName:string;asOf:string;isScheduled:boolean;label:string;
 ticker?:string;earnings?:VerifiedEarningsScorecard|null;
};
function validSource(url:string){try{const u=new URL(url);return u.protocol==="https:"&&!u.username&&!u.password;}catch{return false;}}
export function recapFromNews(news:NewsBriefV1):Recap{
 const topic=projectLivingMarketTopics([news])[0];
 return {
  title:news.headline,
  fact:news.summary.startsWith("The original publisher issued this dated announcement.")
    ?news.headline:news.summary,
  stake:topic?.humanStake||"Who benefits, who pays, and which assets are exposed depends on the specific reported change.",
  mechanism:topic?.marketMechanism||"The first transmission test is whether the announcement changes expected revenue, costs, financing, or supply. A price reaction needs independently matched observations.",
  nextTest:topic?.guidingQuestion||"What evidence would confirm a lasting effect?",
  sourceUrl:news.sourceUrl,sourceName:news.sourceName,asOf:news.occurredAt,
  isScheduled:false,label:"VERIFIED ORIGINAL-SOURCE EVENT",
 };
}
export function recapFromDecision(
 topic:ReturnType<typeof decisionTopics>[number],
 earnings:VerifiedEarningsScorecard|null,
):Recap{
 return {
  title:topic.title,fact:topic.fact,stake:topic.why,mechanism:topic.mechanism,
  nextTest:topic.test,sourceUrl:topic.sourceUrl,sourceName:topic.sourceName,
  asOf:topic.at,isScheduled:topic.status==="UPCOMING",
  label:topic.status==="UPCOMING"?"PREVIEW · OUTCOME NOT YET VERIFIED":"ISSUER-VERIFIED RESULT",
  ticker:topic.assets.join(" · "),earnings,
 };
}
/** Read-only explanation of the existing qualified record, never an on-request AI verdict. */
export default function ShortNewsRecap({recap,backHref,coverage}:{recap:Recap;backHref:string;coverage?:StoryCoverageStatus}){
 if(coverage?.status==="SOURCE_ONLY")return <article className={ui.article} data-bluebelly-news-recap="source-only-depth-incomplete">
  <nav className={ui.back}><Link href={backHref}>← Return to Key Stories</Link></nav>
  <header className={ui.hero}><div className={ui.head}>
    <p className={ui.kicker}>SOURCE-VERIFIED REPORT · RESEARCH DEPTH INCOMPLETE</p>
    <h1>{recap.title}</h1>
    <p className={ui.deck}>The dated source report was verified. The previous baseline, expectation, financial effect and market response still need evidence before this can be presented as a researched Key Story.</p>
    <div className={ui.time}><DualTimestamp value={recap.asOf}/></div>
  </div><EditorialStoryArt headline={recap.title} summary={recap.fact}/></header>
  <div className={ui.chapters}>
    <section><p className={ui.kicker}>WHAT WE CAN VERIFY</p><h2>The confirmed development</h2><p>{recap.fact}</p></section>
    <section><p className={ui.kicker}>WHAT IS STILL MISSING</p><h2>What must be researched before calling this the full story?</h2>
      <ul>{coverage.missing.map(item=><li key={item}>{item}</li>)}</ul>
      <p className={ui.caution}>No consensus surprise, specific price reaction or company impact has been inferred from the headline.</p>
    </section>
  </div>
  <footer className={ui.source}><strong>Dated source evidence</strong>
   <p>This is a qualified report in the Newsroom evidence tier, not a completed investor investigation. The next existing research review can connect a sourced comparator and publish a new dated edition.</p>
   {validSource(recap.sourceUrl)?<a href={recap.sourceUrl} target="_blank" rel="noopener noreferrer">{recap.sourceName} · dated source ↗</a>:<span>Original source link unavailable</span>}
  </footer>
 </article>;

 const hasInstant=/^\d{4}-\d{2}-\d{2}T/.test(recap.asOf);
 return <article className={ui.article} data-bluebelly-news-recap="source-qualified">
  <nav className={ui.back}><Link href={backHref}>← Return to Key Stories</Link></nav>
  <header className={ui.hero}>
   <div className={ui.head}>
    <p className={ui.kicker}>{recap.label}</p>
    <h1>{recap.title}</h1>
    <p className={ui.deck}>{recap.isScheduled?
      "The date is known. The decision is not. Here's how to read the outcome when it arrives.":
      "A verified development has arrived. The question is what it changes—and what is still unproved."}</p>
    <div className={ui.time}><DualTimestamp value={hasInstant?recap.asOf:null} sourceDate={recap.asOf}/>
     {recap.ticker?<span>{recap.ticker}</span>:null}</div>
   </div>
   <EditorialStoryArt headline={recap.title} summary={recap.fact}/>
  </header>
  <div className={ui.chapters}>
   <section><p className={ui.kicker}>01 / THE SETUP</p>
    <h2>Why anyone was watching</h2>
    <p>{recap.stake}</p></section>
   <section><p className={ui.kicker}>02 / THE NEW INFORMATION</p>
    <h2>{recap.isScheduled?"The decision still ahead":"What the source confirms"}</h2>
    <p>{recap.fact}</p>
    {recap.earnings?<><div className={ui.metrics}>
     {recap.earnings.metrics.filter(m=>m.state==="measured").map(m=>
      <div key={m.name}><span>{m.name}</span><strong>{m.value}</strong><small>{m.comparison||"Same-basis comparison unavailable"}</small></div>)}
    </div><EarningsEvidenceGraphic scorecard={recap.earnings}/></>:null}
    {recap.isScheduled?<p className={ui.caution}>No vote, announcement or market response is inferred before the verified release.</p>:null}
   </section>
   <section><p className={ui.kicker}>03 / THE LEARNING MOMENT</p>
    <h2>Follow the money</h2>
    <p>{recap.mechanism}</p></section>
   <section><p className={ui.kicker}>04 / THE CATCH &amp; NEXT TEST</p>
    <h2>What could change the interpretation?</h2>
    <p>{recap.nextTest}</p>
    <p className={ui.caution}>{recap.isScheduled?
      "The scheduled event is not a released result. Any hawkish, dovish, earnings or FX reaction must be compared with expectations after publication.":
      "A press release is evidence of the announcement, not evidence that a particular asset moved because of it."}
      {recap.earnings?" Analyst-consensus beat/miss is unavailable unless period, metric, accounting basis and pre-release vintage match.":""}</p>
   </section>
  </div>
  <footer className={ui.source}><strong>Evidence and original report</strong>
   <p>Bluebelly's explanation separates reported facts from conditional financial mechanisms. It does not generate a new Dossier or Story verdict.</p>
   {validSource(recap.sourceUrl)?<a href={recap.sourceUrl} target="_blank" rel="noopener noreferrer">
    {recap.sourceName} · read the original source ↗</a>:<span>Original source link unavailable</span>}
  </footer>
 </article>;
}
