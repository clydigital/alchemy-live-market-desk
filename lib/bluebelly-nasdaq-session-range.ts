import {scheduledUsEquityCloseHourET} from "./bluebelly-us-equity-trading-calendar.ts";
/** Request one calendar day beyond the scheduled completed session. Some
 * history endpoints may use an exclusive upper bound; this is a compatibility
 * precaution, not an established Nasdaq API guarantee. The response gate
 * remains the expected completed session, never the request end. */
export function nasdaqCompletedSessionRange(expected:string,historyDays:number){
 const end=Date.parse(expected+"T00:00:00Z");
 if(!Number.isFinite(end)||new Date(end).toISOString().slice(0,10)!==expected||scheduledUsEquityCloseHourET(expected)===null||!Number.isInteger(historyDays)||historyDays<1)throw Error("Invalid completed session range");
 return {from:new Date(end-historyDays*86400000).toISOString().slice(0,10),to:new Date(end+86400000).toISOString().slice(0,10)};
}
export function admitNasdaqSessionDay(time:number,expected:string){
 if(!Number.isFinite(time)||time<=0)return false;
 const date=new Date(time*1000);if(!Number.isFinite(+date))return false;
 const day=date.toISOString().slice(0,10);
 return day<=expected&&scheduledUsEquityCloseHourET(day)!==null;
}
