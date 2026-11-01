import type {AutomatedReportNarrative,AutomaticReportEvidence,ReportSource}
 from "./blue-desk-automated-report-contract.ts";
import {parseExistingHtmlEdition} from "./bluebelly-html-archive-import-contract.ts";

const esc=(value:string)=>value.replace(/&/g,"&amp;").replace(/</g,"&lt;")
 .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const plain=(value:string,max=1600)=>esc(value.slice(0,max).trim());
const date=(value:string)=>Number.isFinite(Date.parse(value))
 ?new Date(value).toISOString().replace("T"," ").slice(0,16)+" UTC":"time unverified";
function originalLink(source:ReportSource){
 try{
  const url=new URL(source.url);
  if(url.protocol!=="https:"||url.username||url.password)return "";
  return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${plain(source.sourceName,110)} · original source</a>`;
 }catch{return "";}
}
function rationale(source:ReportSource):{mechanism:string;counter:string;next:string}{
 const content=(source.title+" "+source.detail).toLowerCase();
 if(/(?:fed|fomc|central bank|policy rate|interest rate|treasury|yield)/.test(content))
  return {mechanism:"The decision for investors is whether this changes the expected path of borrowing costs, rather than merely repeating an already priced announcement.",
   counter:"A change in the official language need not change market pricing if expectations were already aligned.",
   next:"Check the next official statement and dated short-term Treasury observations before attributing an asset move."};
 if(/(?:ai|capex|cash flow|earnings|guidance|cloud|semiconductor|chip)/.test(content))
  return {mechanism:"The valuation question is whether operating growth converts into cash after investment needs and financing costs.",
   counter:"A large spending commitment is not itself evidence of weak demand or poor returns.",
   next:"Compare the issuer's own comparable-period cash flow, spending and guidance with a separately dated market reaction."};
 if(/(?:oil|brent|fuel|hormuz|shipping|crude|lng|gas)/.test(content))
  return {mechanism:"A physical supply change can affect costs, while a headline without confirmed disruption may affect only perceived risk.",
   counter:"Shipping or production may continue normally despite elevated geopolitical headlines.",
   next:"Check original physical flow, inventory and shipment observations before inferring a lasting price shock."};
 return {mechanism:"The economic importance depends on whether the reported fact changes future expectations or observable prices.",
  counter:"An original announcement can be genuine without establishing a particular trading reaction.",
  next:"Check the next dated primary release and time-matched market observations; treat causality as open until then."};
}
function sourceRow(s:ReportSource){
 return `<li id="src-${plain(s.id,20)}"><strong>${plain(s.id,25)}</strong> · ${plain(s.type)} ·
 ${plain(s.title,250)} · ${date(s.eventAt)} · ${originalLink(s)}</li>`;
}
const p=(label:string,value:string)=>`<p><strong>${esc(label)}:</strong> ${plain(value,2300)}</p>`;
const section=(title:string,body:string)=>`<section><h2>${plain(title,180)}</h2>${body}</section>`;
/** An explicitly private, static, source-labelled fallback. No claim that a
 * retrieved Notion/X/creator opinion independently verifies an event. */
export function renderScheduledDailyHtml(input:{
 day:string;now:Date;evidence:AutomaticReportEvidence;
 narrative?:AutomatedReportNarrative|null;
}):{html:string;title:string;mode:"MODEL_ASSISTED"|"SOURCE_LED_FALLBACK"}{
 const {day,now,evidence}=input,report=input.narrative||null;
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(day)||
   !Number.isFinite(Date.parse(day+"T00:00:00Z"))||!Number.isFinite(now.getTime()))
  throw Error("INVALID_REPORT_SESSION");
 const factual=evidence.sources.filter(s=>s.type!=="CALENDAR").slice(0,12);
 if(factual.length<2||new Set(factual.map(s=>s.url)).size<2)
  throw Error("INSUFFICIENT_REPORT_SOURCES");
 const future=evidence.sources.filter(s=>s.type==="CALENDAR").slice(0,6);
 const title=report?.title||"Markets after the US close: source-led intelligence";
 const mode=report?"MODEL_ASSISTED":"SOURCE_LED_FALLBACK";
 let body="";
 if(report){
  body+=section("The decision in brief",p("What matters",report.executiveSummary)
   +p("Big picture",report.bigPicture));
  for(const [i,story] of report.stories.slice(0,4).entries()){
   const cites=story.sourceIds.flatMap(id=>evidence.sources.filter(s=>s.id===id))
    .map(originalLink).filter(Boolean).join(" · ");
   body+=section((i+1)+". "+story.headline,
    p("What happened",story.setup)+"<p>"+plain(story.reveal,2500)+"</p>"
    +p("Who is exposed",story.humanStake)+p("Why it matters",story.mechanism)
    +p("What challenges it",story.countercase)+p("What to check next",story.nextTest)
    +"<p class=\"sources\">Source attribution: "+cites+"</p>");
  }
  if(report.crossMarket.length)body+=section("Cross-market implications",
   "<ul>"+report.crossMarket.slice(0,7).map(s=>"<li>"+plain(s,1200)+"</li>").join("")+"</ul>");
  if(report.watchlist.length)body+=section("What could change next",
   report.watchlist.map(w=>"<article>"+p("Catalyst",w.event+" · "+w.when)
    +p("The deciding question",w.question)+p("Two possible paths",
    w.positiveCase+" / "+w.negativeCase)+"</article>").join(""));
  body+=section("The conditional conclusion",p("Assessment",report.concludingAssessment)
   +p("What is not known",report.limitations));
 }else{
  body+=section("The story behind the latest sourced developments",
   "<p>This is an abbreviated, automatically compiled source-led edition. The full editorial narrative was unavailable, so the report preserves original facts and decision tests rather than generating unsupported explanations. It does not substitute for a separately completed long-form Work report.</p>");
  for(const [i,s] of factual.slice(0,5).entries()){
   const reason=rationale(s);
   body+=section((i+1)+". "+s.title,p("What happened or was observed",s.detail)
    +p("Potential mechanism — not verified causation",reason.mechanism)
    +p("Competing interpretation",reason.counter)
    +p("Next verification",reason.next)
    +"<p class=\"sources\">"+originalLink(s)+" · As-of "+date(s.eventAt)+"</p>");
  }
 }
 if(future.length)body+=section("Upcoming source-dated catalysts",
  "<ul>"+future.map(s=>"<li><strong>"+plain(s.title,180)+"</strong> · "+
   date(s.eventAt)+" · "+plain(s.detail,550)+" · "+originalLink(s)+"</li>").join("")+"</ul>");
 body+=section("Original-source ledger",
  "<p>These links were admitted by existing source-qualified research adapters. Their presence is not independent rechecking by this renderer; quotations, forecasts and explanatory mechanisms need their own review.</p><ol>"+
  evidence.sources.slice(0,20).map(sourceRow).join("")+"</ol>");
 body+=section("Coverage and limits",p("Evidence state",evidence.coverageNote)
  +p("Attribution","Release dates and market observations are separate clocks. No event-timed market reaction is inferred from a daily observation, and no private interpretation is a public Story or Regime verdict."));
 const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bluebelly Daily Intelligence | ${esc(day)}</title>
<style>body{font:16px/1.63 system-ui,-apple-system,Segoe UI,sans-serif;max-width:790px;margin:auto;padding:28px;color:#e6edf1;background:#0c141d}
h1{font-size:2.15rem;line-height:1.2}h2{font-size:1.35rem;line-height:1.3;margin:0 0 18px}
section{border-top:1px solid #314652;padding:25px 0}p,li{margin:0 0 14px}a{color:#82e1c7;overflow-wrap:anywhere}
.kicker{color:#8ad6ba;text-transform:uppercase;letter-spacing:.1em;font-size:12px;font-weight:700}
.limits{background:#152833;padding:14px;border-left:3px solid #f0c56b}
time,.small{color:#b0c4ca;font-size:14px}.sources{font-size:14px;color:#bdd6df}ul,ol{padding-left:25px}
</style></head><body>
<p class="kicker">Bluebelly · Private Daily Intelligence · ${mode==="MODEL_ASSISTED"?"Model-assisted draft":"Source-led fallback"}</p>
<h1>${plain(title,110)}</h1>
<p class="small">US weekday session: ${esc(day)} (16:00 ET regular-close assumption; exchange holidays and early closes are not independently confirmed). Compiled: ${date(now.toISOString())}. Research cutoff: ${date(evidence.asOf)}.</p>
<p class="limits"><strong>Private research draft — not publicly approved.</strong> ${mode==="SOURCE_LED_FALLBACK"?"The full editorial report remains pending. This factual fallback must not be mistaken for a reviewed long-form issue.":"Model-assisted explanations require editorial verification."} Original sources have individual event/observation times. No automatic claim of verified causality.</p>
${body}
<footer class="small">Bluebelly / owner-only archive. Original-source admission is not equivalent to independent editorial approval. No scripts, external embeds or automatic publication.</footer>
</body></html>`;
 const checked=parseExistingHtmlEdition({filename:"Bluebelly_"+day+".html",html});
 if(checked.edition.reportDay!==day||checked.edition.title!==title.slice(0,110))
  throw Error("AUTOMATED_HTML_INTEGRITY");
 return {html,title,mode};
}
