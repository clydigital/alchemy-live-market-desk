/**
 * Exchange-published REGULAR US CASH EQUITY session schedule, 2026–2028.
 * Source: https://www.nyse.com/trade/hours-calendars (accessed 4 Nov 2026);
 * independently cross-checked for 2026 with Nasdaq's official trading calendar.
 *
 * Every close time is America/New_York local time: 16:00 regular, 13:00 early.
 * These are planned holidays/half-days, NOT a claim that unexpected emergency
 * exchange halts, special closures or after-hours trading cannot occur.
 * Outside the checked years a weekday fallback remains available but is
 * explicitly labelled ESTIMATE so a report cannot claim an official calendar.
 */
type OfficialSchedule={closed:readonly string[];early13:readonly string[]};
const NYSE_OFFICIAL:Readonly<Record<string,OfficialSchedule>>={
 "2026":{
  closed:["2026-01-01","2026-01-19","2026-02-16","2026-04-03",
   "2026-05-25","2026-06-19","2026-07-03","2026-09-07",
   "2026-11-26","2026-12-25"],
  early13:["2026-11-27","2026-12-24"],
 },
 "2027":{
  closed:["2027-01-01","2027-01-18","2027-02-15","2027-03-26",
   "2027-05-31","2027-06-18","2027-07-05","2027-09-06",
   "2027-11-25","2027-12-24"],
  early13:["2027-11-26"],
 },
 "2028":{
  // NYSE specifically states no New Year's Day holiday observed in 2028.
  closed:["2028-01-17","2028-02-21","2028-04-14","2028-05-29",
   "2028-06-19","2028-07-04","2028-09-04","2028-11-23","2028-12-25"],
  early13:["2028-07-03","2028-11-24"],
 },
};
export type SessionCalendarBasis="OFFICIAL_NYSE_2026_2028"|"WEEKDAY_ESTIMATE";
export function usEquitySessionCalendarBasis(day:string):SessionCalendarBasis{
 return Object.hasOwn(NYSE_OFFICIAL,day.slice(0,4))
  ?"OFFICIAL_NYSE_2026_2028":"WEEKDAY_ESTIMATE";
}
/** Null means no regular NYSE equity session on this day. */
export function scheduledUsEquityCloseHourET(day:string):13|16|null{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
 const stamp=new Date(day+"T12:00:00.000Z");
 if(!Number.isFinite(stamp.getTime())||stamp.toISOString().slice(0,10)!==day)return null;
 if(stamp.getUTCDay()===0||stamp.getUTCDay()===6)return null;
 const listed=NYSE_OFFICIAL[day.slice(0,4)];
 if(listed?.closed.includes(day))return null;
 return listed?.early13.includes(day)?13:16;
}
