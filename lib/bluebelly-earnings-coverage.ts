import {getDueOfficialEarningsCandidates} from "./forward-earnings-sources.ts";
import {getRecentVerifiedEarningsScorecards} from "./blue-desk-earnings-results.ts";

/**
 * A visible gap in the PUBLIC release reader, NOT an allegation that the
 * issuer failed to report. Dates come from pre-announced issuer IR calendars.
 * The guard deliberately cannot count Notion, X, private issuer research,
 * or unadmitted third-party estimates as a released result.
 */
export function getUnreconciledPublicEarnings(now=new Date()){
 const due=getDueOfficialEarningsCandidates(now,96);
 const reviewed=getRecentVerifiedEarningsScorecards(now,7);
 return due.filter(item=>!reviewed.some(record=>
   record.ticker===item.ticker &&
   record.fiscalPeriod.toLowerCase().replace(/\\s/g,"")===item.quarter.toLowerCase().replace(/\\s/g,"")
 )).map(item=>({...item,status:"RESULT_BOARD_REVIEW_NEEDED" as const}));
}
