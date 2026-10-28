/**
 * Provider's v1 string-dictionary compact table, originally attributed to UKMTO.
 * SOURCE-ATTRIBUTED DISCOVERY, not independent Bluebelly verification.
 */
export type HormuzIncident={
 id:string;type:string;place:string;occurredAt:string;
 description:string;vesselType:string;casualtyReported:boolean;timeLate:boolean;
 sourceUrl:"https://www.ukmto.org/recent-incidents";
};
export type HormuzIncidentRead={
 checkedAt:string;builtAt:string|null;freshness:"recent"|"stale"|"unavailable";
 reports:HormuzIncident[];totalWindow:number;reason:string|null;
};
const UKMTO="https://www.ukmto.org/recent-incidents" as const;
type Rec=Record<string,unknown>;
function record(x:unknown):Rec|null{
 return x!==null&&typeof x==="object"&&!Array.isArray(x)?x as Rec:null;
}
const RELEVANT=/\b(?:Strait of Hormuz|Hormuz|Gulf of Oman|Northern Arabian Gulf|Persian Gulf|Sohar|Khasab|Fujairah|Al.Faw)\b/i;
export function decodeHormuzIncidents(payload:unknown,now:Date):HormuzIncidentRead{
 const checkedAt=now.toISOString(),base:Pick<HormuzIncidentRead,"checkedAt"|"builtAt"|"reports"|"totalWindow">={checkedAt,builtAt:null,reports:[],totalWindow:0};
 const p=record(payload),t=record(p?.t);
 if(p?.v!==1||typeof p?.attribution!=="string"||!p.attribution.includes("UKMTO")||
    !Array.isArray(p.s)||p.s.length>12000||!p.s.every(x=>typeof x==="string"&&x.length<6000)||
    !Array.isArray(t?.r)||t.r.length>800||!Array.isArray(t.c)||
    !Array.isArray(t.k)||JSON.stringify(t.c)!==JSON.stringify(
     ["id","type","lat","lon","ts","vessel_type","place","fire","sunk","abandoned","casualty","time_late","text"]))
  return {...base,freshness:"unavailable",reason:"Incident schema unavailable"};
 const built=p.built;
 if(typeof built!=="number"||!Number.isSafeInteger(built)||built*1000>+now+300000)
   return {...base,freshness:"unavailable",reason:"Incident build clock invalid"};
 const builtAt=new Date(built*1000).toISOString();
 const freshness=+now-built*1000>36*3600000?"stale" as const:"recent" as const;
 const strings=p.s as string[];
 const map=(key:unknown)=>typeof key==="number"&&Number.isInteger(key)&&key>=0&&key<strings.length?strings[key]:null;
 const seen=new Set<string>();
 const reports:HormuzIncident[]=[];
 for(const raw of t.r){
  if(!Array.isArray(raw)||raw.length!==13)continue;
  const [ki,kt,lat,lon,epoch,kv,kp,fire,sunk,abandoned,casualty,late,ktext]=raw;
  const id=map(ki),type=map(kt),place=map(kp),vessel=map(kv),text=map(ktext);
  if(!id||!/^UKMTO-\d{1,5}$/.test(id)||!type||!place||!text||!vessel||
    !RELEVANT.test(place)||!Number.isFinite(lat)||!Number.isFinite(lon)||
    lat<10||lat>32||lon<42||lon>62||
    !Number.isSafeInteger(epoch)||epoch*1000>+now+300000||
    +now-epoch*1000>14*86400000||seen.has(id))continue;
  if(![fire,sunk,abandoned,casualty,late].every(x=>x===0||x===1))continue;
  seen.add(id);
  reports.push({id,type,place,vesselType:vessel,
   occurredAt:new Date(epoch*1000).toISOString(),
   description:text.slice(0,650),casualtyReported:casualty===1,timeLate:late===1,sourceUrl:UKMTO});
 }
 reports.sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt));
 return {checkedAt,builtAt,freshness,reports:reports.slice(0,8),
  totalWindow:reports.length,reason:freshness==="stale"?"Provider's incident compilation is stale":null};
}
