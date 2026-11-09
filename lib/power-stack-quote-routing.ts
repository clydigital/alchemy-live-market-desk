/** Exchange identification must use owner-supplied metadata, not a symbol guess.
 * Bare US/HK symbols or ambiguous numerical codes never go to a Malaysian provider.
 */
const SYMBOL=/^[A-Z0-9][A-Z0-9.\-]{0,17}$/;

type Item=Record<string,unknown>;
function objectItem(value:unknown):Item|null{
  return value && typeof value==="object" && !Array.isArray(value)
    ? value as Item : null;
}

export type TrackedQuote={ticker:string;bursaSymbol:string|null};

export function bursaSymbolForRow(raw:unknown):string|null{
  const row=objectItem(raw);
  if(!row || typeof row.ticker!=="string")return null;
  const ticker=row.ticker.trim().toUpperCase();
  if(!SYMBOL.test(ticker))return null;
  const pos=objectItem(row.position);
  const taggedMYR=String(pos?.currency??row.currency??"").trim().toUpperCase()==="MYR";
  const taggedMarket=["MY","MYX","BURSA","BURSA MALAYSIA"].includes(String(row.market??row.exchange??"").trim().toUpperCase());
  const suffix=/\.(?:KL|MY)$/.test(ticker);
  if(!taggedMYR&&!taggedMarket&&!suffix)return null;
  const clean=ticker.replace(/\.(?:KL|MY)$/,"");
  return /^[A-Z0-9][A-Z0-9\-]{1,17}$/.test(clean)?clean:null;
}

export function trackedFromSnapshot(snapshot:unknown):TrackedQuote[]{
  const row=objectItem(snapshot);
  if(!row)return [];
  const values=[...(Array.isArray(row.holdings)?row.holdings:[]),...(Array.isArray(row.watchlist)?row.watchlist:[])];
  const seen=new Set<string>();
  return values.flatMap(raw=>{
    const item=objectItem(raw);
    const ticker=typeof item?.ticker==="string"?item.ticker.trim().toUpperCase():"";
    if(!SYMBOL.test(ticker)||seen.has(ticker))return [];
    seen.add(ticker);
    return [{ticker,bursaSymbol:bursaSymbolForRow(raw)}];
  }).slice(0,250);
}
