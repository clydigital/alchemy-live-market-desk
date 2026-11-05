/**
 * Original central-bank policy calendar attestations, NOT RSS clocks.
 *
 * The dates and wall-clock hours below were checked against the named banks'
 * own published decision schedules on 6 Nov 2026. These are meeting-date
 * allowlists, not release-URL allowlists: future scheduled decisions on these
 * already-published calendars need no per-article code change.
 *
 * A schedule proves only the intended publication time. It cannot prove that
 * the website published on time, that the article describes a decision, or
 * that any market price reacted. The caller independently reads same-host HTML
 * and validates a policy-decision outcome. Out-of-calendar and unscheduled
 * decisions remain ineligible for precise-time verification.
 */
type Bank = "www.bankofcanada.ca" | "www.rbnz.govt.nz" | "www.rba.gov.au";
type Calendar = {
  source:string;zone:string;hour:number;minute:number;dates:readonly string[];
};
const CALENDARS:Record<Bank,Calendar>={
  "www.bankofcanada.ca":{
    source:"https://www.bankofcanada.ca/2025/08/bank-canada-publishes-2026-schedule-policy-interest-rate-announcements-other-major-publications/",
    zone:"America/Toronto",hour:9,minute:45,
    dates:["2026-01-28","2026-03-18","2026-04-29","2026-06-10",
      "2026-07-15","2026-09-02","2026-10-28","2026-12-09"],
  },
  "www.rbnz.govt.nz":{
    source:"https://www.rbnz.govt.nz/news-and-events/how-we-release-information/ocr-decision-dates-and-financial-stability-report-dates-to-feb-2028",
    zone:"Pacific/Auckland",hour:14,minute:0,
    dates:["2026-04-08","2026-05-27","2026-07-08","2026-09-02",
      "2026-10-28","2026-12-09","2027-02-10","2027-03-17",
      "2027-05-05","2027-06-16","2027-08-04","2027-09-15",
      "2027-10-27","2027-12-08","2028-02-09"],
  },
  "www.rba.gov.au":{
    source:"https://www.rba.gov.au/schedules-events/board-meeting-schedules.html",
    zone:"Australia/Sydney",hour:14,minute:30,
    dates:["2026-02-03","2026-03-17","2026-05-05","2026-06-16",
      "2026-08-11","2026-09-29","2026-11-03","2026-12-08",
      "2027-02-09","2027-03-23","2027-05-04","2027-06-22",
      "2027-08-10","2027-09-28","2027-11-02","2027-12-14"],
  },
};
function calendarDate(at:Date,zone:string){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:zone,
    year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(at);
  const part=(name:string)=>parts.find(v=>v.type===name)?.value??"";
  return part("year")+"-"+part("month")+"-"+part("day");
}
function timeFromWallClock(day:string,c:Calendar):string|null{
  const [year,month,date]=day.split("-").map(Number);
  if(!year||!month||!date)return null;
  const sameDayUtc=Date.UTC(year,month-1,date,c.hour,c.minute,0);
  // Derive real DST offset via IANA rather than assuming ET/AEST/NZST.
  const offset=new Intl.DateTimeFormat("en-GB",{timeZone:c.zone,
    timeZoneName:"longOffset"}).formatToParts(new Date(sameDayUtc))
      .find(x=>x.type==="timeZoneName")?.value??"";
  const zone=offset.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if(!zone)return null;
  const sign=zone[1]==="+"?1:-1;
  const shift=sign*(Number(zone[2])*60+Number(zone[3]))*60_000;
  const result=new Date(sameDayUtc-shift);
  if(calendarDate(result,c.zone)!==day)return null;
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:c.zone,
    hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(result);
  const part=(name:string)=>parts.find(v=>v.type===name)?.value??"";
  return Number(part("hour"))===c.hour&&Number(part("minute"))===c.minute
    ?result.toISOString():null;
}
export type CalendarAttestation={releaseAt:string;scheduleSource:string;timePrecision:"scheduled_minute"};
export function policyScheduleForOriginalRelease(input:{
  host:string;url:string;rssPublishedAt:string;now:Date;
}):CalendarAttestation|null {
  if(!Object.prototype.hasOwnProperty.call(CALENDARS,input.host))return null;
  const c=CALENDARS[input.host as Bank];
  let original:URL;
  try{original=new URL(input.url)}catch{return null}
  if(original.protocol!=="https:"||original.hostname!==input.host||
    original.username||original.password)return null;
  const published=Date.parse(input.rssPublishedAt),now=+input.now;
  if(!Number.isFinite(published)||!Number.isFinite(now)||published>now+300_000)
    return null;
  const day=calendarDate(new Date(published),c.zone);
  if(!c.dates.includes(day))return null;
  const [yyyy,mm]=day.split("-");
  if(input.host==="www.bankofcanada.ca"){
    if(!original.pathname.startsWith("/"+yyyy+"/"+mm+"/")||
      !original.pathname.toLowerCase().includes(day))return null;
  }else if(input.host==="www.rbnz.govt.nz"){
    if(!original.pathname.startsWith("/news-and-events/news/"+yyyy+"/"+mm+"/"))return null;
  }else if(!original.pathname.startsWith("/media-releases/"+yyyy+"/"))return null;
  const releaseAt=timeFromWallClock(day,c);
  if(!releaseAt||Date.parse(releaseAt)>now+300_000||
    Math.abs(Date.parse(releaseAt)-published)>24*3600_000)return null;
  return {releaseAt,scheduleSource:c.source,timePrecision:"scheduled_minute"};
}
