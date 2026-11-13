import type {SignalTag,SignalTagId} from "@/lib/bluebelly-signal-tags";
import s from "./SignalTags.module.css";
export default function SignalTags({tags,limit=2}:{tags:readonly SignalTag[];limit?:number}){
 if(!tags.length)return null;
 return <div className={s.wrap} aria-label="Research signal tags">
  {tags.slice(0,limit).map(tag=><span key={tag.id} className={s.tag}
    data-signal-tag={tag.id} data-signal-status={tag.state}
    title={tag.state==="QUESTION"?"Research question only — not a verified anomaly or investment judgement":tag.state==="MEASURED_RELATIVE"?"Observed matched-session return gap; not a proven correlation break, issuer mispricing or trade signal":"Qualified source-dated price/fundamental comparison; not a fair value conclusion"}>
    {tag.label}{tag.state==="QUESTION"?" · CHECK":tag.state==="MEASURED_RELATIVE"?" · MEASURED":" · CANDIDATE"}
   </span>)}
 </div>;
}
export type {SignalTagId};
