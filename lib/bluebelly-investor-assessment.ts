import type {DossierPresentationSelection} from "./dossier-v2/presentation-reader";
import type {InvestorMindsetRow} from "./bluebelly-investor-mindset";

/** Public-safe projection of the EXISTING immutable Dossier research brain.
 * Do not present a stale, degraded, unobserved or uncited model interpretation
 * as current investor psychology. The board's independent tape still renders.
 */
export type InvestorAssessmentStatus = "RESEARCHED" | "STALE" | "DEGRADED" | "UNAVAILABLE";
export type InvestorAssessmentRead = Readonly<{
 status:InvestorAssessmentStatus;
 asOf:string|null;
 headline:string|null;
 whatWouldChangeMind:string|null;
 rows:Readonly<Partial<Record<InvestorMindsetRow["id"],string>>>;
}>;
const EMPTY:InvestorAssessmentRead={
 status:"UNAVAILABLE",asOf:null,headline:null,whatWouldChangeMind:null,rows:{}
};
const LENSES:Partial<Record<InvestorMindsetRow["id"],string>>={
 rates:"US_RATES",chips:"TECH_AI",breadth:"BREADTH",oil:"OIL_WAR_INFLATION"
};
export function projectInvestorAssessment(
 selection:DossierPresentationSelection|null,now:Date,
):InvestorAssessmentRead{
 if(!selection?.presentation||!selection.selectedAsOf||
   selection.status==="unavailable"||selection.usingFallback||
   selection.selectedDossierId!==selection.latestDossierId)return EMPTY;
 const asOf=selection.selectedAsOf;
 const age=now.getTime()-Date.parse(asOf);
 if(!Number.isFinite(age)||age<0)return EMPTY;
 const present=selection.presentation;
 const status:InvestorAssessmentStatus=selection.status==="degraded_latest"||present.health.degraded?
   "DEGRADED":age>30*3_600_000?"STALE":"RESEARCHED";
 if(status==="DEGRADED"||status==="STALE")return {
   ...EMPTY,status,asOf
 };
 const rows:Partial<Record<InvestorMindsetRow["id"],string>>={};
 for(const [id,key] of Object.entries(LENSES)){
  const lens=present.regimeStrip.find(item=>item.key===key);
  if(!lens||!lens.observed||lens.evidenceRefs.length===0)continue;
  const text=lens.interpretation.trim();
  if(text.length>=30&&text.length<=2500)rows[id as InvestorMindsetRow["id"]]=text.slice(0,350);
 }
 return {
   status,asOf,rows,
   headline:present.header.epistemicLabel==="OBSERVED"||present.header.epistemicLabel==="SUPPORTED"?
     present.header.headline.slice(0,155):null,
   whatWouldChangeMind:present.header.whatWouldChangeMind?.slice(0,260)||null,
 };
}
