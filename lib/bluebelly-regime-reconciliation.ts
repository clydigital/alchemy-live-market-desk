import type {EditorialRegimeId} from "./bluebelly-editorial-architecture.ts";
import type {CompareResearch} from "./bluebelly-compare-research.ts";
import type {LiveLensResearch} from "./bluebelly-regime-live-research.ts";
import type {LensCardSignal} from "./bluebelly-regime-lens-card-signal.ts";
import type {QuestionAssessment} from "./bluebelly-question-assessment.ts";
import type {PublicThesis} from "./blue-desk-thesis-ledger.ts";
import type {DossierPresentationSelection} from "./dossier-v2/presentation-reader";

type Context = Pick<DossierPresentationSelection,"selectedAsOf"|"status"|"usingFallback">;
type Input = {lens:EditorialRegimeId; now:Date; compare:CompareResearch; live:LiveLensResearch;
 signal:LensCardSignal; reviews:readonly {read:QuestionAssessment}[]; prior:PublicThesis|null;
 dossier:Context|null};
const DAY=86400000;
const valid=(at:string|null,now:Date):at is string=>!!at&&Number.isFinite(Date.parse(at))&&Date.parse(at)<=+now;
const fresh=(at:string|null,now:Date)=>valid(at,now)&&+now-Date.parse(at!)<=6*DAY;
const day=(at:string)=>at.slice(0,10);
const pp=(n:number)=>(n>0?"+":"")+n.toFixed(2)+" pp";
const SCENARIOS:Record<EditorialRegimeId,{question:string;alternative:string;test:string}>={
 fed:{question:"Persistent inflation constrains policy",alternative:"Weakening real activity and labour demand shift the Fed path",test:"Match real PCE, jobs, inflation surprises and 2Y yields; high yields alone do not rule out recession."},
 bonds:{question:"Restrictive rates and selective financing stress",alternative:"Orderly absorption or cheaper sovereign duration despite issuer stress",test:"Separate Treasury yields, IG/HY spreads, issuer debt and project financing. Check actual closings and draws."},
 ai:{question:"Funding and cash conversion constrain funded AI deployment",alternative:"Profitable demand and replacement financing sustain investment",test:"Separate NAND, DRAM/HBM, accelerators and equipment. Test paid utilisation, cash capex, debt terms and supplier orders."},
 china:{question:"Industrial demand or capacity growth supports selected industries",alternative:"Sector concentration, weak end demand or price compression",test:"Check realised output, sales, cash collection and comparable compute economics rather than extrapolating profits."},
 energy:{question:"Crude surplus eases oil inflation",alternative:"Physical product or shipping scarcity persists",test:"Check actual OPEC+ decisions, delivered barrels, product cracks, LNG and inventories separately."},
 yen:{question:"Japanese tightening compresses rate differentials and stresses carry",alternative:"Energy-led inflation and US rate resilience prevent broad unwind",test:"Match Japanese and US 2Y yields, USDJPY, basis and cross-border flows; one FX move cannot establish liquidation."},
 breadth:{question:"Selective rotation and tactical absorption",alternative:"Broadening credit stress and earnings weakness turn rotation into liquidation",test:"Require persistent matched breadth, chip participation, credit and earnings. Compare price returns, not inferred fund flows."},
 gold:{question:"Structural reserve demand supports gold over time",alternative:"Real yields, USD or forced liquidity sales dominate shorter horizons",test:"Check real yields, USD, reserve disclosures and matched price action; do not infer actual selling from correlation."},
 housing:{question:"Restrictive mortgages suppress demand and new supply",alternative:"Rates ease or local scarcity supports selected firms",test:"Compare applications, permits, inventory, cash flow, leverage and local supply; valuation is a separate decision."}
};
/** Context and present conditions have separate clocks. This read-only comparison
 * never admits evidence, infers causality or advances a Dossier or thesis revision. */
