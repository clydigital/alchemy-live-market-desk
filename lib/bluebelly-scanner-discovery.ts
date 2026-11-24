import type {PublicMarketObservation as Row} from "./blue-desk-public-markets.ts";
import {buildMarketDivergenceWatch} from "./bluebelly-market-divergence-watch.ts";
import {selectMeasuredMarketSignals} from "./bluebelly-measured-market-signals.ts";

const sectorFor:Record<string,string>={
 NVDA:"XLK",AMD:"XLK",AAPL:"XLK",MSFT:"XLK",AVGO:"XLK",MU:"XLK",ORCL:"XLK",ADBE:"XLK",
 AMZN:"XLY",TSLA:"XLY",GOOGL:"XLC",META:"XLC",CI:"XLV",CVS:"XLV",
 CF:"XLB",XOM:"XLE",CVX:"XLE",PWR:"XLI",BWXT:"XLI",
};
export const XL_SECTORS=["XLB","XLC","XLE","XLF","XLI","XLK","XLP","XLRE","XLU","XLV","XLY"] as const;
export type ScannerCandidate={symbol:string;label:string;asOf:string;detail:string;sourceUrl:string;comparisonUrl?:string;nextTest:string;score:number};
const signed=(n:number)=> (n>0?"+":"")+n.toFixed(2);
function valid(row:Row,now:Date,maxAge=4){
 if(row.frequency!=="daily"||row.dataStatus==="UNAVAILABLE_OR_STALE"||row.changeUnit!=="%"||
  !row.asOf||!/^\d{4}-\d{2}-\d{2}$/.test(row.asOf)||row.last===null||!Number.isFinite(row.last)||
  row.change===null||!Number.isFinite(row.change)||!row.sourceUrl)return false;
 const t=Date.parse(row.asOf+"T00:00:00Z");if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==row.asOf||t>+now||+now-t>maxAge*86400000)return false;
 try{const u=new URL(row.sourceUrl);return u.protocol==="https:"&&!u.username&&!u.password;}catch{return false;}
}
function stock(row:Row){return ["MAG7","US Stock","Europe Stock"].includes(row.type)||row.type==="AI / Semis"&&Object.prototype.hasOwnProperty.call(sectorFor,row.symbol);}
function hasFive(r:Row){return r.change5d!==null&&Number.isFinite(r.change5d);}
export function buildScannerDiscovery(rows:readonly Row[],now=new Date(),sectorRows:readonly Row[]=rows,expectedSectorSession:string|null=null,failedSectorSymbols:readonly string[]=[]){
 const available=rows.filter(r=>valid(r,now));
 // Anchor to a source-dated US equity session, not a newer UTC crypto/FX bar.
 const session=available.filter(r=>r.symbol==="RSP"||r.type==="Sector"||r.type==="MAG7"||r.type==="US Stock").map(r=>r.asOf!).sort().at(-1)??null;
 const matched=new Map<string,Row>();
 for(const r of available)if(r.asOf===session&&!matched.has(r.symbol))matched.set(r.symbol,r);
 const current=[...matched.values()];
 const same=(symbol:string)=>current.find(r=>r.symbol===symbol);
 const candidate=(r:Row,detail:string,nextTest:string,score:number,comparison?:Row):ScannerCandidate=>({
  symbol:r.symbol,label:r.label,asOf:r.asOf!,sourceUrl:r.sourceUrl!,detail,nextTest,score,
  ...(comparison?{comparisonUrl:comparison.sourceUrl!}:{}),
 });
 const top=(list:ScannerCandidate[])=>list.sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol)).slice(0,5);
 const laggards:ScannerCandidate[]=[],rotation:ScannerCandidate[]=[],rebound:ScannerCandidate[]=[];
 for(const r of current){
  if(stock(r)){
   const sector=same(sectorFor[r.symbol]);
   if(sector&&sector.type==="Sector"&&hasFive(r)&&hasFive(sector)){
    const gap=r.change5d!-sector.change5d!;
    if(gap<=-2)laggards.push(candidate(r,"5D "+signed(r.change5d!)+"% vs "+sector.symbol+" "+signed(sector.change5d!)+"% ("+signed(gap)+" pp).","Verify positive earnings and free cash flow, valuation versus peers, and a price reversal before calling this quality.",-gap,sector));
   }
   const scan=r.screening;
   if(scan&&scan.asOf===r.asOf&&scan.volume.state==="up-surge"&&scan.volume.multiple!==null&&Number.isFinite(scan.volume.multiple)&&scan.volume.multiple>=1.5&&r.change!>0&&
    (scan.stoch.turn==="bullish"||scan.breakout["20"].state==="up"||scan.squeeze.state==="expanding-up")){
    rebound.push(candidate(r,signed(r.change!)+"% today; "+scan.volume.multiple.toFixed(2)+"× 20-session average volume; bullish technical trigger.","Verify current settlement short float, days to cover and float changes; momentum alone does not establish a squeeze.",scan.volume.multiple));
   }
  }
  if(r.type==="Sector"){
   const base=same("RSP");if(!base||!hasFive(r)||!hasFive(base)||r.change3d===null||base.change3d===null||!Number.isFinite(r.change3d)||!Number.isFinite(base.change3d))continue;
   const gap1=r.change!-base.change!,gap3=r.change3d-base.change3d,gap5=r.change5d!-base.change5d!;
   if(gap1>=0.5&&gap3>0&&gap5<=0)rotation.push(candidate(r,"1D "+signed(gap1)+" pp; 3D "+signed(gap3)+" pp; 5D "+signed(gap5)+" pp vs RSP.","Look for sustained relative strength and constituent participation on the next pullback; invalidate if relative gains reverse.",gap1+gap3,base));
  }
 }
 const divergence=selectMeasuredMarketSignals(buildMarketDivergenceWatch(current,"1D"),"1D",now,5);
 const cross:ScannerCandidate[]=divergence.map(d=>({symbol:d.left+" / "+d.right,label:d.title,asOf:d.sourceSession,detail:signed(d.leftChange)+"% vs "+signed(d.rightChange)+"% · "+signed(d.gapPp)+" pp",nextTest:d.nextTest,sourceUrl:d.leftSourceUrl,comparisonUrl:d.rightSourceUrl,score:Math.abs(d.gapPp)}));
 // Use US-listed ETFs for matched equity-session comparisons; do not equate ETF returns with spot Bitcoin or cash index returns.
 for(const [a,b,label,next] of [
  ["IBIT","QQQ","Bitcoin ETF vs Nasdaq ETF","Check spot BTC, liquidations, open interest and ETF flows separately."],
  ["GLD","QQQ","Gold ETF vs Nasdaq ETF","Check real yields and USD separately."],
  ["HYG","QQQ","High-yield bond ETF vs Nasdaq ETF","Check actual credit spreads; bond ETF prices also reflect rates."],
 ] as const){
  const left=same(a),right=same(b);if(!left||!right)continue;
  const gap=left.change!-right.change!;
  if(left.change!*right.change!>=0&&Math.abs(gap)<2)continue;
  cross.push(candidate(left,signed(left.change!)+"% vs "+b+" "+signed(right.change!)+"% · "+signed(gap)+" pp",next,Math.abs(gap),right));
  cross[cross.length-1].symbol=a+" / "+b;cross[cross.length-1].label=label;
 }
 // Sector display has its own session; do not change the live scanner's signal dates.
 const bySession=new Map<string,Map<string,Row>>();
 for(const r of sectorRows){
  if(r.type!=="Sector"||!(XL_SECTORS as readonly string[]).includes(r.symbol)||!valid(r,now,Infinity)||!r.asOf||(expectedSectorSession&&r.asOf>expectedSectorSession))continue;
  const group=bySession.get(r.asOf)??new Map<string,Row>();
  if(!group.has(r.symbol))group.set(r.symbol,r);
  bySession.set(r.asOf,group);
 }
 const ordered=[...bySession].sort((a,b)=>b[0].localeCompare(a[0]));
 const selected=ordered.find(([,group])=>group.size===XL_SECTORS.length)??ordered[0];
 const sectorSession=selected?.[0]??null;
 const sectorDelayed=Boolean(sectorSession&&(expectedSectorSession??session)&&sectorSession<(expectedSectorSession??session)!);
 const sectors=XL_SECTORS.map(symbol=>{
  const r=selected?.[1].get(symbol);
  const status=r?(sectorDelayed?"delayed":"available"):failedSectorSymbols.includes(symbol)?"provider-failed":"missing";
  return {symbol,label:r?.label??symbol,change:r?.change??null,sourceUrl:r?.sourceUrl??null,status};
 });
 const movers=current.filter(stock).sort((a,b)=>b.change!-a.change!||a.symbol.localeCompare(b.symbol));
 return {session,sectorSession,sectorDelayed,sectorProviderFailures:failedSectorSymbols.length,coverage:current.length,stockCoverage:movers.length,sectors,laggards:top(laggards),rotation:top(rotation),rebound:top(rebound),cross:top(cross),
 gainers:movers.filter(r=>r.change!>0).slice(0,5).map(r=>candidate(r,signed(r.change!)+"%","Check original catalyst and follow-through.",r.change!)),
 losers:movers.filter(r=>r.change!<0).slice(-5).reverse().map(r=>candidate(r,signed(r.change!)+"%","Check original catalyst and whether weakness persists.",-r.change!)),
 quiet:movers.slice().sort((a,b)=>Math.abs(a.change!)-Math.abs(b.change!)).slice(0,5).map(r=>candidate(r,signed(r.change!)+"%","Low absolute price change, not low trading volume.",Math.abs(r.change!)))};
}
