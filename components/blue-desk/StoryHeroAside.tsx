import Link from "next/link";
import type {ReactNode} from "react";
import DualTimestamp from "./DualTimestamp";
import EditorialStoryArt from "./EditorialStoryArt";
import s from "./StoryHeroAside.module.css";

/** Source-preserving, read-only article artwork and provenance block. */
export default function StoryHeroAside({
 headline,summary,category,sourceName,eventAt,sourceDate,secondary,
 backHref,backLabel,icon,
}:{
 headline:string;summary:string;category:string;sourceName?:string;
 eventAt?:string|null;sourceDate?:string|null;secondary?:string|null;
 backHref:string;backLabel:"Key Stories"|"Newsroom";icon?:ReactNode;
}){
 return <aside className={s.aside} aria-label="Story illustration, source details and navigation">
  <EditorialStoryArt headline={headline} summary={summary}/>
  <div className={s.meta} data-story-hero-meta="under-illustration">
   <div className={s.identity}>
    {icon?<div className={s.icon}>{icon}</div>:null}
    <div><p className={s.category}>{category}</p>
     {sourceName?<strong className={s.name}>{sourceName}</strong>:null}
    </div>
   </div>
   {eventAt||sourceDate?<div className={s.event}>
    <span className={s.eventLabel}>Original event</span>
    <DualTimestamp value={eventAt||null} sourceDate={sourceDate||null}/>
   </div>:null}
   {secondary?<p className={s.secondary}>{secondary}</p>:null}
   <Link className={s.returnButton} href={backHref}>← Return to {backLabel}</Link>
  </div>
 </aside>;
}
