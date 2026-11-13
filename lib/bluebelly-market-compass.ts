import type {MarketDivergenceRead} from "./bluebelly-market-divergence-watch.ts";

export type CompassState="RISK_ON"|"MIXED"|"RISK_OFF"|"UNMEASURED";
export type MarketCompassSummary={
 state:CompassState;
 title:string;
 explanation:string;
 contradiction:string;
 nextTest:string;
 sourceSession:string|null;
 evidenceCount:number;
 note:string;
};

const DAY=86400000;
function completedUSSession(date:string,now:Date):boolean{
 const parts=new Intl.DateTimeFormat("en-US",{
  timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",hourCycle:"h23"
 }).formatToParts(now);
 const get=(part:string)=>parts.find(p=>p.type===part)?.value??"";
 const nyDate=get("year")+"-"+get("month")+"-"+get("day");
 const weekday=new Date(date+"T12:00:00Z").getUTCDay();
 if(weekday===0||weekday===6||date>nyDate)return false;
 if(date<nyDate)return true;
 return Number(get("hour"))*60+Number(get("minute"))>=16*60+15;
}

function usableSession(date:string|null,now:Date):boolean{
 if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
 const time=Date.parse(date+"T00:00:00Z");
 if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==date)return false;
 const age=now.getTime()-time;
 return age>=0&&age<=6*DAY&&completedUSSession(date,now);
}

/** An observed 1D ETF-tape summary, NOT a fundamental or canonical Regime verdict.
 * Requires both pairs, four measured returns and the same fresh completed US session.
 * Does not infer causality, credit conditions or an entry signal. */
export function buildMarketCompassSummary(
 comparisons:readonly MarketDivergenceRead[],now:Date,
):MarketCompassSummary{
 const missing:MarketCompassSummary={
  state:"UNMEASURED",title:"Direction not established",
  explanation:"The required same-session ETF observations are unavailable or stale. Do not infer market-wide risk appetite from isolated prices.",
  contradiction:"No verified pair-level contradiction can be reported from this input.",
  nextTest:"Obtain matched completed-session SMH/QQQ and RSP/SPY 1D returns; then check credit and breadth before interpreting durability.",
  sourceSession:null,evidenceCount:0,
  note:"No score or sentiment probability is generated from missing data."
 };
 const semis=comparisons.find(row=>row.id==="semis-vs-nasdaq");
 const breadth=comparisons.find(row=>row.id==="equal-vs-cap");
 if(!semis||!breadth||semis.status==="NOT_COMPARABLE"||
  breadth.status==="NOT_COMPARABLE"||!semis.sourceSession||
  semis.sourceSession!==breadth.sourceSession||
  !usableSession(semis.sourceSession,now)||
  ![semis.leftSourceUrl,semis.rightSourceUrl,breadth.leftSourceUrl,breadth.rightSourceUrl]
   .every(validSource)){
   const issues=[semis,breadth].filter(item=>!item||item.status==="NOT_COMPARABLE")
    .map(item=>item?.reason||"One required ETF comparison is unavailable.");
   return {...missing,
    explanation:issues.length?issues.join(" ")+" A market-wide direction needs both ETF pairs from a completed, comparable US session.":missing.explanation};
  }
 const four=[semis.leftChange,semis.rightChange,breadth.leftChange,breadth.rightChange];
 if(four.some(value=>value===null||!Number.isFinite(value)))return missing;
 const returns=four as number[];
 const allUp=returns.every(value=>value>0);
 const allDown=returns.every(value=>value<0);
 const state:CompassState=allUp?"RISK_ON":allDown?"RISK_OFF":"MIXED";
 const summary={
  RISK_ON:{
   title:"Risk appetite improving",
   explanation:"Semiconductors, the Nasdaq proxy, equal-weight and cap-weight US equities all rose in the same completed session. This is one-day participation, not proof of a lasting bull regime.",
   nextTest:"Check whether RSP participates alongside SPY and SMH alongside QQQ over the next 3–5 completed sessions. Separately check credit and earnings."
  },
  RISK_OFF:{
   title:"Defensive equity session",
   explanation:"All four matched US equity proxies fell in the completed session. This is an observed broad price decline, not proof of a prolonged bear market.",
   nextTest:"Check whether breadth keeps deteriorating and credit spreads widen; a broad recovery over several sessions would challenge this reading."
  },
  MIXED:{
   title:"Mixed / tactical conditions",
   explanation:"The four matched equity proxies do not agree in direction. A rebound or sell-off is not uniformly supported by the sampled sectors and equal-weight participation.",
   nextTest:"Check the next 1–3 completed SMH/QQQ and RSP/SPY sessions, plus credit spreads, before upgrading a tactical move into a market regime."
  },
  UNMEASURED:{
   title:missing.title,explanation:missing.explanation,nextTest:missing.nextTest
  }
 }[state];
 const opposite=[semis,breadth].filter(item=>item.status==="OPPOSITE_MOVE")
  .sort((a,b)=>Math.abs(b.gapPp??0)-Math.abs(a.gapPp??0))[0];
 let contradiction:string;
 if(opposite){
  contradiction=opposite.left+" "+signed(opposite.leftChange!)+" versus "+
   opposite.right+" "+signed(opposite.rightChange!)+" in the same session: opposite directions, with cause not established.";
 }else if((breadth.gapPp??0)<-0.75){
  contradiction="RSP lagged SPY by "+Math.abs(breadth.gapPp!).toFixed(2)+
   " percentage points. Participation was weaker than the cap-weight index, even if both moved together.";
 }else if((semis.gapPp??0)<-0.75){
  contradiction="SMH lagged QQQ by "+Math.abs(semis.gapPp!).toFixed(2)+
   " percentage points. Semiconductor leadership is less convincing than the broad tech move.";
 }else{
  contradiction="No opposite-direction pair among these two matched checks. Positioning, credit and subsequent sessions remain untested.";
 }
 return {
  state,title:summary.title,explanation:summary.explanation,contradiction,
  nextTest:summary.nextTest,sourceSession:semis.sourceSession,evidenceCount:4,
  note:"Measured 1D ETF returns only · no estimated 3D/5D moves · no inferred investor motive or trade entry."
 };
}

function validSource(value:string|null):boolean{
 if(!value)return false;
 try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&u.href.length<=2048;}
 catch{return false;}
}

function signed(value:number):string{
 return (value>0?"+":"")+value.toFixed(2)+"%";
}
