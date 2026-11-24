import type { MarketMonitorRow } from "./market-monitor.ts";
import type { BreadthSeries } from "./bluebelly-breadth-dated.ts";
import {expectedCompletedUsWeekdaySessionDay} from "./bluebelly-daily-report-session.ts";
import {scheduledUsEquityCloseHourET} from "./bluebelly-us-equity-trading-calendar.ts";

type Point = {date:string;value:number};
type Source = {label:string;url:string};
type Rule = {id:string;a:string;b:string;title:string;family:string;chart:string;test:string;threshold:number};
export const RADAR_PAIRS: readonly Rule[] = [
 {id:"defensive",a:"xlp",b:"xlk",title:"Defensives vs technology",family:"Rotation",chart:"XLP/XLK · daily + weekly",test:"Check whether the relative trend turns and both absolute price structures agree.",threshold:3},
 {id:"chips",a:"smh",b:"ndx",title:"Chips vs Nasdaq",family:"AI",chart:"SMH/QQQ · daily + weekly",test:"Check chip guidance, breadth and whether the relative trend holds.",threshold:3},
 {id:"ai",a:"aiq",b:"spx-proxy",title:"AI vs broad equities",family:"AI",chart:"AIQ/SPY · daily + weekly",test:"Check AI earnings, capex, cash conversion and trend reclaims.",threshold:3},
 {id:"software",a:"igv",b:"smh",title:"Software vs hardware",family:"AI",chart:"IGV/SMH · daily",test:"Compare monetisation and hardware order revisions.",threshold:3},
 {id:"memory",a:"mu",b:"smh",title:"Memory vs semiconductors",family:"AI",chart:"MU/SMH · daily",test:"Compare memory pricing and guidance; inspect relative support.",threshold:5},
 {id:"broad",a:"rsp",b:"spx-proxy",title:"Equal vs cap weight",family:"Participation",chart:"RSP/SPY · daily + weekly",test:"Check breadth and small-cap participation before calling a broad recovery.",threshold:2},
 {id:"small",a:"russell",b:"spx-proxy",title:"Small caps vs large caps",family:"Participation",chart:"IWM/SPY · daily",test:"Compare small-business credit and earnings with breadth.",threshold:3},
 {id:"consumer",a:"xly",b:"xlp",title:"Discretionary vs staples",family:"Consumer",chart:"XLY/XLP · daily + weekly",test:"Check equal-weight consumer ETFs, constituent earnings and spending; mega-cap concentration can distort XLY.",threshold:3},
 {id:"consumer-equal-staples",a:"rspd",b:"rsps",title:"Equal-weight discretionary vs staples",family:"Consumer",chart:"RSPD/RSPS · daily + weekly",test:"Check retail volumes and earnings without cap-weight concentration.",threshold:2},
 {id:"consumer-equal",a:"rspd",b:"xly",title:"Equal-weight consumer vs headline",family:"Consumer",chart:"RSPD/XLY · daily",test:"Check constituent weights and underlying participation.",threshold:2},
 {id:"credit",a:"hyg",b:"lqd",title:"High yield vs investment grade",family:"Credit",chart:"HYG/LQD · daily; HY and CCC OAS",test:"Check official spreads and duration differences before inferring financing stress.",threshold:1},
 {id:"duration",a:"xlre",b:"spx-proxy",title:"Real estate vs equities",family:"Rates",chart:"XLRE/SPY · daily + weekly",test:"Check long yields, financing and actual property demand.",threshold:3},
 {id:"gold-copper",a:"copper",b:"gold-proxy",title:"Copper vs gold ETF proxies",family:"Commodities",chart:"CPER/GLD · daily + weekly",test:"Check physical inventories and demand; futures roll and ETF structure matter.",threshold:3},
 {id:"financial-tech",a:"xlf",b:"xlk",title:"Financials vs technology",family:"Rotation",chart:"XLF/XLK · daily + weekly",test:"Compare the yield curve, provisions and technology earnings revisions.",threshold:3},
 {id:"gold-dollar",a:"gold-proxy",b:"dxy",title:"Gold vs dollar ETF proxy",family:"FX / metals",chart:"GLD/UUP · daily; spot XAUUSD and DXY",test:"Check real yields and spot dollar/gold; these are ETF price proxies.",threshold:2},
 {id:"energy",a:"xle",b:"spx-proxy",title:"Energy vs broad equities",family:"Energy",chart:"XLE/SPY · daily + weekly",test:"Check crude, refining margins, inventories and issuer exposure.",threshold:3},
 {id:"crypto",a:"btc-proxy",b:"ndx",title:"Bitcoin proxy vs Nasdaq",family:"Liquidity",chart:"IBIT/QQQ · daily",test:"Check spot BTC flows and credit; ETF sessions exclude weekend trading.",threshold:4},
];
const DAY=86400000;
const finite=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v);
const fresh=(date:string,now:Date)=>{const n=Date.parse(date+"T00:00:00Z");return Number.isFinite(n)&&+now>=n&&+now-n<=6*DAY;};
const validUrl=(raw:string)=>{try{const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password;}catch{return false;}};
const round=(v:number)=>Math.round(v*100)/100;
function clean(points:readonly Point[]):Point[]{
 const map=new Map<string,number>();
 for(const p of points)if(/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&finite(p.value)&&Number.isFinite(Date.parse(p.date)))map.set(p.date,p.value);
 return [...map].map(([date,value])=>({date,value})).sort((a,b)=>a.date.localeCompare(b.date));
}
function history(r:MarketMonitorRow|undefined,now:Date,level=false):Point[]{
 if(!r||r.frequency!=="daily"||!r.asOf||!fresh(r.asOf,now)||!validUrl(r.sourceUrl)||!finite(r.last))return [];
 const expected=expectedCompletedUsWeekdaySessionDay(now);
 if(!expected||r.asOf>expected)return [];
 const points=clean(r.points.flatMap(p=>{
  if(!finite(p.time)||!finite(p.close)||(!level&&p.close<=0))return [];
  const d=new Date(p.time*1000);if(!Number.isFinite(+d)||+d>+now)return [];
  const date=d.toISOString().slice(0,10);return date<=r.asOf!?[{date,value:p.close}]:[];
 }));
 const last=points.at(-1);
 return last&&last.date===r.asOf&&Math.abs(last.value-r.last)<=Math.max(0.00001,Math.abs(r.last)*0.000001)?points:[];
}
function aligned(a:Point[],b:Point[],count:number):[Point[],Point[]]|null{
 if(a.length<count||b.length<count)return null;
 const x=a.slice(-count),y=b.slice(-count);
 return x.every((p,i)=>p.date===y[i].date)&&contiguous(x)?[x,y]:null;
}
// Require every scheduled regular US cash-equity session; unexpected closures remain coverage gaps.
function contiguous(p:Point[]){
 return p.every((v,i)=>{
  if(scheduledUsEquityCloseHourET(v.date)===null)return false;
  if(i===0)return true;
  const start=Date.parse(p[i-1].date),end=Date.parse(v.date);
  if(end-start>7*DAY)return false;
  for(let t=start+DAY;t<end;t+=DAY)if(scheduledUsEquityCloseHourET(new Date(t).toISOString().slice(0,10))!==null)return false;
  return true;
 });
}
function ret(a:Point[],start:number,end:number){return (a[end].value/a[start].value-1)*100;}
function corr(a:Point[],b:Point[]){
 const x=a.slice(1).map((p,i)=>p.value/a[i].value-1),y=b.slice(1).map((p,i)=>p.value/b[i].value-1);
 const mx=x.reduce((s,v)=>s+v,0)/x.length,my=y.reduce((s,v)=>s+v,0)/y.length;
 let xx=0,yy=0,xy=0;
 for(let i=0;i<x.length;i++){const u=x[i]-mx,v=y[i]-my;xx+=u*u;yy+=v*v;xy+=u*v;}
 return xx>0&&yy>0?Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy))):null;
}
export type RadarLead = {id:string;family:string;title:string;asOf:string;kind:"RELATIVE"|"BREADTH"|"CORRELATION"|"CREDIT"|"RATES";summary:string;chart:string;nextTest:string;score:number;sources:Source[];metrics:{label:string;value:number;unit:string}[]};
export type RadarWindow={window:"1D"|"3D"|"5D";left:number;right:number;gap:number;asOf:string};
export type RadarCheck={id:string;title:string;family:string;chart:string;nextTest:string;leftLabel?:string;rightLabel?:string;windows:RadarWindow[];asOf:string|null;metrics:RadarLead["metrics"];sources:Source[];historyAvailable:boolean};
export type RadarRead={generatedAt:string;leads:RadarLead[];checks:RadarCheck[];coverage:{checked:number;eligible:number;missing:string[]};limitations:string[]};
const signed=(n:number)=> (n>0?"+":"")+round(n).toFixed(2);
export function buildDivergenceRadar(rows:readonly MarketMonitorRow[],breadth:readonly BreadthSeries[],now=new Date()):RadarRead{
 const leads:RadarLead[]=[],checks:RadarCheck[]=[],missing:string[]=[];let eligible=0;
 const by=new Map(rows.map(r=>[r.id,r]));
 const hs=new Map<string,Point[]>();
 const get=(id:string)=>{if(!hs.has(id))hs.set(id,history(by.get(id),now));return hs.get(id)!;};
 // Additional sector discoveries; one per sector, ranked with curated pairs.
 const rules:Rule[]=[...RADAR_PAIRS,...["xlb","xlc","xle","xlf","xli","xlk","xlp","xlre","xlu","xlv","xly"].filter(a=>a!=="xle"&&a!=="xlre").map(a=>({id:a+"-broad",a,b:"spx-proxy",title:a.toUpperCase()+" vs broad equities",family:"Rotation",chart:a.toUpperCase()+"/SPY · daily",test:"Check constituent participation, earnings revisions and the next matched close.",threshold:3}))];
 for(const r of rules){
  const a=get(r.a),b=get(r.b),m=aligned(a,b,11);
  const sourceA=by.get(r.a),sourceB=by.get(r.b);
  const sources=[sourceA,sourceB].flatMap(source=>source&&validUrl(source.sourceUrl)?[{label:source.label,url:source.sourceUrl}]:[]);
  const windows:RadarWindow[]=([1,3,5] as const).flatMap(n=>{const v=aligned(a,b,n+1);if(!v)return [];
   const left=ret(v[0],0,n),right=ret(v[1],0,n);
   return [{window:(n+"D") as RadarWindow["window"],left:round(left),right:round(right),gap:round(left-right),asOf:v[0][n].date}];
  });
  const check:RadarCheck={id:r.id,title:r.title,family:r.family,chart:r.chart,nextTest:r.test,leftLabel:sourceA?.label??r.a.toUpperCase(),rightLabel:sourceB?.label??r.b.toUpperCase(),windows,asOf:windows[0]?.asOf??null,metrics:[],sources,historyAvailable:!!m};
  checks.push(check);
  if(!m){missing.push(r.title+" — 11 matching daily observations unavailable");continue;}
  eligible++;
  const [x,y]=m,asOf=x[10].date;
  const one=ret(x,9,10)-ret(y,9,10),three=ret(x,7,10)-ret(y,7,10),ten=ret(x,0,10)-ret(y,0,10),latest=ret(x,5,10)-ret(y,5,10),prior=ret(x,0,5)-ret(y,0,5),delta=latest-prior;
  const m20=aligned(a,b,21),long=m20?ret(m20[0],0,20)-ret(m20[1],0,20):null;
  const reversal=latest*prior<0&&Math.abs(delta)>=r.threshold;
  const dayFlip=one*latest<0&&Math.abs(one)>=r.threshold/2;
  const longFlip=long!==null&&long*latest<0&&Math.abs(latest)>=r.threshold;
  const strength=Math.max(Math.abs(latest)/r.threshold,Math.abs(delta)/(r.threshold*1.5),Math.abs(one)/(r.threshold/2));
  {
   const metrics=[{label:"1 session",value:round(one),unit:"pp"},{label:"3 sessions",value:round(three),unit:"pp"},{label:"Latest 5",value:round(latest),unit:"pp"},{label:"Prior 5",value:round(prior),unit:"pp"},{label:"5-session acceleration",value:round(delta),unit:"pp"},{label:"10 sessions",value:round(ten),unit:"pp"}];
   if(long!==null)metrics.push({label:"20 sessions",value:round(long),unit:"pp"});
   const m60=aligned(a,b,61);
   if(m60){
    const gaps=Array.from({length:55},(_,i)=>Math.abs(ret(m60[0],i,i+5)-ret(m60[1],i,i+5)));
    metrics.push({label:"60 sessions",value:round(ret(m60[0],0,60)-ret(m60[1],0,60)),unit:"pp"},{label:"5-session gap percentile (55 prior overlapping samples)",value:round(100*gaps.filter(v=>v<=Math.abs(latest)).length/gaps.length),unit:"%"});
   }
   check.metrics.push(...metrics);
   if(strength>=1||reversal||dayFlip||longFlip)leads.push({id:r.id,family:r.family,title:r.title,asOf,kind:"RELATIVE",summary:(reversal?"Five-session relative leadership reversed. ":dayFlip?"Latest session opposes the five-session trend. ":longFlip?"Short- and medium-window leadership disagree. ":"Material relative move. ")+ "Latest 5 sessions "+signed(latest)+" pp vs prior 5 "+signed(prior)+" pp.",chart:r.chart,nextTest:r.test,score:Math.min(strength,5)+(reversal?1:0)+(dayFlip?0.5:0),sources,metrics});
  }
  const c=aligned(a,b,41);
  if(c){
   const prev=corr(c[0].slice(0,21),c[1].slice(0,21)),curr=corr(c[0].slice(20),c[1].slice(20));
   if(prev!==null&&curr!==null)check.metrics.push({label:"Prior 20D correlation",value:round(prev),unit:"r"},{label:"Latest 20D correlation",value:round(curr),unit:"r"},{label:"Correlation change",value:round(curr-prev),unit:"r"});
   if(prev!==null&&curr!==null&&Math.abs(curr-prev)>=0.35){
    leads.push({id:r.id+"-corr",family:r.family,title:r.title+" · correlation shift",asOf,kind:"CORRELATION",summary:"Daily-return correlation changed from "+prev.toFixed(2)+" to "+curr.toFixed(2)+" across adjacent non-overlapping 20-return samples.",chart:r.chart,nextTest:"Investigate possible changing drivers and repeat the next sample; no statistical significance or causal break is implied.",score:Math.min(Math.abs(curr-prev)/0.35,5),sources,metrics:[{label:"Prior 20",value:round(prev),unit:"r"},{label:"Latest 20",value:round(curr),unit:"r"},{label:"Change",value:round(curr-prev),unit:"r"}]});
   }
  }else missing.push(r.title+" — correlation history unavailable");
 }
 const spreadRules=[{id:"hy-oas",title:"High-yield credit spreads",family:"Credit",chart:"ICE BofA US HY OAS · daily",test:"Compare credit widening with the same-session equity response and financing conditions.",threshold:20},{id:"ccc-oas",title:"CCC and lower credit spreads",family:"Credit",chart:"ICE BofA CCC OAS · daily",test:"Check whether speculative credit confirms or contradicts the equity rebound.",threshold:35}];
 for(const r of spreadRules){
  const source=by.get(r.id),p=history(source,now,true).slice(-11);
  if(!source||p.length<11||!contiguous(p)){missing.push(r.title+" — matching daily history unavailable");continue;}
  eligible++;
  const one=(p[10].value-p[9].value)*100,latest=(p[10].value-p[5].value)*100,prior=(p[5].value-p[0].value)*100,delta=latest-prior;
  const strength=Math.max(Math.abs(one)/(r.threshold/2),Math.abs(latest)/r.threshold,Math.abs(delta)/r.threshold);
  {
   const equity=aligned(p,get("spx-proxy"),6);const eq=equity?ret(equity[1],0,5):null;
   const opposite=eq!==null&&eq>0&&latest>0;
   const metrics=[{label:"Spread level",value:round(p[10].value),unit:"%"},{label:"1 session",value:round(one),unit:"bp"},{label:"Latest 5",value:round(latest),unit:"bp"},{label:"Prior 5",value:round(prior),unit:"bp"}];
   if(eq!==null)metrics.push({label:"SPY latest 5",value:round(eq),unit:"%"});
   metrics.push({label:"3 sessions",value:round((p[10].value-p[7].value)*100),unit:"bp"},{label:"Acceleration",value:round(delta),unit:"bp"});
   checks.push({id:r.id,title:r.title,family:r.family,chart:r.chart,nextTest:r.test,windows:[],asOf:p[10].date,metrics,sources:[{label:source.label,url:source.sourceUrl}],historyAvailable:true});
   if(strength>=1)leads.push({id:r.id,family:r.family,title:r.title,asOf:p[10].date,kind:"CREDIT",summary:(opposite?"Equities rose while credit spreads widened. ":"Credit spread change. ")+ "Latest 5 "+signed(latest)+" bp vs prior 5 "+signed(prior)+" bp."+(eq===null?" Equity session unmatched.":""),chart:r.chart,nextTest:r.test,score:Math.min(strength,5)+(opposite?1:0),sources:[{label:source.label,url:source.sourceUrl},...(eq!==null?[{label:by.get("spx-proxy")!.label,url:by.get("spx-proxy")!.sourceUrl}]:[])],metrics});
  }
 }
 const two=by.get("us2y"),thirty=by.get("us30y");
 const curve=aligned(history(two,now,true),history(thirty,now,true),11);
 if(curve&&two&&thirty){
  eligible++;
  const spread=curve[0].map((p,i)=>(p.value-curve[1][i].value)*100);
  const latest=spread[10]-spread[5],prior=spread[5]-spread[0],one=spread[10]-spread[9],delta=latest-prior;
  const strength=Math.max(Math.abs(one)/8,Math.abs(latest)/15,Math.abs(delta)/15);
  const curveMetrics=[{label:"Spread",value:round(spread[10]),unit:"bp"},{label:"1 session",value:round(one),unit:"bp"},{label:"3 sessions",value:round(spread[10]-spread[7]),unit:"bp"},{label:"Latest 5",value:round(latest),unit:"bp"},{label:"Prior 5",value:round(prior),unit:"bp"},{label:"Acceleration",value:round(delta),unit:"bp"},{label:"2Y latest 5",value:round((curve[0][10].value-curve[0][5].value)*100),unit:"bp"},{label:"30Y latest 5",value:round((curve[1][10].value-curve[1][5].value)*100),unit:"bp"}];
  checks.push({id:"yield-curve",title:"US 2Y minus 30Y yield spread",family:"Rates",chart:"US02Y − US30Y · daily",nextTest:"Check individual yields, real yields, Fed repricing and the matched gold reaction.",windows:[],asOf:curve[0][10].date,metrics:curveMetrics,sources:[{label:two.label,url:two.sourceUrl},{label:thirty.label,url:thirty.sourceUrl}],historyAvailable:true});
  if(strength>=1)leads.push({id:"yield-curve",family:"Rates",title:"US 2Y minus 30Y yield spread",asOf:curve[0][10].date,kind:"RATES",summary:"Front-end minus long-end spread changed "+signed(latest)+" bp in the latest five sessions vs "+signed(prior)+" bp previously. Distinguish front-end repricing from long-end moves.",chart:"US02Y − US30Y · daily; gold and DXY",nextTest:"Check which yield moved, real yields, Fed repricing and the matched gold reaction; no fixed inverse relationship is assumed.",score:Math.min(strength,5),sources:[{label:two.label,url:two.sourceUrl},{label:thirty.label,url:thirty.sourceUrl}],metrics:[{label:"Spread",value:round(spread[10]),unit:"bp"},{label:"Latest 5",value:round(latest),unit:"bp"},{label:"Prior 5",value:round(prior),unit:"bp"},{label:"2Y latest 5",value:round((curve[0][10].value-curve[0][5].value)*100),unit:"bp"},{label:"30Y latest 5",value:round((curve[1][10].value-curve[1][5].value)*100),unit:"bp"}]});
 }else missing.push("US 2Y minus 30Y — matched yield history unavailable");
 const breadthSymbols=["S5FI","S5TH","NDFI","NDTH","R2FI","R2TH"];
 for(const symbol of breadthSymbols){
  const s=breadth.find(v=>v.symbol===symbol);
  const p=s?clean(s.points.filter(v=>finite(v.value)&&v.value>=0&&v.value<=100)).filter(v=>Date.parse(v.date)<=+now):[];
  if(!s||!validUrl(s.sourceUrl)||p.length<11||!fresh(p.at(-1)!.date,now)||p.at(-1)!.date>(expectedCompletedUsWeekdaySessionDay(now)??"")||!contiguous(p.slice(-11))){missing.push(symbol+" — 11 same-series breadth observations unavailable");continue;}
  eligible++;
  const v=p.slice(-11),one=v[10].value-v[9].value,latest=v[10].value-v[5].value,prior=v[5].value-v[0].value,delta=latest-prior;
  const strength=Math.max(Math.abs(one)/5,Math.abs(latest)/8,Math.abs(delta)/8);
  const breadthMetrics=[{label:"Level",value:round(v[10].value),unit:"%"},{label:"1 session",value:round(one),unit:"pp"},{label:"3 sessions",value:round(v[10].value-v[7].value),unit:"pp"},{label:"Latest 5",value:round(latest),unit:"pp"},{label:"Prior 5",value:round(prior),unit:"pp"},{label:"Acceleration",value:round(delta),unit:"pp"}];
  checks.push({id:"breadth-"+symbol,title:symbol+" · participation change",family:"Participation",chart:symbol+" · daily breadth",nextTest:"Confirm against equal-weight indices, credit and the next same-series release.",windows:[],asOf:v[10].date,metrics:breadthMetrics,sources:[{label:s.sourceName,url:s.sourceUrl}],historyAvailable:true});
  if(strength>=1)leads.push({id:"breadth-"+symbol,family:"Participation",title:symbol+" · participation change",asOf:v[10].date,kind:"BREADTH",summary:(one*latest<0?"Latest session opposes the five-session trend. ":"Material participation change. ")+"Latest 5 "+signed(latest)+" pp vs prior 5 "+signed(prior)+" pp.",chart:symbol+" · daily breadth",nextTest:"Confirm using the next same-series release and matched RSP/SPY, SMH/QQQ and credit; proxy membership can differ from the official index.",score:Math.min(strength,5)+(one*latest<0?1:0),sources:[{label:s.sourceName,url:s.sourceUrl}],metrics:[{label:"Level",value:round(v[10].value),unit:"%"},{label:"1 session",value:round(one),unit:"pp"},{label:"Latest 5",value:round(latest),unit:"pp"},{label:"Prior 5",value:round(prior),unit:"pp"},{label:"Acceleration",value:round(delta),unit:"pp"}]});
 }
 const ranked=leads.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 // Diversify the first results instead of flooding the radar with one theme.
 const seen=new Set<string>(),first:RadarLead[]=[],rest:RadarLead[]=[];
 for(const lead of ranked){if(seen.has(lead.family))rest.push(lead);else{seen.add(lead.family);first.push(lead);}}
 return {generatedAt:now.toISOString(),leads:[...first,...rest],checks,coverage:{checked:rules.length+breadthSymbols.length+spreadRules.length+1,eligible,missing},limitations:["Screening thresholds are editorial heuristics, not statistical significance or trade signals.","Returns are price returns on identical scheduled daily observations; adjacent five-session windows share only their boundary close. Credit changes are basis points. No flow or causal inference.","Correlation compares separate 20-return samples; correlation gaps are disclosed independently from relative-return coverage. Historical gap percentiles are descriptive and use overlapping prior windows, not independent significance tests.","Breadth uses the existing permitted source series; full research history remains owner-gated. Missing values are not zero.","Fundamentals, creator views, physical flows and proprietary EMA annotations require separate agent-led investigation."]};
}
