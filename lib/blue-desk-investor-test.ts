import type { MotionOrderedStory, PublicThesis } from "./blue-desk-thesis-ledger.ts";

/**
 * Bluebelly's read-only editorial Investor Test.
 *
 * Never converts an old thesis, an unverified Motion, a hypothetical investor
 * question or a recorded priced assessment into a new market observation.
 * No story/evidence writes and no inferred company-specific financing terms.
 */
export type InvestorTestView = {
  story: MotionOrderedStory;
  fundingQuestion: string;
  marketQuestion: string;
  quality: "developed" | "partial";
  evidenceNote: string;
};

export const INVESTOR_TEST_STAGES = [
  { id: "pitch", label: "The pitch", question: "What is the opportunity?" },
  { id: "money", label: "Follow the money", question: "Who finances it, and who gets paid?" },
  { id: "catch", label: "The catch", question: "What could break the idea?" },
  { id: "verdict", label: "The deciding test", question: "What would change the view?" },
] as const;

function themeQuestions(story: Pick<PublicThesis,"title"|"slug">) {
  const text=(story.slug+" "+story.title).toLowerCase();
  if (/ai|capex|semiconductor|compute|nvidia|anthropic|openai|cloud|private.capital|financ/.test(text))
    return {
      funding:"Who supplies the capital, on what terms, and how much extra cash can the investment produce?",
      market:"Is the future cash return already priced into the shares or credit? Check dated market observations before answering.",
    };
  if (/bond|yield|treasur|sovereign|jgb|fed|rate|credit|debt|funding|mortgage/.test(text))
    return {
      funding:"Who must refinance at these yields, and who receives the higher interest income?",
      market:"Which yield and spread changes actually occurred together? Check matched observation dates before inferring causation.",
    };
  if (/iran|hormuz|oil|brent|lng|gas|energy|diesel|refin/.test(text))
    return {
      funding:"Who pays more for transport, energy or supply protection, and who can pass those costs on?",
      market:"Have dated oil, inflation, yield and equity observations confirmed the transmission mechanism?",
    };
  return {
    funding:"Who provides the capital, who earns the return, and what risks remain with existing investors?",
    market:"What was expected versus what actually changed? Require dated market observations before claiming a reaction.",
  };
}

const complete=(v:string)=>typeof v==="string"&&v.trim().length>=18;

/** Prefer a developed, financing-relevant live Story; never synthesise one. */
export function selectFlagshipInvestorTest(
  stories:readonly MotionOrderedStory[],
):InvestorTestView|null{
  const candidates=stories.filter(s=>complete(s.thesis)&&complete(s.support)&&
    (complete(s.contradiction)||complete(s.invalidation))&&
    (complete(s.nextTest)||complete(s.confirmation)));
  if(!candidates.length)return null;
  const rank=(s:MotionOrderedStory)=>{
    const theme=(s.slug+" "+s.title).toLowerCase();
    const ai=/ai|capex|cloud|semiconductor|nvidia|financ|private.capital|credit/.test(theme);
    const finance=/financ|capex|debt|capital|fund|cash|credit/.test(theme);
    const fields=[s.support,s.contradiction,s.nextTest,s.pricedAssessment,s.invalidation]
      .filter(complete).length;
    return Number(ai)*50+Number(finance)*18+fields*4+
      Number(s.latestMotionVerification==="VERIFIED")*2;
  };
  const sorted=[...candidates].sort((a,b)=>rank(b)-rank(a)||
    Date.parse(b.updatedAt)-Date.parse(a.updatedAt)||a.slug.localeCompare(b.slug));
  const story=sorted[0];
  const questions=themeQuestions(story);
  return {
    story,
    ...questions,
    quality:complete(story.pricedAssessment)?"developed":"partial",
    evidenceNote:story.latestMotionVerification==="VERIFIED"
      ?"The linked event is source-verified, but this archived thesis and its pricing assessment are not a new live price reaction."
      :"This is an archived research thesis. Linked Motion may be unverified; no live market reaction is implied.",
  };
}
