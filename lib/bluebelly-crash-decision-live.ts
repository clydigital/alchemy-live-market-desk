import type {CrashWatchView,CrashSignal} from "./bluebelly-crash-opportunity.ts";
import type {MarketCompassSummary} from "./bluebelly-market-compass.ts";
import type {PublicMacroPulseBrief} from "./blue-desk-macropulse-brief.ts";

/**
 * Creator-informed questions, source-admitted answers. This deterministic,
 * public-safe view consumes existing market observations and RLS-published
 * MacroPulse research. It never fetches raw/private creator transcripts,
 * estimates probabilities, writes canonical Story/Regime or issues orders.
 *
 * The framework is based on reviewed 11-13 Nov counterviews: an oversold rally
 * can be short-covering, not absorption; true recovery requires breadth,
 * credit, paid demand and follow-through; systemic risk requires evidence of
 * binding financing and compelled sellers, not simply falling share prices.
 */
export type CrashScenarioState="ALIGNED"|"PARTIAL"|"CONTRADICTED"|"UNMEASURED";
export type CrashScenario=Readonly<{
 id:"durable"|"bounce"|"contagion";
 title:string;question:string;state:CrashScenarioState;
 corroborated:number;required:number;
 evidence:string;nextTest:string;failure:string;
}>;
export type CrashDecisionLayer=Readonly<{
 marketSession:string|null;breadthSession:string|null;creditSession:string|null;
 strongest:string;coverage:string;scenarios:readonly CrashScenario[];
 checkpoints:readonly Readonly<{
  id:string;name:string;state:"OBSERVED"|"UNMEASURED";
  result:string;next:string;
 }>[];
}>;

function pillar(view:CrashWatchView,id:string):CrashSignal{
 return view.pillars.find(x=>x.id===id)?.signal??"UNKNOWN";
}
function status(required:readonly CrashSignal[],positive:CrashSignal,contrary:CrashSignal):{state:CrashScenarioState;corroborated:number}{
 const corroborated=required.filter(s=>s===positive).length;
 const contraryCount=required.filter(s=>s===contrary).length;
 const known=required.filter(s=>s!=="UNKNOWN").length;
 return {state:known===0?"UNMEASURED":
  corroborated===required.length?"ALIGNED":
  corroborated>0?"PARTIAL":
  contraryCount===required.length?"CONTRADICTED":"UNMEASURED",
  corroborated};
}
export function buildCrashDecisionLayer(
 view:CrashWatchView,compass:MarketCompassSummary,
):CrashDecisionLayer{
 const b=pillar(view,"breadth"),c=pillar(view,"credit");
 const tape:CrashSignal=compass.state==="RISK_ON"?"BULL":
  compass.state==="RISK_OFF"?"BEAR":compass.state==="MIXED"?"MIXED":"UNKNOWN";
 const get=(id:string)=>view.readings.find(x=>x.id===id);
 const credit=get("hy-oas");
 const equityDate=view.pillars.find(x=>x.id==="breadth")?.observedAt??null;
 const dates=[compass.sourceSession,equityDate,credit?.status==="DATED"?credit.asOf:null].filter(Boolean);
 const coverage=[tape,b,c].filter(x=>x!=="UNKNOWN").length;
 const recovery=status([tape,b,c],"BULL","BEAR");
 const crash=status([tape,b,c],"BEAR","BULL");
 // One-day risk-on in the face of a contrary five-session participation or
 // funding reading supports investigating a trap; it does not confirm a trap.
 const trapCount=Number(tape==="BULL")+Number(b==="BEAR"||c==="BEAR");
 const bounce:CrashScenario["state"]=tape==="UNKNOWN"?"UNMEASURED":
  tape==="BEAR"?"CONTRADICTED":
  tape==="BULL"&&(b==="BEAR"||c==="BEAR")?"ALIGNED":
  tape==="BULL"?"PARTIAL":"UNMEASURED";
 const scenarios:CrashScenario[]=[
  {id:"durable",title:"Durable recovery",question:"Is price strength spreading while financing stress subsides?",
   state:recovery.state,corroborated:recovery.corroborated,required:3,
   evidence:"1D SMH/QQQ + RSP/SPY; matched 5-session RSP/SPX participation; separately sourced 5-observation HY OAS.",
   nextTest:"Sustained closes / 200D reclaim, broader participation, tight or narrowing corporate spreads, and issuer cash-flow guidance.",
   failure:"A failed reclaim, weak breadth, widening HY/CCC OAS or deteriorating forward earnings and funding."},
  {id:"bounce",title:"Tactical squeeze / bull trap",question:"Are buyers absorbing supply, or merely covering shorts?",
   state:bounce,corroborated:trapCount,required:2,
   evidence:"A 1D broad equity rebound is challenged by weak five-session breadth or rising credit spreads. No live short-covering/ETF flow proof is inferred.",
   nextTest:"Verify next-session follow-through, 200-day hold/retest, cash-market buying and ETF creation/redemption; compare options/OI and matched credit closes.",
   failure:"Several sessions of widening participation, stabilising funding and issuer cash upgrades weaken the temporary-bounce thesis."},
  {id:"contagion",title:"Credit-led crash escalation",question:"Has an earnings shock turned into binding funding constraints?",
   state:crash.state,corroborated:crash.corroborated,required:3,
   evidence:"Negative matched ETF session + deteriorating five-session participation + verified HY spread widening are necessary tape warning signs, not forced-selling proof.",
   nextTest:"Verify actual covenant breach, margin calls, refinancing denial, failed issuance, collateral marks or funding-market illiquidity.",
   failure:"Credit issuance reopens, OAS narrows, breadth improves and counterparties can meet cash obligations."},
 ];
 const checkpoints:CrashDecisionLayer["checkpoints"]=[
  {id:"expectations",name:"1 / Shock versus priced expectations",
   state:tape==="UNKNOWN"?"UNMEASURED":"OBSERVED",
   result:tape==="UNKNOWN"?"No four-ETF matched completed session":
    "Completed "+compass.sourceSession+" equity session: "+compass.title+". This measures reaction, not the expected-versus-actual surprise.",
   next:"Verify the pre-event consensus/revisions and match release times to completed, not intraday, prices."},
  {id:"breadth",name:"2 / Who absorbs the selling?",
   state:b==="UNKNOWN"?"UNMEASURED":"OBSERVED",
   result:b==="UNKNOWN"?"Matched five-session RSP versus SPX unavailable":
    (view.pillars.find(x=>x.id==="breadth")?.basis??"Breadth read pending"),
   next:"Confirm official breadth/new highs and a second/third closing session; ETF turnover is not proven net buying."},
  {id:"credit",name:"3 / Is credit amplifying the shock?",
   state:c==="UNKNOWN"?"UNMEASURED":"OBSERVED",
   result:c==="UNKNOWN"?"Qualified HY OAS five-observation move unavailable":
    (view.pillars.find(x=>x.id==="credit")?.basis??"Credit test pending"),
   next:"Check HY/CCC spread vintages, auction/issuance and the named borrower's covenants before calling systemic liquidation."},
  {id:"cash",name:"4 / Did expected cash generation break?",
   state:"UNMEASURED",
   result:"Issuer paid demand, capex, debt maturities, collateral and EPS revisions are not market-wide qualified inputs to this automatic score.",
   next:"Compare company-period OCF, net capex, leases, backlog conversion and forward cash revisions against the pre-selloff valuation."},
  {id:"structure",name:"5 / Does the reversal survive?",
   state:"UNMEASURED",
   result:"A confirmed 20/50/100/200 EMA band retest, 200D reclaim or stop level cannot be inferred from daily closing returns alone.",
   next:"Confirm higher-timeframe trend, closing hold/retest and source-dated technical invalidation; do not infer order flow from candles."},
 ];
 return {
  marketSession:compass.sourceSession,breadthSession:equityDate,
  creditSession:credit?.status==="DATED"?credit.asOf:null,
  coverage:`${coverage}/3 comparable decision inputs; ${view.measurementCoverage}/7 wider research pillars`,
  strongest:recovery.state==="ALIGNED"?"Recovery evidence currently aligns, pending fundamentals and technical confirmation.":
   crash.state==="ALIGNED"?"Crash-warning tape aligns, but the forced-selling mechanism remains unverified.":
   bounce==="ALIGNED"?"A potential short-lived rebound deserves testing; do not assume a lasting bottom.":
   "Insufficient agreement for a durable-recovery or systemic-crash call. Track the next deciding evidence.",
  scenarios,checkpoints
 };
}

