import {getDueOfficialEarningsCandidates} from "./forward-earnings-sources.ts";
import {getRecentVerifiedEarningsScorecards} from "./blue-desk-earnings-results.ts";

/**
 * A visible gap in the PUBLIC release reader, NOT an allegation that the
 * issuer failed to report. Dates come from pre-announced issuer IR calendars.
 * The guard deliberately cannot count Notion, X, private issuer research,
 * or unadmitted third-party estimates as a released result.
 */
/** Normalize issuer period aliases: Fiscal Q1 2027 and FY2027 Q1 identify
 * one reporting period. Do not equate quarters with different year numbers. */
export function earningsFiscalPeriodKey(period:string){
 const year=period.match(/20[0-9]{2}/)?.[0];
 const quarter=period.match(/Q[1-4]/i)?.[0].toUpperCase();
 return year&&quarter?year+":"+quarter:period.toUpperCase().replace(/\s/g,"");
}
export function getUnreconciledPublicEarnings(now=new Date()){
 const due=getDueOfficialEarningsCandidates(now,96);
 const reviewed=getRecentVerifiedEarningsScorecards(now,7);
 return due.filter(item=>!reviewed.some(record=>
   record.ticker===item.ticker &&
   earningsFiscalPeriodKey(record.fiscalPeriod)===earningsFiscalPeriodKey(item.quarter)
 )).map(item=>({...item,status:"RESULT_BOARD_REVIEW_NEEDED" as const}));
}
