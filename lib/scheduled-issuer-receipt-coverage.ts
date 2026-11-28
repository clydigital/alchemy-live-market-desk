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
 DELL:["investors.delltechnologies.com"],
 WDAY:["investor.workday.com"],
 ADI:["www.analog.com"],
 ZM:["investors.zoom.us"],
 ADSK:["investors.autodesk.com"],
 HPE:["www.hpe.com"],
 A:["www.agilent.com"],
 HPQ:["investor.hp.com"],
 BBY:["investors.bestbuy.com"],
 MDT:["news.medtronic.com"],
 DE:["www.deere.com"],
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
   const issuerVerified=item.title==="Issuer confirms "+event.quarter+" financial results — "+event.ticker;
   if(isIssuer&&!issuerVerified)return false;
   if((!resultsAnnounced&&!resultsReported&&!(isIssuer&&issuerVerified))
      ||/\b(?:date of|will report|to report|earnings call|conference call|webcast|scheduled|upcoming)\b/i.test(item.title))return false;
   const when=Date.parse(item.publishedAt),call=Date.parse(event.scheduledCallAt);
   if(!Number.isFinite(when)||!Number.isFinite(call))return false;
   // Issuer-confirmed calendar dates WITHOUT a webcast time are anchored to
   // midnight UTC for the due-ledger only. Do not turn that convention into
   // a 36-hour result-retrieval deadline: actual source may land two days later.
   if(event.sourceDateOnly){
     if(when<call||when-call>96*3600_000)return false;
   }else if(isIssuer){
     // Issuer-original intake uses retrieval time, not a fabricated release minute.
     // The exact reporting date/quarter was checked in the bounded original-page adapter.
     if(when<call-24*3600_000||when-call>72*3600_000)return false;
   }else if(Math.abs(when-call)>36*3600_000)return false;
   try{
    const url=new URL(item.url);
    const secCik=event.ticker==="ZM"?"1585521":event.ticker==="ADSK"?"769397":null;
    const secExhibit=isIssuer&&secCik&&url.hostname==="www.sec.gov"&&!url.search&&
      new RegExp("^/Archives/edgar/data/"+secCik+"/\\d{18}/[a-z0-9._-]+\\.html?$","i").test(url.pathname);
    return url.protocol==="https:"&&!url.username&&!url.password&&!url.hash&&!url.port
      &&(allowed.includes(url.hostname.toLowerCase())||Boolean(secExhibit));
   }catch{return false;}
  });
 }).map(event=>"AUTO_COVERAGE_GAP:ISSUER_ORIGINAL_RELEASE:"+event.ticker+":"+
  event.quarter.replace(/[^A-Za-z0-9]/g,"_"));
}
