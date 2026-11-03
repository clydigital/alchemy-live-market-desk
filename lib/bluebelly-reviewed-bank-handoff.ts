import type {NewsBriefV1} from "./market-brief-news.ts";
import {recentBankDecisions,type BankDecisionSnapshot} from "./bluebelly-bank-decision-snapshots.ts";

/** Separate approved PUBLIC READER availability from canonical original-feed
 * source admission. Existing reviewed articles never become a NewsBrief merely
 * because a matching research note/dedup key exists.
 */
export type ReviewedBankHandoff={
 bank:BankDecisionSnapshot;
 status:"ORIGINAL_RECEIPT_VISIBLE"|"REVIEWED_READER_NO_FEED_RECEIPT";
};
function sourceIdentity(value:string):string|null{
 try{
  const u=new URL(value);
  if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash)return null;
  return u.origin+u.pathname.replace(/\/$/,"");
 }catch{return null;}
}
export function reconcileReviewedBankReaders(news:readonly NewsBriefV1[],now=new Date()):ReviewedBankHandoff[]{
 const verified=new Set(news.filter(n=>n.verification==="SOURCE_VERIFIED")
  .map(n=>sourceIdentity(n.sourceUrl)).filter((v):v is string=>v!==null));
 return recentBankDecisions(now).map(bank=>({
  bank,status:verified.has(sourceIdentity(bank.sourceUrl)||"")
    ?"ORIGINAL_RECEIPT_VISIBLE" as const
    :"REVIEWED_READER_NO_FEED_RECEIPT" as const,
 }));
}
