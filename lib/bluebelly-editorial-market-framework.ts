import type {PublicStoryDepth} from "./bluebelly-key-story-depth.ts";

/** Explicit, editor-reviewed interpretation; never scored from sentiment, an
 * issuer headline, a price move or an LLM called from a public request.
 * A source-qualified receipt alone cannot produce this assessment. */
export type MarketImpactFramework={
 asOf:string;sourceUrl:string;decisionSignal:string;
 uncertaintyDirection:"RISING"|"FALLING"|"MIXED"|"UNASSESSED";
 uncertaintyWhy:string;
 assetValence:"MIXED_BY_EXPOSURE"|"CONDITIONALLY_POSITIVE"|"CONDITIONALLY_NEGATIVE"|"UNASSESSED";
 beneficiaries:string;pressured:string;
 supplyEffect:string;demandEffect:string;financingEffect:string;
 expectedReaction:string;observedReaction:string;
 tapeStatus:"NOT_MEASURED"|"DATED_NOT_CAUSAL"|"MATCHED_OBSERVATIONS";
 divergence:"UNTESTED"|"CONSISTENT"|"DIVERGENT"|"MIXED";
 alternative:string;nextTest:string;
};
export const UNASSESSED_MARKET_FRAME={
 label:"MARKET INTERPRETATION NOT YET ADJUDICATED",
 text:"No source-reviewed uncertainty direction, asset-by-asset market assessment or matched event-window reaction is attached. A source notice is not a trading signal."
} as const;
export function reviewedImpactForDepth(
 depth:Pick<PublicStoryDepth,"impact"|"sources">,
):MarketImpactFramework|null{
 const item=depth.impact;
 if(!item||!Array.isArray(depth.sources)||!depth.sources.some(s=>s.url===item.sourceUrl))return null;
 if(!Number.isFinite(Date.parse(item.asOf)))return null;
 if((item.tapeStatus==="NOT_MEASURED")!== (item.divergence==="UNTESTED"))return null;
 const mandatory=[item.decisionSignal,item.uncertaintyWhy,item.beneficiaries,item.pressured,
 item.supplyEffect,item.demandEffect,item.financingEffect,item.expectedReaction,
 item.observedReaction,item.alternative,item.nextTest];
 if(mandatory.some(s=>typeof s!=="string"||s.trim().length<8))return null;
 return item;
}
