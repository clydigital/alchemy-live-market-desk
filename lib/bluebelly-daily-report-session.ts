/** A display-only expectation for private Daily Intelligence coverage.
 * This models a normal US weekday close at 16:00 America/New_York.
 * Exchange holidays and early closes are deliberately NOT inferred.
 * It must not become a source-admission or edition-generation gate. */
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
 const session=new Date(Date.UTC(year,month-1,day));
 if(session.getUTCDay()===0||session.getUTCDay()===6||hour<16){
  session.setUTCDate(session.getUTCDate()-1);
 }
 while(session.getUTCDay()===0||session.getUTCDay()===6){
  session.setUTCDate(session.getUTCDate()-1);
 }
 return session.toISOString().slice(0,10);
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
