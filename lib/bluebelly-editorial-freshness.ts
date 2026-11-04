/** 'Updated today' requires a real editorial revision. Event dates, page reads, deployments are not edits. */
const DAY=/^\d{4}-\d{2}-\d{2}$/;
export const EDITORIAL_DAY_ZONE="Asia/Kuala_Lumpur";
export function editorialCalendarDay(value:string|Date,zone=EDITORIAL_DAY_ZONE):string|null{
 const date=value instanceof Date?value:DAY.test(value)?new Date(value+"T12:00:00Z"):new Date(value);
 if(!Number.isFinite(+date))return null;
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
 const y=parts.find(p=>p.type==="year")?.value,m=parts.find(p=>p.type==="month")?.value,d=parts.find(p=>p.type==="day")?.value;
 return y&&m&&d?y+"-"+m+"-"+d:null;
}
export function isEditorialUpdatedToday(initialPublishedOn:string,editorialUpdatedAt:string|undefined|null,now:Date):boolean{
 if(!editorialUpdatedAt||!Number.isFinite(+now)||!Number.isFinite(Date.parse(editorialUpdatedAt)))return false;
 if(Date.parse(editorialUpdatedAt)>+now)return false;
 const today=editorialCalendarDay(now);
 const initial=DAY.test(initialPublishedOn)?initialPublishedOn:editorialCalendarDay(initialPublishedOn);
 const updated=editorialCalendarDay(editorialUpdatedAt);
 return !!today&&!!initial&&!!updated&&updated===today&&initial<today;
}
