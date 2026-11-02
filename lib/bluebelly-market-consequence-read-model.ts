import type {NewsBriefV1} from "./market-brief-news.ts";
import type {VerifiedEarningsScorecard} from "./blue-desk-earnings-results.ts";
import type {AuditedReaction} from "./bluebelly-earnings-reaction.ts";

/**
 * A public, pure presentation projection over existing source-qualified
 * records. Not a source verifier, new research writer, trading model, public
 * admission route or canonical Story/Regime update.
 *
 * Never derive investor expectations, economic polarity, uncertainty *change*
 * or market causation from headline keywords or a share-price move.
 */
export const MARKET_CONSEQUENCE_READ_VERSION="bluebelly-market-consequence-read/1" as const;
export type MarketConsequenceRead={
 version:typeof MARKET_CONSEQUENCE_READ_VERSION;
 sourceTier:"SOURCE_ONLY"|"ISSUER_RESULTS_REVIEWED";
 economic:{status:"NOT_ESTABLISHED"|"SOURCE_REVIEWED";text:string;sourceUrl:string|null};
 uncertainty:{status:"NOT_ASSESSED"|"OPEN_QUESTION";question:string|null};
 expectations:{status:"NOT_VERIFIED"|"ISSUER_GUIDANCE_ONLY"|"REPORTED_COMPARISON";text:string};
 price:{status:"NOT_MEASURED"|"DATED_SNAPSHOT";text:string;observedAt:string|null;sourceUrl:string|null};
 attribution:"CAUSE_NOT_ESTABLISHED";
};

const safeSource=(url:string):boolean=>{
 try{const u=new URL(url);return u.protocol==="https:"&&!u.username&&!u.password&&
  u.pathname!=="/"&&u.href.length<=2048;}catch{return false;}
};
const validClock=(x:string):boolean=>Number.isFinite(Date.parse(x));

export function consequenceForSourceOnlyNews(news:NewsBriefV1):MarketConsequenceRead|null{
 if(news.verification!=="SOURCE_VERIFIED"||!safeSource(news.sourceUrl)||
   !validClock(news.occurredAt)||!news.summary.trim())return null;
 return {
  version:MARKET_CONSEQUENCE_READ_VERSION,
  sourceTier:"SOURCE_ONLY",
  economic:{status:"NOT_ESTABLISHED",text:"The business or economic effect has not yet been checked against comparable evidence.",sourceUrl:null},
  uncertainty:{status:"NOT_ASSESSED",question:null},
  expectations:{status:"NOT_VERIFIED",text:"No attributed, comparable pre-event expectation is attached to this source notice."},
  price:{status:"NOT_MEASURED",text:"No independently checked event-window price response is attached.",observedAt:null,sourceUrl:null},
  attribution:"CAUSE_NOT_ESTABLISHED",
 };
}

/** Called only after the *existing* source-reviewed issuer scorecard is selected.
 * The independently audited price packet remains optional and must match the
 * exact same issuer earnings edition. The price observation is not a cause.
 */
export function consequenceForEarnings(
 earnings:VerifiedEarningsScorecard,
 reaction:AuditedReaction|null,
):MarketConsequenceRead|null{
 if(!safeSource(earnings.sourceUrl)||!earnings.company.trim()||
   !earnings.id.trim()||!earnings.fiscalPeriod.trim()||!earnings.conclusion.trim())return null;
 const matched=!!reaction&&reaction.id===earnings.id&&reaction.ticker===earnings.ticker&&
   safeSource(reaction.extended.sourceUrl)&&validClock(reaction.extended.at)&&
   validClock(reaction.regularClose.at)&&Date.parse(reaction.extended.at)>Date.parse(reaction.regularClose.at)&&
   Number.isFinite(reaction.extendedChangePct);
 return {
  version:MARKET_CONSEQUENCE_READ_VERSION,
  sourceTier:"ISSUER_RESULTS_REVIEWED",
  economic:{status:"SOURCE_REVIEWED",text:earnings.conclusion,sourceUrl:earnings.sourceUrl},
  uncertainty:{status:"OPEN_QUESTION",question:earnings.nextTest||"Next comparable issuer report and financing evidence."},
  expectations:earnings.beatSource==="unavailable"?
   {status:"NOT_VERIFIED",text:"A matching pre-release analyst consensus is not established."}:
   earnings.beatSource==="company_guidance"?
   {status:"ISSUER_GUIDANCE_ONLY",text:"Comparison to company guidance is not an independent analyst-consensus beat."}:
   {status:"REPORTED_COMPARISON",text:earnings.beatMiss+
      " Check matching metric, fiscal period and pre-release provider vintage before assigning a price surprise."},
  price:matched&&reaction?
   {status:"DATED_SNAPSHOT",text:`A dated post-release price observation is available for ${reaction.ticker}. Its cause has not been established by the price move alone.`,
    observedAt:reaction.extended.at,sourceUrl:reaction.extended.sourceUrl}:
   {status:"NOT_MEASURED",text:"No matched, independently reviewed post-release market snapshot is attached to this earnings edition.",observedAt:null,sourceUrl:null},
  attribution:"CAUSE_NOT_ESTABLISHED",
 };
}
