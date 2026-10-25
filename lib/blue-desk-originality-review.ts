/** Deterministic duplicate-phrase warning for source-fed editorial drafts.
 * Not an external plagiarism detector and not proof of copyright clearance. */
export type OriginalityReview={
 status:"REVIEW_SOURCE_OVERLAP"|"NO_LONG_EXACT_OVERLAP_DETECTED";
 longestMatchedWords:number;thresholdWords:number;note:string;
};
const words=(text:string)=>text.toLowerCase().match(/[a-z0-9]+(?:['’][a-z0-9]+)?/g)||[];
export function reviewSourceOverlap(draft:string,packet:string,thresholdWords=12):OriginalityReview{
 const threshold=Math.max(8,Math.min(24,Math.trunc(thresholdWords)));
 const d=words(draft),p=words(packet);
 const note="Checks only long exact phrasing shared with the supplied research packet. It does not search the internet, verify source rights or guarantee originality.";
 if(d.length<threshold||p.length<threshold)
  return {status:"NO_LONG_EXACT_OVERLAP_DETECTED",longestMatchedWords:0,thresholdWords:threshold,note};
 const index=new Map<string,number[]>();
 for(let i=0;i<p.length;i++){
  const w=p[i],loc=index.get(w)||[];
  if(loc.length<80){loc.push(i);index.set(w,loc);}
 }
 let longest=0;
 for(let i=0;i<d.length;i++){
  const locations=index.get(d[i])||[];
  for(const start of locations){
   let matched=0;
   while(i+matched<d.length&&start+matched<p.length&&
     d[i+matched]===p[start+matched]&&matched<100)matched++;
   if(matched>longest)longest=matched;
   if(longest>=100)break;
  }
  if(longest>=100)break;
 }
 return {status:longest>=threshold?"REVIEW_SOURCE_OVERLAP":"NO_LONG_EXACT_OVERLAP_DETECTED",
  longestMatchedWords:longest,thresholdWords:threshold,note};
}
