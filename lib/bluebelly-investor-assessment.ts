import type {DossierPresentationSelection} from "./dossier-v2/presentation-reader";
import type {InvestorMindsetRow} from "./bluebelly-investor-mindset";

/** Public-safe projection of the EXISTING immutable Dossier research brain.
 * Do not present a stale, degraded, unobserved or uncited model interpretation
 * as current investor psychology. The board's independent tape still renders.
 */
export type InvestorAssessmentStatus = "RESEARCHED" | "PARTIAL" | "STALE" | "DEGRADED" | "UNAVAILABLE";
export type InvestorLensReview = Readonly<{
 status:"RESEARCHED"|"STALE"|"UNRESOLVED";
 asOf:string; sourceThrough:string|null; interpretation:string|null;
 previousInterpretation:string|null; nextTest:string|null;
}>;
export type InvestorAssessmentRead = Readonly<{
 status:InvestorAssessmentStatus;
 statusDetail?:string;
 asOf:string|null;
 headline:string|null;
 whatWouldChangeMind:string|null;
 rows:Readonly<Partial<Record<InvestorMindsetRow["id"],string>>>;
 lensReviews:Readonly<Partial<Record<InvestorMindsetRow["id"],InvestorLensReview>>>;
}>;
const EMPTY:InvestorAssessmentRead={
 status:"UNAVAILABLE",asOf:null,headline:null,whatWouldChangeMind:null,rows:{},lensReviews:{}
};
const LENSES:Partial<Record<InvestorMindsetRow["id"],string>>={
 rates:"US_RATES",chips:"TECH_AI",breadth:"BREADTH",oil:"OIL_WAR_INFLATION",
 monetisation:"AI_MONETISATION",china:"CHINA_DEMAND",food:"FOOD_FERTILISER",
 cyber:"CYBER_RESILIENCE",power:"POWER_INFRASTRUCTURE",positioning:"MARKET_POSITIONING"
};
export function projectInvestorAssessment(
 selection:DossierPresentationSelection|null,now:Date,
):InvestorAssessmentRead{
 if(!selection?.presentation||!selection.selectedAsOf||
   selection.status==="unavailable"||selection.usingFallback||
   selection.selectedDossierId!==selection.latestDossierId)return EMPTY;
 const present=selection.presentation;
 const asOf=present.investorReviewedAt??selection.selectedAsOf;
 const age=now.getTime()-Date.parse(asOf);
 if(!Number.isFinite(age)||age<0||Date.parse(asOf)>Date.parse(selection.selectedAsOf))return EMPTY;
 const coverageDegraded=selection.status==="degraded_latest"||present.health.degraded;
 const materialGaps=(present.health.researchGaps??[]).filter(gap=>gap.severity==="MATERIAL");
 const rows:Partial<Record<InvestorMindsetRow["id"],string>>={};
 const lensReviews:Partial<Record<InvestorMindsetRow["id"],InvestorLensReview>>={};
 const governance=present.evidenceGovernance;
 const brainFailed=(present.health.researchGaps?.some(gap=>gap.category==="RESEARCH_BRAIN_DEGRADED")??false)
   || (present.health.executionDegraded ?? coverageDegraded);
 const byId=new Map(governance?.items.map(item=>[item.evidenceId,item])??[]);
 const conflicted=new Set(governance?.conflictGroups.filter(group=>group.resolution!=="RESOLVED_BY_SUPERSESSION").flatMap(group=>group.activeEvidenceIds)??[]);
 for(const [id,key] of Object.entries(LENSES)){
  const lens=present.regimeStrip?.find(item=>item.key===key);
  if(!lens)continue;
  const text=lens.interpretation.trim();
  // Require the actual persisted, governed source receipts. A new Dossier
  // timestamp cannot refresh old prices or rehabilitate conflicted evidence.
  const receipts=lens.evidenceRefs.map(ref=>byId.get(ref));
  const dates=receipts.map(item=>item?.occurrenceTime??item?.publishedAt?.slice().sort().at(-1)??null);
  const through=dates.filter((d):d is string=>!!d&&Number.isFinite(Date.parse(d))).sort().at(-1)??null;
  const qualified=!!governance&&lens.observed&&receipts.length>0&&receipts.every((item,i)=>
   !!item&&item.temporalState==="ACTIVE"&&item.independentLineageCount>0&&!conflicted.has(item.evidenceId)&&
   !!dates[i]&&Date.parse(dates[i]!)<=+now&&Date.parse(item.availableAt)<=Date.parse(asOf)&&
   +now-Date.parse(dates[i]!)<=7*86_400_000);
  const usable=qualified&&!brainFailed&&text.length>=30&&text.length<=2500;
  const reviewStatus=usable?(age>30*3_600_000?"STALE":"RESEARCHED"):"UNRESOLVED";
  const linked=present.investigationAudit?.find(inv=>inv.evidenceRefs.some(ref=>lens.evidenceRefs.includes(ref))&&inv.status!=="parked"&&inv.status!=="resolved");
  const rowId=id as InvestorMindsetRow["id"];
  lensReviews[rowId]={status:reviewStatus,asOf,sourceThrough:through,
   interpretation:usable?text.slice(0,350):null,
   previousInterpretation:lens.previousInterpretation??null,
   nextTest:usable&&linked?`Confirm: ${linked.confirmationCondition} · Invalidate: ${linked.invalidationCondition}`.slice(0,400):null};
  if(reviewStatus==="RESEARCHED")rows[rowId]=text.slice(0,350);
 }
 const coreUnresolved=["rates","chips","breadth","oil"].filter(id=>lensReviews[id as InvestorMindsetRow["id"]]?.status!=="RESEARCHED");
 const unresolved=Object.values(lensReviews).some(review=>review.status==="UNRESOLVED");
 const status:InvestorAssessmentStatus=brainFailed?"DEGRADED":age>30*3_600_000?"STALE":
   coverageDegraded||coreUnresolved.length>0||unresolved?"PARTIAL":"RESEARCHED";
 const statusDetail=status==="DEGRADED"?"Research execution failed or could not be verified; current interpretations withheld.":
   status==="STALE"?"Actual investor reasoning is older than 30 hours.":
   status==="PARTIAL"?[materialGaps.length?`${materialGaps.length} material Dossier evidence gap(s): ${materialGaps.map(gap=>gap.description).join(" · ")}`:null,
     coreUnresolved.length?`Unqualified core lenses: ${coreUnresolved.join(", ")}.`:null,
     coverageDegraded&&!materialGaps.length?"Dossier evidence coverage is incomplete.":null,
     unresolved?"Individual evidence checks still unresolved.":null].filter(Boolean).join(" "):undefined;
 return {
   status,statusDetail,asOf,rows,lensReviews,
   headline:status==="RESEARCHED"&&(present.header.epistemicLabel==="OBSERVED"||present.header.epistemicLabel==="SUPPORTED")?
     present.header.headline.slice(0,155):null,
   whatWouldChangeMind:status==="RESEARCHED"?present.header.whatWouldChangeMind?.slice(0,260)||null:null,
 };
}
