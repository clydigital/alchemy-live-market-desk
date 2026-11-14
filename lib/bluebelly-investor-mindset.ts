import type {PublicMarketObservation} from "./blue-desk-public-markets";
import type {MarketDivergenceRead} from "./bluebelly-market-divergence-watch";
import type {MarketCompassSummary} from "./bluebelly-market-compass";
import type {NewsBriefV1} from "./market-brief-news";

/**
 * Read-only cross-asset decision prompts for the public homepage.
 * These are observations and testable investor-motivation QUESTIONS, never
 * an inferred flow ledger, model forecast, or canonical Regime rewrite.
 */
export type InvestorMindsetTone = "positive" | "negative" | "mixed" | "watch" | "unmeasured";
export type InvestorMindsetSource = Readonly<{name:string;url:string}>;
export type InvestorMindsetRow = Readonly<{
  id:"rates"|"chips"|"breadth"|"oil"|"catalyst";
  label:string;
  signal:string;
  measurement:string;
  question:string;
  nextTest:string;
  tone:InvestorMindsetTone;
  asOf:string|null;
  sources:readonly InvestorMindsetSource[];
  href:string;
}>;
export type InvestorMindsetSnapshot = Readonly<{
  tape:"RISK_ON"|"RISK_OFF"|"MIXED"|"UNMEASURED";
  tapeSession:string|null;
  rows:readonly InvestorMindsetRow[];
}>;

