import type { EditorialSlate } from "./editorial-slate-core.ts";
import type { EditorialPriceCard } from "./editorial-price-context.ts";

/** Deliberately synthetic. This module must never query the production DB. */
export const LAB_SLATE:EditorialSlate={
 dayMyt:"2026-01-01",producedAt:"2026-01-01T00:00:00Z",
 verificationStatus:"partial",ageLabel:"SYNTHETIC UI EXAMPLE",
 notes:"DEVELOPMENT FIXTURE — not a real scheduled slate, market call or confirmed catalyst.",
 sources:[],
 ideas:[
  {rank:1,title:"Demo: Oil and bond yields pull apart",format:"OB",
   hook:"DEMO ONLY: Investigate why oil and yields could diverge.",
   catalystTimeline:"Hypothetical catalyst; release time UNKNOWN.",
   expectation:"If supply-led inflation dominates, nominal yields might rise.",
   priceReaction:"UNKNOWN — no real daily or event-window bars in this preview.",
   mechanism:"Conditional: duration hedging could overwhelm inflation concerns.",
   countercase:"The bond move may reflect positioning or growth expectations.",
   nextTrigger:"Check official oil flows, Treasury yields and exact release clocks.",
   chartGuidance:["Demo chart plan: Brent 4H structure, not inspected."],
   sourceUrls:[],missingProof:"All factual market inputs remain unverified."},
  {rank:2,title:"Demo: Chart-led Brent trend assessment",format:"COTD",
   hook:"DEMO ONLY: Begin with a chart question rather than a news summary.",
   catalystTimeline:"No real event has been retrieved in this example.",
   expectation:"Hypothetical demand/supply scenario.",
   priceReaction:"UNKNOWN — chart bars not inspected.",
   mechanism:"A band retest could signal continuation if confirmed.",
   countercase:"A false break could reverse the setup.",
   nextTrigger:"Inspect dated EMA20/50 bands, price bars and volume.",
   chartGuidance:["DEMO: 4H EMA20 ±1σ setup requires verification."],
   sourceUrls:[],missingProof:"Market source, technical bars and catalyst clock missing."},
  {rank:3,title:"Demo: Earnings capex and cash flow",format:"BOTH",
   hook:"DEMO ONLY: Separate accounting definition from investment causality.",
   catalystTimeline:"No live filing retrieved. This is a generic exercise.",
   expectation:"Financing concerns are a hypothesis, not a filing observation.",
   priceReaction:"UNKNOWN — price bars and event reaction unavailable.",
   mechanism:"Cash investment can exceed operating cash flow without proving distress.",
   countercase:"Financing commitments and cash balances can change the implication.",
   nextTrigger:"Verify issuer cash-flow reconciliation and financing commitments.",
   chartGuidance:["DEMO: equity daily relative-return plot, not measured."],
   sourceUrls:[],missingProof:"All source, date and attribution checks missing."},
 ],
};
export const LAB_PRICE_CARDS:EditorialPriceCard[]=[
  {id:"brent",symbol:"BRENT",label:"Brent (synthetic empty-state)",type:"Energy",
    source:"DEMO ONLY",sourceUrl:null,lastDate:null,lastClose:null,
    levelUnit:"source units",status:"UNKNOWN",
    caution:"No private or live provider data accessed in this lab.",
    comparisons:([1,3,5] as const).map(sessions=>({
     sessions,label:sessions+" session(s)",referenceDate:null,
     reference:null,change:null,percent:null,unit:"%" as const,
     reason:"SYNTHETIC DEMO — no source bars",
    })),
  },
];
