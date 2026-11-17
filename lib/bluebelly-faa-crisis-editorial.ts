import type {NewsroomEditorialItem} from "./bluebelly-newsroom-editorial.ts";

export const FAA_CRISIS_ID="faa-crisis-november-2026";
export const FAA_CRISIS_AS_OF="2026-11-17T04:07:00Z";
export const FAA_CRISIS_HEADLINE="America's FAA crisis: who failed, who pays and who profits?";
export const FAA_CRISIS_SOURCE="https://www.faa.gov/newsroom/nationwide-ground-stop-questions-and-answers";
export const faaSources={
 faa:FAA_CRISIS_SOURCE,
 stop:"https://www.faa.gov/newsroom/faa-statement-nationwide-ground-stop",
 gao:"https://www.gao.gov/products/gao-26-107992",
 gaoFull:"https://files.gao.gov/reports/GAO-26-107992/index.html",
 ageing:"https://www.gao.gov/products/gao-24-107001",
 integrator:"https://www.faa.gov/newsroom/trumps-transportation-secretary-duffy-faa-administrator-bedford-announce-prime-integrator",
 att:"https://abierto.us/opportunities/693ka826d00016",
 act:"https://www.transportation.gov/briefing-room/trumps-transportation-secretary-sean-p-duffy-modern-skies-coalition-applaud-senator",
 briefing:"https://www.transportation.gov/briefing-room/icymi-us-transportation-secretary-sean-p-duffy-announces-lifting-nationwide-ground",
 sunday:"https://www.transportation.gov/briefing-room/icymi-trumps-transportation-secretary-sean-p-duffy-provides-update-across-sunday",
 democrats:"https://democrats-appropriations.house.gov/sites/evo-subsites/democrats-appropriations.house.gov/files/evo-media-document/ground-stop-timeline.pdf",
 harris:"https://www.l3harris.com/newsroom/press-release/2026/11/l3harris-statement-nov-13-ground-stop",
 radar:"https://www.transportation.gov/briefing-room/trumps-transportation-secretary-duffy-faa-administrator-bedford-announce-radar",
 reuters:"https://www.reuters.com/business/aerospace-defense/us-probes-why-router-installation-sparked-mass-flight-grounding-2026-11-16/",
 airlines:"https://www.reuters.com/business/aerospace-defense/top-four-us-airlines-face-345-million-hit-faa-ground-stop-bernstein-estimates-2026-11-16/",
 close:"https://apnews.com/article/2e6a9c41b6336e9240c1b01585d20cd4",
 budget:"https://rollcall.com/2026/11/16/aviation-funding-becomes-political-football-in-lame-duck-session/",
 flightRecovery:"https://news.aa.com/news/news-details/2026/Update-on-FAAs-nationwide-ground-stop/",
} as const;
export const faaFunding={preOutage:30.1,postOutage:50} as const;
export const faaFundingIncrease=(faaFunding.postOutage/faaFunding.preOutage-1)*100;
export const faaSystemCondition=[{label:"Unsustainable",count:51},{label:"Potentially unsustainable",count:54},{label:"Remaining",count:33}] as const;
export function faaCrisisNewsroomItem(now:Date,reader:string):NewsroomEditorialItem|null{
 const time=+now,start=Date.parse(FAA_CRISIS_AS_OF);
 if(!Number.isFinite(time)||time<start||time>=start+7*86400000)return null;
 return {id:"dated:"+FAA_CRISIS_ID,headline:FAA_CRISIS_HEADLINE,
  summary:"A nationwide flight shutdown, a government watchdog's advance warning and a $50 billion funding request reshape the outlook for aviation and telecom contractors.",
  occurredAt:"2026-11-16T18:28:49Z",initialPublishedOn:"2026-11-17",editorialUpdatedAt:FAA_CRISIS_AS_OF,
  sourceName:"FAA incident update · GAO audit · USDOT · Reuters",sourceUrl:FAA_CRISIS_SOURCE,
  readerHref:reader+"?feature="+FAA_CRISIS_ID,topics:["earnings","other"],
  verificationLabel:"DATED EDITORIAL · DOCUMENTED OUTAGE / CONDITIONAL OUTLOOK",
  why:"Potential replacement-network spending benefits telecom contractors while the incumbent's accountability and airline earnings remain at risk.",
  nextTest:"Router forensics, Congressional appropriations, funded network task orders and airline quarterly guidance.",kind:"reported"};
}