const DAY=86_400_000;
function sourceOk(value:string|null|undefined):value is string{
  if(!value)return false;
  try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port;}
  catch{return false;}
}
function sourceDate(value:string|null,now:Date,maxDays=6):boolean{
  if(!value || !Number.isFinite(now.getTime()))return false;
  const dt=Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+"T00:00:00Z":value);
  return Number.isFinite(dt)&&dt<=now.getTime()&&now.getTime()-dt<=maxDays*DAY;
}
function completedUsSession(date:string,now:Date):boolean{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!sourceDate(date,now))return false;
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",
    month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now);
  const get=(key:string)=>parts.find(x=>x.type===key)?.value??"";
  const nyDate=get("year")+"-"+get("month")+"-"+get("day");
  if(date>nyDate)return false;
  const weekday=new Date(date+"T12:00:00Z").getUTCDay();
  if(weekday===0||weekday===6)return false;
  return date<nyDate||Number(get("hour"))*60+Number(get("minute"))>=16*60+15;
}
function measured(row:PublicMarketObservation|undefined,now:Date):row is PublicMarketObservation{
  return Boolean(row&&row.frequency==="daily"&&row.dataStatus!=="UNAVAILABLE_OR_STALE"&&
    row.last!==null&&Number.isFinite(row.last)&&row.change!==null&&Number.isFinite(row.change)&&
    sourceDate(row.asOf,now)&&sourceOk(row.sourceUrl));
}
function paired(pair:MarketDivergenceRead|undefined,now:Date):pair is MarketDivergenceRead{
  return Boolean(pair&&pair.status!=="NOT_COMPARABLE"&&pair.gapPp!==null&&
    pair.leftChange!==null&&pair.rightChange!==null&&
    completedUsSession(pair.sourceSession??"",now)&&
    sourceOk(pair.leftSourceUrl)&&sourceOk(pair.rightSourceUrl));
}
const missing=(id:InvestorMindsetRow["id"],label:string,question:string,nextTest:string,href:string):InvestorMindsetRow=>({
  id,label,signal:"UNMEASURED",measurement:"Fresh comparable evidence unavailable",
  question,nextTest,tone:"unmeasured",asOf:null,sources:[],href
});
function signed(value:number,unit:"%"|"bp"):string{
  return (value>0?"+":"")+value.toFixed(unit==="bp"?1:2)+(unit==="bp"?" bp":"%");
}
export function buildInvestorMindsetSnapshot(
  markets:readonly PublicMarketObservation[],
  comparisons:readonly MarketDivergenceRead[],
  compass:MarketCompassSummary,
  news:readonly NewsBriefV1[],
  now:Date,
):InvestorMindsetSnapshot{
  const rows:InvestorMindsetRow[]=[];
  const twoYear=markets.find(x=>x.id==="us2y")??markets.find(x=>x.type==="Rates"&&(x.symbol==="DGS2"||x.id==="us2y-fred"));
  if(measured(twoYear,now)){
    const move=twoYear.change!;
    rows.push({id:"rates",label:"01 / RATES & CASH",
      signal:move>0?"YIELDS RISING":move<0?"YIELDS FALLING":"YIELDS FLAT",
      measurement:"US 2Y "+signed(move,"bp")+" · "+twoYear.last!.toFixed(2)+"% yield",
      question:move>0?"Are higher short-term yields encouraging investors to keep cash rather than take duration risk?":
        move<0?"Could lower front-end yields make risk assets more attractive, or is growth weakening?":
        "What would change the current reward for cash versus risk assets?",
      nextTest:"Fed-path repricing, real yields and whether equities confirm over multiple sessions.",
      tone:move>0?"negative":move<0?"positive":"mixed",asOf:twoYear.asOf,
      sources:[{name:twoYear.sourceName,url:twoYear.sourceUrl!}],href:"/blue-desk/markets?group=rates"});
  }else rows.push(missing("rates","01 / RATES & CASH","Is the relative reward for holding cash changing?",
    "Refresh US 2Y source observations and market-implied policy expectations.","/blue-desk/markets?group=rates"));

  const chips=comparisons.find(x=>x.id==="semis-vs-nasdaq");
  if(paired(chips,now)){
    const gap=chips.gapPp!;
    rows.push({id:"chips",label:"02 / AI & CHIPS",
      signal:gap>0?"CHIPS LEAD":gap<0?"CHIPS LAG":"MOVING TOGETHER",
      measurement:"SMH "+signed(chips.leftChange!,"%")+" · QQQ "+signed(chips.rightChange!,"%"),
      question:gap>0?"Is relative semiconductor strength supported by paid demand, or only a tactical rebound?":
        gap<0?"Are investors rotating out of chip exposure despite wider technology participation?":
        "Are investors treating AI hardware and the wider Nasdaq similarly?",
      nextTest:"Compare AI earnings/cash conversion, credit and 3–5-session relative follow-through.",
      tone:gap>0?"positive":gap<0?"negative":"mixed",asOf:chips.sourceSession,
      sources:[{name:"SMH source",url:chips.leftSourceUrl!},{name:"QQQ source",url:chips.rightSourceUrl!}],
      href:"/blue-desk/markets"});
  }else rows.push(missing("chips","02 / AI & CHIPS","Is capital favouring AI hardware or the wider Nasdaq?",
    "Obtain matched completed-session SMH and QQQ readings.","/blue-desk/markets"));

  const breadth=comparisons.find(x=>x.id==="equal-vs-cap");
  if(paired(breadth,now)){
    const gap=breadth.gapPp!;
    rows.push({id:"breadth",label:"03 / MARKET BREADTH",
      signal:gap>0?"BROADENING":gap<0?"MEGACAPS LEAD":"IN STEP",
      measurement:"RSP "+signed(breadth.leftChange!,"%")+" · SPY "+signed(breadth.rightChange!,"%"),
      question:gap>0?"Is risk appetite spreading beyond the largest names, or just a one-day rotation?":
        gap<0?"Is index strength relying on a narrow group of large companies?":
        "Is equal-weight participation keeping pace with the index?",
      nextTest:"Check S5FI/S5TH participation, credit and the following 3–5 closes.",
      tone:gap>0?"positive":gap<0?"negative":"mixed",asOf:breadth.sourceSession,
      sources:[{name:"RSP source",url:breadth.leftSourceUrl!},{name:"SPY source",url:breadth.rightSourceUrl!}],
      href:"/blue-desk/markets?group=breadth"});
  }else rows.push(missing("breadth","03 / MARKET BREADTH","Are buyers spreading beyond the biggest stocks?",
    "Obtain matched completed-session RSP and SPY readings.","/blue-desk/markets?group=breadth"));

  const crude=markets.find(x=>x.id==="brent")??markets.find(x=>x.id==="wti");
  if(measured(crude,now)){
    const delta=crude.change!;
    rows.push({id:"oil",label:"04 / OIL & INFLATION",
      signal:delta>0?"CRUDE RISING":delta<0?"CRUDE FALLING":"CRUDE FLAT",
      measurement:crude.label+" "+signed(delta,"%")+" · 1D",
      question:delta>0?"Could energy costs change inflation and the expected rate path?":
        delta<0?"Is oil easing inflation pressure, or signalling softer demand?":
        "Which supply and demand forces could change inflation expectations?",
      nextTest:"Check EIA inventories, refined products, shipping and inflation expectations.",
      tone:delta>0?"negative":delta<0?"positive":"mixed",asOf:crude.asOf,
      sources:[{name:crude.sourceName,url:crude.sourceUrl!}],
      href:"/blue-desk/regime-watch/energy"});
  }else rows.push(missing("oil","04 / OIL & INFLATION","Is energy changing the outlook for inflation and interest rates?",
    "Confirm dated crude, physical supply and refined-product observations.","/blue-desk/regime-watch/energy"));

  const latest=news.filter(x=>sourceOk(x.sourceUrl)&&sourceDate(x.occurredAt,now,2))
    .sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt))[0];
  rows.push(latest?{
    id:"catalyst",label:"05 / FRESH CATALYST",signal:"SOURCE-VERIFIED EVENT",
    measurement:latest.headline,
    question:"Is this development a surprise to expectations, or already reflected in asset prices?",
    nextTest:"Compare the pre-event consensus with the release and subsequent matched asset reactions.",
    tone:"watch",asOf:latest.occurredAt,
    sources:[{name:latest.sourceName,url:latest.sourceUrl}],
    href:"/blue-desk/newsroom"
  }:missing("catalyst","05 / FRESH CATALYST",
    "Which new event could change the current market narrative?",
    "No verified headline inside the 48-hour news window; review the original-source feed.",
    "/blue-desk/newsroom"));
  return {tape:compass.sourceSession&&completedUsSession(compass.sourceSession,now)?
    compass.state:"UNMEASURED",
    tapeSession:compass.sourceSession&&completedUsSession(compass.sourceSession,now)?
      compass.sourceSession:null,rows};
}
