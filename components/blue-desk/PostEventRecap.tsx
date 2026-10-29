import Link from "next/link";
import DualTimestamp from "./DualTimestamp";
import EditorialStoryArt from "./EditorialStoryArt";
import SourceTweetEmbeds from "./SourceTweetEmbeds";
import type {EmbeddedSocialContext} from "@/lib/bluebelly-event-social";
import type {PostEventRecap} from "@/lib/bluebelly-post-event-recap";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import s from "./PostEventRecap.module.css";

export function PostEventRecapFeature({recaps,host,socialPosts=[]}:{
 recaps:readonly PostEventRecap[];host:string|null;socialPosts?:readonly EmbeddedSocialContext[];
}){
 const feature=recaps[0];
 if(!feature)return null;
 const url=blueDeskPublicHref("/blue-desk/key-stories",host)+feature.detailsHref;
 return <section className={s.feature} data-bluebelly-post-event="source-qualified" aria-labelledby="post-event-title">
  <div className={s.featureHead}>
   <span className={s.eyebrow}>AFTER THE ANNOUNCEMENT / THE STORY SO FAR</span>
   <span className={s.clock}><DualTimestamp value={feature.releaseAt.includes("T")?feature.releaseAt:null} sourceDate={feature.releaseAt}/></span>
  </div>
  <div className={s.featureBody}>
   <div className={s.intro}>
    <p className={s.status}>{feature.featuredStatus==="REVIEWED"?"REVIEWED POST-EVENT RECAP":"VERIFIED ANNOUNCEMENT · ANALYSIS PENDING"}</p>
    <h2 id="post-event-title"><Link href={url}>{feature.headline}</Link></h2>
    <p className={s.introText}>{feature.whatHappened}</p>
    <div className={s.art}><EditorialStoryArt headline={feature.headline} summary={feature.whatHappened} compact/></div>
    <p className={s.source}><a href={feature.sourceUrls[0].url} target="_blank" rel="noopener noreferrer">{feature.sourceUrls[0].label} · original evidence ↗</a></p>
    <Link className={s.read} href={url}>{feature.featuredStatus==="REVIEWED"?"Read the full post-event analysis":"Read the verified report"} <span aria-hidden="true">↗</span></Link>
   </div>
   <div className={s.storyBeats}>
    <section><p className={s.beat}>01 / WHAT HAPPENED</p><p>{feature.whatHappened}</p></section>
    <section><p className={s.beat}>02 / EFFECT ON MARKETS</p><p>{feature.marketEffects}</p>
     <small>{feature.marketEffectStatus==="MECHANISM_ONLY"?"Economic mechanism · NOT a verified price reaction":"Observed daily market readings and attributed reaction coverage · NOT a causal event-window study"}</small>
    </section>
    <section><p className={s.beat}>03 / WHAT COMES NEXT</p><p>{feature.whatNext}</p></section>
    <details className={s.limit}><summary>What could change the interpretation?</summary><p>{feature.countercase}</p><p>{feature.evidenceNote}</p></details>
   </div>
  </div>
  {socialPosts.length>0?<div className={s.socialStrip}><span className={s.beat}>DATED X CONVERSATION · COMMENTARY, NOT CONFIRMATION</span>
   {socialPosts.map(p=><a key={p.id} target="_blank" rel="noopener noreferrer" href={p.url}>@{p.handle} · {p.phase} · original post ↗</a>)}
  </div>:null}
  {recaps.length>1?<div className={s.more}><strong>Other decisions and earnings</strong>
    {recaps.slice(1,4).map(r=><Link key={r.id} href={blueDeskPublicHref("/blue-desk/key-stories",host)+r.detailsHref}>{r.eventName} · {r.featuredStatus==="REVIEWED"?"Post-event recap":"Report pending analysis"} ↗</Link>)}
   </div>:null}
 </section>;
}

export function PostEventRecapArticle({recap,backHref,socialPosts=[]}:{
 recap:PostEventRecap;backHref:string;socialPosts?:readonly EmbeddedSocialContext[];
}){
 return <article className={s.reader} data-post-event-reader={recap.featuredStatus==="REVIEWED"?"reviewed":"source-only"}>
  <nav><Link href={backHref}>← Key Stories</Link></nav>
  <header className={s.readerHead}>
   <p className={s.eyebrow}>{recap.featuredStatus==="REVIEWED"?"POST-EVENT STORY / RESEARCHED RECAP":"OFFICIAL EVENT / DEEP ANALYSIS PENDING"}</p>
   <h1>{recap.headline}</h1>
   <p>{recap.eventName} · <DualTimestamp value={recap.releaseAt.includes("T")?recap.releaseAt:null} sourceDate={recap.releaseAt}/></p>
  </header>
  <div className={s.readerBody}>
   <div className={s.chapters}>
    <section><span className={s.beat}>01 / THE RECAP</span><h2>What actually happened?</h2><p>{recap.whatHappened}</p></section>
    <section><span className={s.beat}>02 / THE MARKET QUESTION</span><h2>What did it mean for markets?</h2><p>{recap.marketEffects}</p>
     <p className={s.caveat}>{recap.evidenceNote}</p>
    </section>
    <section><span className={s.beat}>03 / THE ROAD AHEAD</span><h2>What comes next?</h2><p>{recap.whatNext}</p></section>
    <section><span className={s.beat}>04 / THE COUNTERCASE</span><h2>What could prove the interpretation wrong?</h2><p>{recap.countercase}</p></section>
   </div>
   <aside className={s.references}>
    <h2>Evidence, reporting and perspectives</h2>
    <p>Official source facts lead. Reporting and market commentary are attributed separately and do not establish a policy decision, earnings result or causal price move.</p>
    {recap.sourceUrls.map(item=><div key={item.url} className={s.reference}>
      <small>{item.role==="official"?"ORIGINAL DOCUMENT":item.role==="market_data"?"DATED MARKET DATA":"ATTRIBUTED REPORTING"}</small>
      <a href={item.url} target="_blank" rel="noopener noreferrer">{item.label} ↗</a>
    </div>)}
    {socialPosts.length>0?<SourceTweetEmbeds posts={socialPosts} sourceLink={recap.sourceUrls[0].url}/>:null}
    <p className={s.caveat}>Creator-video interpretations and transcripts should be added only with original links, dated quotations or summaries and editorial verification. No creator claim is inferred or invented for this edition.</p>
   </aside>
  </div>
 </article>;
}
