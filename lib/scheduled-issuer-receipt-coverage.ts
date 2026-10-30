import {getDueOfficialEarningsCandidates} from "./forward-earnings-sources.ts";
import {createHash} from "node:crypto";
import type {ResearchRunInput} from "./research-update.ts";

/** Per-issuer first-party domains, not a free-text publisher name oracle. */
const ISSUER_HOSTS:Readonly<Record<string,readonly string[]>>={
 AMZN:["ir.aboutamazon.com"],
 INTC:["www.intc.com"],
 SNDK:["investor.sandisk.com"],
 GOOGL:["abc.xyz"],
 MSFT:["www.microsoft.com"],
 META:["investor.atmeta.com"],
 CRWV:["investors.coreweave.com"],
 PLTR:["investors.palantir.com"],
 AMD:["ir.amd.com"],
};
/** An issuer calendar is only an expectation: it never proves that actuals
 * were published. This diagnostic checks only primary-source intake items that
 * passed the existing linked publisher HTML gate; no third-party/creator item
 * is admitted and no canonical Story/metric value is changed.
 */
export function expectedIssuerReceiptGaps(
 input:Pick<ResearchRunInput,"items">,
 now=new Date(),
):string[]{
 const due=getDueOfficialEarningsCandidates(now,72).slice(0,20);
 return due.filter(event=>{
  const allowed=ISSUER_HOSTS[event.ticker]||[];
  // Unrecognised issuer domains have no verified original-source collector,
  // so do not pretend the schedule alone constitutes coverage.
  if(!allowed.length)return true;
  return !input.items.some(item=>{
   if(item.itemType!=="news")return false;
   const isPress=item.itemKey.startsWith("official-press:");
   const isIssuer=item.itemKey.startsWith("issuer-press:");
   if(!isPress&&!isIssuer)return false;
   if(isIssuer&&(
     item.itemKey!=="issuer-press:"+createHash("sha256").update(item.url).digest("hex").slice(0,24)
     ||item.sourceQuality!==95
     ||!item.reviewReason?.startsWith("Issuer-original result:")
     ||!item.evidence?.some(e=>e.url===item.url&&e.publisher===item.publisher)
   ))return false;
   const resultsAnnounced=/\b(?:announces?|announced)\b.{0,120}\bresults\b/i.test(item.title);
   const resultsReported=/\b(?:reports?|reported)\b.{0,120}\b(?:earnings|quarter|results|revenue)\b/i.test(item.title);
   const issuerVerified=/^Issuer confirms (?:FY20\d{2} )?Q[1-4](?: 20\d{2})? financial results — [A-Z0-9.]+$/.test(item.title);
   if((!resultsAnnounced&&!resultsReported&&!(isIssuer&&issuerVerified))
      ||/\b(?:date of|will report|to report|earnings call|conference call|webcast|scheduled|upcoming)\b/i.test(item.title))return false;
   const when=Date.parse(item.publishedAt),call=Date.parse(event.scheduledCallAt);
   if(!Number.isFinite(when)||!Number.isFinite(call)||Math.abs(when-call)>36*3600_000)return false;
   try{
    const url=new URL(item.url);
    return url.protocol==="https:"&&!url.username&&!url.password&&!url.hash
      &&allowed.includes(url.hostname.toLowerCase());
   }catch{return false;}
  });
 }).map(event=>"AUTO_COVERAGE_GAP:ISSUER_ORIGINAL_RELEASE:"+event.ticker+":"+
  event.quarter.replace(/[^A-Za-z0-9]/g,"_"));
}
