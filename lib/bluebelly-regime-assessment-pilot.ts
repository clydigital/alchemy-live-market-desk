import type {EditorialRegimeId} from "./bluebelly-editorial-architecture.ts";
import type {InvestorAssessmentRead, InvestorLensReview} from "./bluebelly-investor-assessment.ts";

/** Reuse the already public-safe, receipt-qualified Dossier interpretation.
 * The old directional meter measures a different target; never infer its rating
 * from a rates/technology investor-motive paragraph. No private payload or
 * writer is exposed here. A single missing theme does not block the other. */
export type PilotLensId = "ai"|"bonds";
export type PilotLensAssessment = Readonly<{
 lens:PilotLensId;
 scope:string;
 state:"CURRENT"|"STALE"|"PENDING";
 reviewAt:string|null;
 sourceThrough:string|null;
 interpretation:string|null;
 nextTest:string|null;
}>;
export function isPilotLens(id:string):id is PilotLensId{return id==="ai"||id==="bonds";}
const MAP={ai:{row:"chips",scope:"AI equity leadership and investor incentives"},bonds:{row:"rates",scope:"Treasury yields, duration and investor incentives"}} as const;
export function selectPilotLensAssessment(id:EditorialRegimeId,assessment:InvestorAssessmentRead):PilotLensAssessment|null{
 if(!isPilotLens(id))return null;
 const entry=MAP[id];
 const review:InvestorLensReview|undefined=assessment.lensReviews[entry.row];
 const usable=review?.status==="RESEARCHED"&&!!review.interpretation&&!!review.sourceThrough;
 return {lens:id,scope:entry.scope,
  state:usable?"CURRENT":review?.status==="STALE"?"STALE":"PENDING",
  reviewAt:review?.asOf??null,sourceThrough:usable?review.sourceThrough:null,
  interpretation:usable?review.interpretation:null,nextTest:usable?review.nextTest:null};
}
