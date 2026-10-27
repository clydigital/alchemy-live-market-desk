import {createHash} from "node:crypto";
import {buildSecSubmissionsUrl,parseSecSubmissionsPayload} from "./providers/sec-edgar.ts";
import type {IntakeItemInput,ResearchRunInput} from "./research-update.ts";

/** Supplement the EXISTING scheduled research run with curated original SEC
 * prospectus discovery. This is a material *filing* observation only, not a
 * statement about IPO pricing/proceeds, stock moves, or canonical evidence.
 * Source coverage is intentionally bounded; a full issuer universe requires
 * an explicit wider source adapter, not a claim that this watches all EDGAR. */
export const PRIORITY_EDGAR_ISSUERS=[
 {cik:"0002130357",name:"Anthropic, PBC",forms:["S-1","F-1"]},
 {cik:"0001318605",name:"Tesla, Inc.",forms:["8-K","S-1","F-1"]},
 {cik:"0001326801",name:"Meta Platforms, Inc.",forms:["8-K","S-1","F-1"]},
 {cik:"0001730168",name:"Broadcom Inc.",forms:["8-K","S-1","F-1"]},
 {cik:"0001045810",name:"NVIDIA Corp",forms:["8-K","S-1","F-1"]},
] as const;
const AGE_MS=72*60*60_000;
const USER_AGENT=/^[^\r\n]{12,200}$/;
const ACCESSION=/^\d{10}-\d{2}-\d{6}$/;
type FetchLike=typeof fetch;

