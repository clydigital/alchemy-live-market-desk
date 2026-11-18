/** Public daily-close CSV fallback for US-listed securities only.
 * Never infer exchange/currency for foreign listings. A stale/malformed response is rejected.
 * This is a best-effort secondary source, not an exchange-authoritative live quote.
 */
export type DailyClose = {price:number;observedOn:string;sourceUrl:string;sourceName:string};
export async function fetchStooqDailyClose(ticker:string, now=new Date()):Promise<DailyClose|null> {
  if(!/^[A-Z][A-Z0-9.-]{0,11}$/.test(ticker) || ticker.includes(".")) return null;
  const symbol=ticker.toLowerCase()+".us";
  const from=new Date(now.getTime()-9*86400000).toISOString().slice(0,10).replace(/-/g,"");
  const to=now.toISOString().slice(0,10).replace(/-/g,"");
  const url="https://stooq.com/q/d/l/?s="+encodeURIComponent(symbol)+"&i=d&d1="+from+"&d2="+to;
  try {
    const res=await fetch(url,{headers:{"Accept":"text/csv","User-Agent":"BluebellyResearch/1.0 (daily historical close)"},signal:AbortSignal.timeout(7000),cache:"no-store"});
    if(!res.ok) return null;
    const body=await res.text();
    if(body.length>250000 || !body.startsWith("Date,Open,High,Low,Close")) return null;
    const lines=body.trim().split(/\r?\n/);
    const fields=lines[lines.length-1]?.split(",")??[];
    const date=fields[0], price=Number(fields[4]);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(price)||price<=0) return null;
    const ms=Date.parse(date+"T00:00:00Z");
    if(ms>Date.now()+86400000 || now.getTime()-ms>5*86400000) return null;
    return {price,observedOn:date,sourceUrl:url,sourceName:"Stooq daily historical close (fallback)"};
  } catch {return null;}
}
