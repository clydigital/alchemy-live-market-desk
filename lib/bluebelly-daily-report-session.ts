import {scheduledUsEquityCloseHourET,usEquitySessionCalendarBasis} from "./bluebelly-us-equity-trading-calendar.ts";

/** Last *scheduled completed* US cash-equity session, not the newest MYT date.
 * Uses the NYSE published 2026–2028 holiday/early-close calendar and real
 * America/New_York DST. Out-of-range years use a labelled weekday estimate.
 * This is display/selection logic only: never proof of market data or source
 * admission; unexpected exchange closures require separate official checks.
 */
export function expectedCompletedUsWeekdaySessionDay(now:Date):string|null{
 if(!Number.isFinite(now.getTime()))return null;
 const parts=new Intl.DateTimeFormat("en-US",{
  timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",hourCycle:"h23",
 }).formatToParts(now);
 const part=(type:string)=>parts.find(p=>p.type===type)?.value;
 const year=Number(part("year")),month=Number(part("month")),day=Number(part("day"));
 const hour=Number(part("hour")),minute=Number(part("minute"));
 if(!Number.isInteger(year)||!Number.isInteger(month)||!Number.isInteger(day)
  ||!Number.isInteger(hour)||!Number.isInteger(minute))return null;
 const base=new Date(Date.UTC(year,month-1,day));
 if(base.getUTCFullYear()!==year||base.getUTCMonth()!==month-1||base.getUTCDate()!==day)return null;
 for(let offset=0;offset<16;offset++){
  const candidate=new Date(base.getTime()-offset*86_400_000);
  const candidateDay=candidate.toISOString().slice(0,10);
  const closeHour=scheduledUsEquityCloseHourET(candidateDay);
  if(closeHour===null)continue;
  if(offset===0&&hour<closeHour)continue;
  return candidateDay;
 }
 return null;
}
/** Label calendar evidence separately from a verified observed market close. */
export function completedUsSessionCalendarBasis(now:Date):ReturnType<typeof usEquitySessionCalendarBasis>|null{
 const day=expectedCompletedUsWeekdaySessionDay(now);
 return day?usEquitySessionCalendarBasis(day):null;
}

export function privateDailySessionCoverage(
 lastSavedDay:string|null,expectedDay:string|null
):"current"|"behind"|"missing"|"newer_than_expected"|"unknown"{
 if(!expectedDay)return "unknown";
 if(!lastSavedDay)return "missing";
 if(!/^\d{4}-\d{2}-\d{2}$/.test(lastSavedDay))return "unknown";
 if(lastSavedDay===expectedDay)return "current";
 return lastSavedDay<expectedDay?"behind":"newer_than_expected";
}