function etAcceptedToUtc(input:string|null):string|null{
 if(!input||!/^20\d{12}$/.test(input))return null;
 const yyyy=input.slice(0,4),mm=input.slice(4,6),dd=input.slice(6,8);
 const hh=input.slice(8,10),mi=input.slice(10,12),ss=input.slice(12,14);
 const date=yyyy+"-"+mm+"-"+dd;
 const midday=new Date(date+"T12:00:00Z");
 if(!Number.isFinite(midday.getTime()))return null;
 // SEC EDGAR acceptanceDateTime is US Eastern wall time. Use IANA timezone
 // to account for DST; appending Z would silently shift every filing clock.
 const tz=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",timeZoneName:"shortOffset"})
  .formatToParts(midday).find(x=>x.type==="timeZoneName")?.value||"";
 const match=/^GMT([+-]\d{1,2})(?::(\d{2}))?$/.exec(tz);
 if(!match)return null;
 const offset=match[1][0]+match[1].slice(1).padStart(2,"0")+":"+String(match[2]||"00");
 const dt=new Date(date+"T"+hh+":"+mi+":"+ss+offset);
 // Fail closed on impossible calendar days/times rather than normalising to
 // a different date or promoting an arbitrary future timestamp.
 if(!Number.isFinite(dt.getTime())||mm!==midday.toISOString().slice(5,7)
   ||dd!==midday.toISOString().slice(8,10)
   ||Number(hh)>23||Number(mi)>59||Number(ss)>59)return null;
 return dt.toISOString();
}
const contactOk=(v:string)=>USER_AGENT.test(v)&&/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(v);
function indexUrl(cik:string,acc:string){
 if(!ACCESSION.test(acc))return null;
 return "https://www.sec.gov/Archives/edgar/data/"+String(Number(cik))+"/"+
   acc.replace(/-/g,"")+"/"+acc+"-index.htm";
}
function matchingOfficialIndex(html:string,acc:string,form:string){
 // Original SEC EDGAR filing detail must confirm both immutable accession
 // identity and form type; submissions JSON alone cannot publish the item.
 const clean=html.slice(0,250_000).replace(/<[^>]+>/g," ").replace(/\s+/g," ");
 return clean.includes(acc)&&new RegExp("\\b"+form.replace("-","\\-")+"\\b","i").test(clean)
  && /(?:Filing Detail|Filing Date|Submission Type|Form [SF]-1)/i.test(clean);
}
export async function applyMaterialSecProspectusIntake(
 input:ResearchRunInput,opts:{now?:Date;fetchImpl?:FetchLike;userAgent?:string}={}
):Promise<ResearchRunInput>{
 const now=opts.now??new Date(),ua=opts.userAgent??process.env.SEC_USER_AGENT?.trim()??"";
 if(!Number.isFinite(now.getTime())||!contactOk(ua))return {
  ...input,summary:((input.summary||"")+" SEC IPO filing discovery: UNCONFIGURED (contact User-Agent missing).").slice(0,6000)
 };
 const fetchImpl=opts.fetchImpl??fetch;
 const originals=new Set(input.items.map(x=>x.url));
 const adds:IntakeItemInput[]=[],states:string[]=[];
 for(const issuer of PRIORITY_EDGAR_ISSUERS){
  try{
   const res=await fetchImpl(buildSecSubmissionsUrl(issuer.cik),{
    headers:{accept:"application/json","user-agent":ua},cache:"no-store",signal:AbortSignal.timeout(6500)
   });
   if(!res.ok){states.push(issuer.name+":submissions_"+res.status);continue;}
   const payload=await res.json();
   if(Number(payload?.cik)!==Number(issuer.cik)){states.push(issuer.name+":CIK_MISMATCH");continue;}
   const parsed=parseSecSubmissionsPayload(payload,issuer.cik);
   if(parsed.entityName?.toLowerCase().replace(/[.,]/g,"").trim()!==
      issuer.name.toLowerCase().replace(/[.,]/g,"").trim()){
    states.push(issuer.name+":NAME_MISMATCH");continue;
   }
   let admitted=0;
   for(const filing of parsed.filings.slice(0,30)){
    if(!issuer.forms.some(f=>f===filing.form))continue;
    // Not all 8-Ks represent consequential deals: require specified item codes.
    const itemCodes=(filing.items||"").split(",").map(x=>x.trim());
    if(filing.form==="8-K"&&!itemCodes.some(x=>["1.01","2.01","5.01"].includes(x)))continue;
    const iso=etAcceptedToUtc(filing.acceptanceDateTime);
    const timestamp=iso?Date.parse(iso):NaN;
    if(!Number.isFinite(timestamp)||timestamp>now.getTime()||
       now.getTime()-timestamp>AGE_MS)continue;
    const url=indexUrl(issuer.cik,filing.accessionNumber);
    if(!url||originals.has(url))continue;
    const detail=await fetchImpl(url,{
     headers:{accept:"text/html","user-agent":ua},cache:"no-store",
     redirect:"follow",signal:AbortSignal.timeout(6500)
    });
    if(!detail.ok||!(detail.headers.get("content-type")||"").toLowerCase().includes("text/html")||
       (detail.url&&detail.url!==url))continue;
    const html=(await detail.text()).slice(0,250_000);
    if(!matchingOfficialIndex(html,filing.accessionNumber,filing.form))continue;
    const title=issuer.name+" filed Form "+filing.form+" with the SEC"+
      (filing.form==="8-K"?" (item codes "+itemCodes.filter(x=>["1.01","2.01","5.01"].includes(x)).join(", ")+")":"");
    adds.push({
      itemKey:"official-edgar:"+createHash("sha256").update(url).digest("hex").slice(0,24),
      itemType:"news",publisher:"U.S. Securities and Exchange Commission",
      title,url,publishedAt:iso!,summary:title,
      sourceQuality:95,relevance:92,novelty:90,materiality:filing.form==="8-K"?84:90,
      recommendedAction:"collect_evidence",
      newsSignal:filing.form==="8-K"?
        "Original SEC 8-K with qualifying item codes; deal completion and market-price response NOT established.":
        "Original SEC registration became public; offering effectiveness, IPO cash and price response NOT established.",
      evidence:[{title,url,publisher:"U.S. Securities and Exchange Commission",publishedAt:iso!,claim:title}],
      reviewReason:"SEC submissions accession, form, issuer and acceptance clock cross-checked against original SEC filing detail HTML. Filing existence only; deal completion and price reaction NOT verified."
    });
    originals.add(url);admitted++;
    if(admitted>=2||input.items.length+adds.length>=250)break;
   }
   states.push(issuer.name+":"+(admitted?"new="+admitted:"no_recent_verified_qualifying_filing"));
  }catch{states.push(issuer.name+":source_unavailable");}
 }
 return {...input,items:[...input.items,...adds],summary:
   ((input.summary||"")+" SEC IPO filing discovery: "+states.join(" | ")+
    ". Original SEC filing confirms filing identity only; no completed deal or price move inferred.").slice(0,6000)};
}
export {etAcceptedToUtc};
