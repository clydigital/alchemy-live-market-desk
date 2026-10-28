/**
 * Public, attributed reportage. Never promote this to SOURCE_VERIFIED, a
 * completed transaction or a canonical market cause. Expire from 48h lane.
 */
export type ReportedEditorial={
 id:string;headline:string;publishedAt:string;publisher:string;sourceUrl:string;
 reporting:string;why:string;countercase:string;nextTest:string;
 assetNames:readonly string[];
};
const REPORTS:readonly ReportedEditorial[]=[
 {
 id:"tpg-ark-talks-2026-10-28",
 headline:"Report: TPG in talks to buy UK data-centre group Ark for about $5bn",
 publishedAt:"2026-10-28T06:13:00.000Z",
 publisher:"Reuters report citing Financial Times · not company-confirmed",
 sourceUrl:"https://live.euronext.com/en/financial-news/tpg-pursues-5-billion-acquisition-british-data-centre-group-ark-ft-reports",
 reporting:"Reuters relayed Financial Times reporting that TPG was discussing buying Ark Data Centres from Elliott Management at a valuation around $5bn. Reuters stated it could not independently verify the report; discussions were ongoing and a transaction was not guaranteed.",
 why:"In the deal story, the important number is an indicative enterprise valuation, not realised proceeds or a signed transaction. The test is whether an acquisition agreement, financing structure and EBITDA/capacity economics emerge.",
 countercase:"Talks may end without a deal, the headline valuation may change, and the companies have not confirmed a signed transaction.",
 nextTest:"Look for a dated exchange filing or original buyer/seller release before calling it a deal. Do not assert price moves were caused by these talks.",
 assetNames:["TPG","AI INFRASTRUCTURE"],
 }
] as const;
export function recentReportedEditorial(now:Date,hours=48){
 const t=now.getTime();
 if(!Number.isFinite(t)||!Number.isInteger(hours)||hours<1||hours>168)return [];
 return REPORTS.filter(r=>t>=Date.parse(r.publishedAt)&&t-Date.parse(r.publishedAt)<=hours*3600000);
}
export function reportedEditorialById(id:string,now:Date){
 if(!/^[a-z0-9-]{1,80}$/.test(id))return null;
 return recentReportedEditorial(now,168).find(x=>x.id===id)||null;
}
