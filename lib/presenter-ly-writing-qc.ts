/**
 * Deterministic client-side LY copy checks. NOT an evidence validator and
 * NOT an editorial or publication approval.
 */
export type LyArticleKind = "COTD"|"OB";
export function checkLyPresenterDraft(kind:LyArticleKind,title:string,body:string,meta:string) {
 const words=body.trim()?body.trim().split(/\s+/).length:0;
 const paragraphs=body.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
 const longParagraphs=paragraphs.filter(x=>{
   // Approximation: punctuated prose sentences, excluding short decimals.
   const sentences=x.split(/(?<=[.!?])\s+(?=[A-Z"'(])/).filter(Boolean);
   return sentences.length>3;
 }).length;
 const banned=["cleaner read","call the top"];
 const hits=banned.filter(x=>body.toLowerCase().includes(x));
 const lines=body.split(/\n/);
 const explicitUrls=lines.filter(x=>/https:\/\/[^\s]+/.test(x)).length;
 const checks=[
   {key:"headline",pass:title.trim().length>0&&title.length<=63,detail:"Headline must be present and ≤63 characters."},
   {key:"meta",pass:meta.length<=150,detail:"Meta description must be ≤150 characters."},
   {key:"body",pass:kind==="COTD"?words>=600&&words<=800:words>=600,
     detail:kind==="COTD"?"COTD target 600–800 words; never >1,000.":"OB should develop several distinct causal angles; 600 words is only a minimum screening heuristic."},
   {key:"paragraphs",pass:longParagraphs===0,detail:"Use short read-aloud paragraphs, normally no more than three sentences."},
   {key:"banned",pass:hits.length===0,detail:"Avoid the established LY banned phrases."},
   {key:"original-sources",pass:explicitUrls>=1,detail:"Cite at least one actual original URL; this is not source verification."},
 ];
 return {kind,words,paragraphs:paragraphs.length,longParagraphs,bannedHits:hits,
   sourceUrlLines:explicitUrls,checks,passes:checks.filter(x=>x.pass).length};
}
