/**
 * Dated bank-issued schedules only. These are NEVER bank decisions,
 * pre-release odds, an exact BoJ clock or verified asset reactions.
 */
export type NextBankCatalyst={
 id:string;bank:string;event:string;scheduledAt:string|null;sourceDate:string;
 timeBasis:string;sourceUrl:string;why:string;nextTest:string;
};
const SOURCES:readonly NextBankCatalyst[]=[
 {id:"ecb-2026-10-29",bank:"European Central Bank",
  event:"ECB policy decision and press conference",
  scheduledAt:"2026-10-29T13:15:00.000Z",sourceDate:"2026-10-29",timeBasis:"14:15 CET decision; 14:45 CET press conference · original ECB weekly schedule",
  sourceUrl:"https://www.ecb.europa.eu/press/calendars/weekly/html/index.en.html",
  why:"The deposit-rate decision matters relative to what short-term EUR yields had already priced. The explanation and Lagarde's press conference can shift the future path even without a rate change.",
  nextTest:"Check the source statement, deposit rate, then EUR/USD and 2-year German yield against their matched pre-announcement readings."
 },
 {id:"boj-2026-10-30",bank:"Bank of Japan",
  event:"BoJ monetary policy statement and October outlook",
  scheduledAt:null,sourceDate:"2026-10-30",timeBasis:"30 October JST · original BoJ calendar says exact publication time undecided",
  sourceUrl:"https://www.boj.or.jp/en/about/calendar/index.htm",
  why:"Yen and JGB traders need both the policy-rate decision and the BoJ's growth/inflation outlook. The bank does not supply a fixed release minute here.",
  nextTest:"Verify the actual statement release time before describing USD/JPY, JGB yields or carry-unwind reactions."
 }
];
export function sourceScheduledBankWatch(now:Date){
 const t=now.getTime();
 if(!Number.isFinite(t))return [];
 return SOURCES.flatMap(event=>{
  if(event.scheduledAt){
   const at=Date.parse(event.scheduledAt);
   if(t<at && at-t<=72*3600000)return [{...event,phase:"SCHEDULED" as const}];
   if(t>=at && t-at<=6*3600000)return [{...event,phase:"PUBLICATION DUE · OUTCOME UNVERIFIED" as const}];
   return [];
  }
  // A JST date-only schedule must NEVER be reassigned to an invented ET
  // instant; it remains on the watch through the source calendar day only.
  const dayStart=Date.parse(event.sourceDate+"T00:00:00+09:00");
  const dayEnd=dayStart+86400000;
  return t>=dayStart-72*3600000 && t<dayEnd
   ? [{...event,phase:t>=dayStart?"DATE ONLY · CHECK SOURCE" as const:"DATE ONLY · SCHEDULED" as const}]
   : [];
 });
}