const TOPICS=/\b(?:crash|equities|stocks|semiconductor|nvidia|nasdaq|ai\b|chip|earnings|capex|funding|credit|yield|treasury|rates|fed|liquidity|oil|hormuz|yen|dollar|cpi|ppi|breadth|refinancing|debt|volatility)\b/i;
function safePublicUrl(value:string):boolean{
 try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&!u.hostname.endsWith(".example");}catch{return false;}
}
/** Existing public, editorial-derived MacroPulse feed; never a verified price input. */
export function recentCrashResearch(
 briefs:readonly PublicMacroPulseBrief[],now:Date,limit=3,
):PublicMacroPulseBrief[]{
 if(!Number.isFinite(now.getTime()))return [];
 const seen=new Set<string>();
 return [...briefs].filter(x=>{
  if(x.verification_label!=="RESEARCH_DERIVED_UNADJUDICATED"||seen.has(x.source_pulse_id))return false;
  const dt=Date.parse(x.source_published_at),pt=Date.parse(x.published_at);
  if(!Number.isFinite(dt)||!Number.isFinite(pt)||dt>pt||pt>now.getTime()||
     now.getTime()-dt>7*86400000)return false;
  if(!TOPICS.test(x.headline+" "+x.standfirst+" "+x.why_it_matters))return false;
  if(!Array.isArray(x.source_links)||!x.source_links.some(l=>l.kind!=="SOCIAL_LEAD"&&safePublicUrl(l.url)))return false;
  seen.add(x.source_pulse_id);
  return true;
 }).sort((a,b)=>Date.parse(b.source_published_at)-Date.parse(a.source_published_at))
 .slice(0,Math.max(0,Math.min(limit,4)));
}
