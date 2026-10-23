/**
 * Private scheduled editorial slate projection. Never canonical Story/Evidence.
 * Scheduled ChatGPT research writes the row; Bluebelly reads it as a draft.
 */
export type SlateIdea = {
  rank:1|2|3;
  title:string;
  format:"COTD"|"OB"|"BOTH";
  hook:string;
  catalystTimeline:string;
  expectation:string;
  priceReaction:string;
  mechanism:string;
  countercase:string;
  nextTrigger:string;
  chartGuidance:string[];
  sourceUrls:string[];
  missingProof:string;
};
export type EditorialSlate={
  dayMyt:string;producedAt:string;verificationStatus:"source_checked"|"partial";
  notes:string;ideas:SlateIdea[];sources:string[];ageLabel:string;
};
type Row = {
  day_myt:unknown;produced_at:unknown;verification_status:unknown;
  ideas:unknown;sources:unknown;notes:unknown;
};
const bounded=(v:unknown,n=1200)=>typeof v==="string"?v.trim().slice(0,n):"";
function https(v:unknown) {
  const s=bounded(v,1200);
  try{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password?u.toString():null;}
  catch{return null;}
}
function array(v:unknown){return Array.isArray(v)?v:[];}
function object(v:unknown):Record<string,unknown>{
  return v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
}
export function parseEditorialSlate(row:Row|null,nowIso:string):EditorialSlate|null{
  if(!row)return null;
  const day=bounded(row.day_myt,10), produced=bounded(row.produced_at,60);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(produced)))return null;
  if(row.verification_status!=="source_checked"&&row.verification_status!=="partial")return null;
  if(!Array.isArray(row.ideas)||row.ideas.length!==3)return null;
  const ideas:SlateIdea[]=row.ideas.map((raw,i)=>{
    const r=object(raw), format=r.format==="OB"||r.format==="COTD"||r.format==="BOTH"?r.format:"BOTH";
    return {
      rank:(i+1) as 1|2|3,
      title:bounded(r.title,180),format,hook:bounded(r.hook),
      catalystTimeline:bounded(r.catalystTimeline,3500),
      expectation:bounded(r.expectation,1500),
      priceReaction:bounded(r.priceReaction,2500),
      mechanism:bounded(r.mechanism,2200),
      countercase:bounded(r.countercase,1500),
      nextTrigger:bounded(r.nextTrigger,1500),
      chartGuidance:array(r.chartGuidance).slice(0,3).map(v=>bounded(v,650)).filter(Boolean),
      sourceUrls:array(r.sourceUrls).slice(0,12).map(https).filter((v):v is string=>!!v),
      missingProof:bounded(r.missingProof,1500),
    };
  });
  // Incomplete placeholders may be retained as PARTIAL, not called actionable drafts.
  if(ideas.some(x=>!x.title||!x.hook))return null;
  const latestDay=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Kuala_Lumpur",
    year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(nowIso));
  return {
    dayMyt:day,producedAt:produced,
    verificationStatus:row.verification_status,
    notes:bounded(row.notes,6000),ideas,
    sources:array(row.sources).slice(0,30).map(https).filter((x):x is string=>!!x),
    ageLabel:day===latestDay?"TODAY":"PREVIOUS SLATE — "+day,
  };
}