export function projectLensReconciliation(input:Input){
 const {lens,now,compare,live,signal,reviews,prior,dossier}=input;
 const assessed=reviews.map(r=>r.read).filter(r=>r.freshness==="current"&&r.verdict!=="insufficient"&&valid(r.sourceThrough,now)&&valid(r.reviewedOn,now)&&r.sources.length>0)
  .sort((a,b)=>b.sourceThrough!.localeCompare(a.sourceThrough!)||b.reviewedOn!.localeCompare(a.reviewedOn!));
 const through=assessed[0]?.sourceThrough??null;
 const newer=live.facts.filter(r=>valid(r.at,now)&&(!through||day(r.at)>through));
 const sameDay=through?live.facts.filter(r=>valid(r.at,now)&&day(r.at)===through).length:0;
 const briefs=live.briefs.filter(r=>valid(r.at,now)&&(!through||day(r.at)>=through));
 const scenarios=SCENARIOS[lens];
 const marketLines:string[]=[];
 let marketState="No comparable dated market test";
 let marketDate:string|null=null;
 if(signal.sourceDate&&fresh(signal.sourceDate,now)&&signal.tone!=="unknown"){
  marketDate=signal.sourceDate;marketLines.push(signal.label+" · "+signal.readout+" · "+signal.dateNote+" "+signal.sourceDate+" ("+signal.scope+")");
  marketState="Dated proxy only";
 }
 if(lens==="breadth"||lens==="ai"){
  const five=compare.divergences.find(d=>d.window==="5D");
  const rsp=five?.pairs.find(p=>p.id==="equal-vs-cap"),chips=five?.pairs.find(p=>p.id==="semis-vs-nasdaq");
  const rot=compare.rotation.find(r=>r.window==="1D");
  const matched=!!rsp&&!!chips&&rsp.status!=="NOT_COMPARABLE"&&chips.status!=="NOT_COMPARABLE"&&rsp.gapPp!==null&&chips.gapPp!==null&&Number.isFinite(rsp.gapPp)&&Number.isFinite(chips.gapPp)&&rsp.sourceSession===chips.sourceSession&&fresh(rsp.sourceSession,now);
  if(matched&&rsp&&chips){
   marketDate=rsp.sourceSession;
   marketLines.push("5D RSP/SPY "+pp(rsp.gapPp!)+"; SMH/QQQ "+pp(chips.gapPp!)+" · "+marketDate);
   if(rot?.asOf===marketDate&&rot.coverage===11)marketLines.push("1D "+rot.advancing+"/11 sectors advanced · "+rot.asOf);
   marketState=rsp.gapPp!>0&&chips.gapPp!<0?"Rotation-compatible divergence; not a durable bottom":
    rsp.gapPp!<0&&chips.gapPp!<0?"Both relative tests weak; broad liquidation unconfirmed":
    rsp.gapPp!>0&&chips.gapPp!>0?"Both relative tests constructive; credit and earnings still decisive":
    "Mixed relative participation; no broad verdict";
  }else marketLines.push("Matched five-session equal-weight and semiconductor comparison incomplete.");
 }
 const state:"INSUFFICIENT_REVIEW"|"NEW_EVIDENCE_TO_REVIEW"|"PARTIAL_MATCH"|"DATED_REVIEW_AND_MARKET_TEST"=!assessed.length?"INSUFFICIENT_REVIEW":newer.length?"NEW_EVIDENCE_TO_REVIEW":live.partial||!marketDate?"PARTIAL_MATCH":"DATED_REVIEW_AND_MARKET_TEST";
 return {state,scenarios,assessed,sourceThrough:through,marketDate,marketState,marketLines,
  newer,newerBriefs:briefs,sameDay,partial:live.partial,
  prior:prior&&valid(prior.updatedAt,now)?{title:prior.title,thesis:prior.thesis,updatedAt:prior.updatedAt}:null,
  dossier:dossier&&valid(dossier.selectedAsOf,now)?{asOf:dossier.selectedAsOf,status:dossier.status,fallback:dossier.usingFallback}:null};
}
export type LensReconciliation=ReturnType<typeof projectLensReconciliation>;
