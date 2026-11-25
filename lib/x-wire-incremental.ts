/** Public discovery delta: bounded receipt read, NOT timeline coverage or claim verification. */
export function parseXWireDeltaWindow(params:URLSearchParams,now:Date){
 const since=params.get("since"),until=params.get("until")||now.toISOString(),afterId=params.get("afterId");
 if(!since)return null;
 const start=Date.parse(since),end=Date.parse(until);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end>now.getTime()+1000||
    end-start>24*3_600_000||(afterId!==null&&(!params.has("until")||!/^\d{6,25}$/.test(afterId))))return null;
 return {since:new Date(start).toISOString(),until:new Date(end).toISOString(),afterId};
}
/** Caller queries 41 rows in stable post-ID order with a frozen retrieval cutoff. */
export function xWireDeltaPage<T extends {post_id:string}>(rows:readonly T[]){
 const page=rows.slice(0,40),more=rows.length>40;
 return {page,more,nextAfterId:more?page[page.length-1].post_id:null};
}
