/** Explicit ET options compatible with Node.js and browser Intl. */
const et=new Intl.DateTimeFormat("en-US",{
 timeZone:"America/New_York",year:"numeric",month:"short",day:"numeric",
 hour:"numeric",minute:"2-digit",hour12:true,timeZoneName:"short"
});
export function formatHormuzET(date:Date){
 if(!Number.isFinite(date.getTime()))return "Time unavailable";
 return et.format(date);
}
