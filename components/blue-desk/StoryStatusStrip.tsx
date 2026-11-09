import {getStorySnapshotStatus} from "@/lib/bluebelly-story-status";
import s from "./StoryStatusStrip.module.css";

export type StoryCheckpoint = {label:string;value:string;asOf:string};
export default function StoryStatusStrip({
  status,slug,updatedAt,now=new Date(),checkpoints,
}:{
  status:string;slug:string;updatedAt:string;now?:Date;
  checkpoints?:readonly StoryCheckpoint[];
}){
  const state=getStorySnapshotStatus({status,slug,updatedAt},now);
  return <div className={s.strip} data-story-freshness={state.freshness} aria-label="Story status and research freshness">
    <strong className={s.lifecycle}>{state.lifecycle}</strong>
    <span className={state.freshness==="review_due"?s.review:s.muted}>
      {state.freshness==="review_due"?"Research review due":state.freshness==="dated"?"Dated snapshot":"Date unavailable"}
    </span>
    {state.asOf?<time className={s.muted} dateTime={state.asOf}>Snapshot {state.asOf}</time>:null}
    {checkpoints?.map(item=><span className={s.checkpoint} key={item.label}>
      <b>{item.label}:</b> {item.value} <small>({item.asOf})</small>
    </span>)}
  </div>;
}
