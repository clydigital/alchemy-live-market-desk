import {validateDeliveredWorkHtmlEdition} from "./bluebelly-html-archive-import-contract.ts";
import {WORK_KEYS,parseOperationalReceipt,applyOperationalReceipt,type WorkOperationalReceipt} from "./my-desk-operational-receipt.ts";
import {lane,fresh,type HealthLane} from "./my-desk-health-core.ts";
export const DIRECT_WORK_TITLES=Object.fromEntries(WORK_KEYS.map(k=>[k,"Bluebelly Work research — "+k])) as Record<typeof WORK_KEYS[number],string>;
export type DirectWorkRow={title:string;report_day:string;created_at:string;html_content:string;html_sha256:string};
export type DirectWorkReceipt={receipt:WorkOperationalReceipt;savedAt:string};
export function parseDirectWorkReceipt(row:DirectWorkRow,now:Date):DirectWorkReceipt|null{
 try{
  const savedAt=row.created_at;
  if(!Number.isFinite(Date.parse(savedAt))||Date.parse(savedAt)>+now||row.html_content.length>150000)return null;
  const verified=validateDeliveredWorkHtmlEdition({title:row.title,reportDay:row.report_day,html:row.html_content});
  if(verified.htmlSha256!==row.html_sha256)return null;
  const matches=[...row.html_content.matchAll(/<pre id="work-operational-receipt-v1">([\s\S]*?)<\/pre>/g)];
  if(matches.length!==1||matches[0][1].length>4000)return null;
  const raw=JSON.parse(matches[0][1].replaceAll("&lt;","<").replaceAll("&gt;",">").replaceAll("&amp;","&"));
  const receipt=parseOperationalReceipt(raw,now);
  if(!receipt||row.title!==DIRECT_WORK_TITLES[receipt.lane]||Date.parse(receipt.attemptAt)>Date.parse(savedAt)||receipt.completedAt&&Date.parse(receipt.completedAt)>Date.parse(savedAt))return null;
  const day=new Date(Date.parse(receipt.scheduledAt??receipt.attemptAt)+8*3600000).toISOString().slice(0,10);
  if(day!==row.report_day)return null;
  return {receipt,savedAt};
 }catch{return null;}
}
export function pickDirectWorkReceipt(rows:readonly DirectWorkRow[],key:typeof WORK_KEYS[number],now:Date):DirectWorkReceipt|null{
 return rows.flatMap(row=>{const parsed=parseDirectWorkReceipt(row,now);return parsed&&parsed.receipt.lane===key?[parsed]:[]}).sort((a,b)=>Date.parse(b.receipt.attemptAt)-Date.parse(a.receipt.attemptAt)||Date.parse(b.savedAt)-Date.parse(a.savedAt))[0]??null;
}
export function projectDirectWorkReceipt(label:string,direct:DirectWorkReceipt,now:Date):HealthLane{
 const r=direct.receipt;
 return applyOperationalReceipt(lane(label,{success:direct.savedAt,execution:"Direct private Supabase research edition saved",coverage:"Stored research; source qualification independent",coverageComplete:null,fresh:fresh(r.attemptAt,now,24),partial:r.coverage!=="complete",gaps:"Database receipt and content hash verified; not proof of complete acquisition, canonical admission or publication"}),r,now);
}
