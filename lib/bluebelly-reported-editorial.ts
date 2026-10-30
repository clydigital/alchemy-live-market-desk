/**
 * Public, attributed reportage. Never promote this to SOURCE_VERIFIED, a
 * completed transaction or a canonical market cause. Expire from 48h lane.
 */
export type ReportedEditorial={
 id:string;headline:string;publishedAt:string;publisher:string;sourceUrl:string;
 reporting:string;why:string;countercase:string;nextTest:string;
 assetNames:readonly string[];
 kind?:"VERIFIED_INCIDENT";
 secondarySourceUrl?:string;secondarySourceName?:string;
};
const REPORTS:readonly ReportedEditorial[]=[
 {
 id:"binance-security-incident-2026-10-30",
 kind:"VERIFIED_INCIDENT",
 headline:"Bitcoin tumbles after Binance details $6.3bn security incident",
 // Reuters' dated 29 Oct 20:38 ET market report; this is the earliest cited reporting clock,
 // NOT a claimed exact timestamp for Binance's subsequently published statement.
 publishedAt:"2026-10-30T00:38:00.000Z",
 publisher:"Binance · official security bulletin dated 30 October 2026",
 sourceUrl:"https://www.binance.com/zh-CN/support/announcement/detail/c5a8729a97ac486d963784d96c5642d7",
 secondarySourceUrl:"https://www.reuters.com/technology/bitcoin-cryptocurrency-prices-fall-after-binance-reports-security-issue-2026-10-30/",
 secondarySourceName:"Reuters · 30 October reported cryptocurrency reaction",
 reporting:"Binance says its initial investigation points to a possibly compromised DevOps laptop that enabled unauthorised withdrawal transactions. It estimates a $6.3bn total impact, with about $3bn frozen on-chain. The exchange says it found no evidence of a wallet private-key leak and promises to cover user losses with SAFU and company funds. Separately, Reuters reported that Bitcoin had fallen to a six-week low of $77,646, Ether to $2,238.76 and BNB was down more than 8% in its market snapshot. These are historical observations, not live quotes or a measured event-window attribution.",
 why:"The estimated $6.3bn impact is NOT a confirmed final cash loss. Assets frozen on-chain are not necessarily recovered and returned. Exchange liquidity, customer confidence, SAFU coverage and the knock-on effect for BTC, ETH and BNB are the economic questions. A wider technology-stock sell-off is a possible additional pressure, not proof the incident caused every crypto decline.",
 countercase:"Binance says user funds are safe and losses will be covered. Its initial forensic explanation and final net loss remain subject to investigation. The frozen amount could change; crypto prices were also exposed to broader risk-off selling.",
 nextTest:"Check Binance's official deposit/withdrawal restoration and revised proof of reserves, any independently confirmed recoveries and verified changes to the total impact. Compare dated BTC/USD, ETH/USD and BNB observations against the wider Nasdaq/risk-off tape before assigning causality.",
 assetNames:["BTCUSD","ETHUSD","BNB"],
 },
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
