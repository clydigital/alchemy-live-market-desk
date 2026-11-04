import type {AutomaticReportEvidence, AutomatedReportNarrative, ReportSource} from "./blue-desk-automated-report-contract.ts";

/** Private reader-only tables. The renderer never fetches data or guesses a
 * pre-release expectation, event-window return, unit or market cause. */
const escape=(value:string,max=1400)=>value.slice(0,max).replace(/&/g,"&amp;")
 .replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")
 .replace(/'/g,"&#39;").replace(/\bon[a-z]{3,}\s*=/gi,m=>m.replace("=","&#61;"))
 .replace(/javascript\s*:/gi,m=>m.replace(":","&#58;"))
 .replace(/@import/gi,"@&#105;mport").replace(/url\s*\(/gi,m=>m.replace("(","&#40;"));
const number=(value:number|null)=>value===null||!Number.isFinite(value)
 ?"Not available":new Intl.NumberFormat("en-GB",{maximumFractionDigits:6}).format(value);
function safeUrl(value:string):string|null{
 try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password?url.href:null;}
 catch{return null;}
}
function link(s:ReportSource):string{
 const uri=safeUrl(s.url);
 return uri?'<a href="'+escape(uri,1900)+'" target="_blank" rel="noopener noreferrer">'
  +escape(s.sourceName,100)+'</a>':"Source URL unavailable";
}
function time(value:string):string{
 if(/^\d{4}-\d\d-\d\d$/.test(value))return escape(value)+" · release time not verified";
 const epoch=Date.parse(value);
 return Number.isFinite(epoch)?new Date(epoch).toISOString().replace("T"," ").slice(0,16)+" UTC":"Time not verified";
}
function eventTime(value:string):string{
 if(/^\d{4}-\d\d-\d\d$/.test(value))return time(value);
 const epoch=Date.parse(value);
 if(!Number.isFinite(epoch))return "Time not verified";
 const date=new Date(epoch);
 const pretty=(zone:string)=>new Intl.DateTimeFormat("en-GB",{
  timeZone:zone,day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false,
 }).format(date);
 return escape(pretty("America/New_York")+" ET / "+pretty("Asia/Kuala_Lumpur")+" MYT");
}
function table(id:string,heading:string,note:string,headers:string[],rows:string[][]):string{
 if(!rows.length)return "";
 return '<section class="evidence-block" data-private-table="'+escape(id,60)+'"><h2>'
  +escape(heading,140)+'</h2><p class="table-note">'+escape(note,500)+'</p>'
  +'<div class="table-scroll" role="region" aria-label="'+escape(heading,140)
  +'" tabindex="0"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+escape(h)+'</th>').join("")
  +'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join("")
  +'</tr>').join("")+'</tbody></table></div></section>';
}
/** Source-timed price snapshots, never fabricated same-minute market reactions. */
export function renderPrivateMarketTable(evidence:AutomaticReportEvidence):string{
 const rows=evidence.sources.filter(s=>s.type==="OBSERVATION"&&s.marketSnapshot)
  .slice(0,8).map(s=>{
   const m=s.marketSnapshot!;
   return [escape(m.label,120),escape(number(m.level)),escape(number(m.previousClose)),
    escape(time(m.asOf)),link(s)];
  });
 return table("market-snapshots","What markets actually measured",
  "Provider-reported daily levels and previous closes, not event-window reactions. Units depend on each source and no return, yield change or causal link is inferred.",
  ["Instrument","Latest level","Previous close","Observation time","Original source"],rows);
}
/** Only explanatory arguments supplied by the separately validated narrative. */
export function renderPrivateScenarioTable(
 evidence:AutomaticReportEvidence,narrative:AutomatedReportNarrative|null,
):string{
 const ids=new Set(evidence.sources.filter(s=>s.type!=="CALENDAR").map(s=>s.id));
 const rows=(narrative?.stories||[]).filter(s=>s.sourceIds.some(id=>ids.has(id)))
  .slice(0,4).map(s=>[escape(s.headline,150),escape(s.mechanism,900),
    escape(s.countercase,900),escape(s.nextTest,650)]);
 return table("competing-cases","The working case versus the countercase",
  "These are conditional, model-assisted interpretations tied to source IDs, not independently verified market outcomes or trading signals.",
  ["Decision topic","Working mechanism","Strongest rival explanation","What would settle it"],rows);
}
export function renderPrivateUpcomingTable(
 evidence:AutomaticReportEvidence,narrative:AutomatedReportNarrative|null,
):string{
 const rows=evidence.sources.filter(s=>s.type==="CALENDAR").slice(0,6).map(s=>{
  const watch=narrative?.watchlist.find(w=>w.sourceIds.includes(s.id));
  return [escape(s.title,170),eventTime(s.eventAt),escape(s.detail,350),
   escape(watch?.positiveCase||"Constructive scenario not verified",450),
   escape(watch?.negativeCase||"Adverse scenario not verified",450),
   link(s)];
 });
 return table("upcoming-catalysts","Pre-release: what investors should prepare for",
  "Scheduled, not yet released. Previous/consensus figures, actuals and market reaction are not asserted unless independently sourced. Cases are conditional, not forecasts.",
  ["Event","ET / MYT","Deciding question","Constructive case","Adverse case","Original calendar"],rows);
}
/** A transparent visual for abbreviated source-only editions when no model narrative exists. */
export function renderPrivateEvidenceTable(evidence:AutomaticReportEvidence):string{
 const rows=evidence.sources.filter(s=>s.type!=="CALENDAR").slice(0,7)
  .map(s=>[escape(s.type==="NEWS"?"Verified original news":"Dated observation"),
   escape(s.title,190),escape(time(s.eventAt)),link(s)]);
 return table("evidence-receipts","The dated evidence behind this edition",
  "Source attribution is not proof of an event-caused price move. Research gaps and missing consensus remain open.",
  ["Evidence state","What was reported","Event or observation time","Original source"],rows);
}

/** Calendar comparison is research preparation, not a verified actual or a
 * genuinely frozen analyst survey. Never convert this into a surprise score. */
export function renderPrivateExpectationsTable(evidence:AutomaticReportEvidence):string{
 const rows=evidence.sources.filter(s=>s.type==="CALENDAR").slice(0,6).map(s=>{
  const c=s.calendarComparison;
  return [escape(s.title,170),escape(c?.previous||"Not verified",90),
   escape(c?.consensus||"Not verified",90),"Pending",
   escape(c?.snapshotAt?time(c.snapshotAt):"Snapshot time unavailable"),
   link(s)];
 });
 return table("economic-expectations","Previous, expected, actual — what is known",
  "Previous and consensus are calendar-supplied figures only; the pre-release poll provider and freeze time are not independently established here. The linked event schedule does not verify consensus. Actuals remain pending for upcoming releases.",
  ["Upcoming event","Previous (calendar)","Consensus (calendar)","Actual","Packet snapshot","Event source"],rows);
}
