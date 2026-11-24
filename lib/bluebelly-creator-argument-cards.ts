import type {CreatorTake} from "./bluebelly-creator-signals.ts";
export type ArgumentSource={key:string;publisher:string;title:string;videoId:string|null;publishedAt:string|null;sourceStatus:CreatorTake["sourceStatus"]};
const key=(s:string)=>s.trim().replace(/\s+/g," ").toLowerCase();
/** Preserve the natural sequence of each reviewed argument. Deduplicate exact
 * repeated statements within an edition, never across different speakers. */
export function uniqueResearchPoints(points:readonly string[]):string[]{
 const seen=new Set<string>();return points.filter(point=>{const k=key(point);if(!k||seen.has(k))return false;seen.add(k);return true;});
}
export function groupCreatorTakes(takes:readonly CreatorTake[]){
 const groups=new Map<string,{publisher:string;takes:CreatorTake[]}>();
 for(const take of takes){const k=key(take.publisher);let group=groups.get(k);if(!group){group={publisher:take.publisher,takes:[]};groups.set(k,group);}group.takes.push(take);}
 return [...groups.values()];
}
