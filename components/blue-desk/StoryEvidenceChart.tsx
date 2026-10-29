import type {PublicTrendCard} from "@/lib/blue-desk-whats-new-trends";
import {trendPolyline} from "@/lib/blue-desk-whats-new-trends";
import s from "./StoryEvidenceChart.module.css";

/** This is an actual dated source series. It does NOT assert event causation. */
export default function StoryEvidenceChart({card}:{card:PublicTrendCard}){
 const points=trendPolyline(card.points);
 if(card.status!=="ready"||!points||!card.sourceUrl)return null;
 const last=card.points.at(-1);
 const first=card.points[0];
 if(!first||!last)return null;
 const start=new Date(first.time*1000).toISOString().slice(0,10);
 const end=new Date(last.time*1000).toISOString().slice(0,10);
 const delta=card.changes.d1;
 const change=delta===null?"unavailable":(delta>0?"+":"")+delta.toFixed(2)+(card.unit==="bp"?" bp":"%");
 return <figure className={s.figure} data-story-evidence-chart={card.key}>
  <figcaption className={s.header}>
   <span>RELATED MARKET SERIES · NOT EVENT REACTION</span>
   <strong>{card.title} · {card.label}</strong>
  </figcaption>
  <svg className={s.chart} viewBox="0 0 300 100" role="img"
   aria-label={card.label+" source-dated closing levels from "+start+" through "+end+". Not a measured reaction to the story."}>
   <path d="M12 88H288" className={s.axis}/>
   <polyline className={s.line} points={points}/>
  </svg>
  <div className={s.meta}><span>Last observed {card.asOf} · 1 session {change}</span>
   <a href={card.sourceUrl} rel="noopener noreferrer" target="_blank">Original series ↗</a></div>
 </figure>;
}
